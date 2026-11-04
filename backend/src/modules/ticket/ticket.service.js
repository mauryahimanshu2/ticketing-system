import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { renderTicketCreatedEmail, renderTicketReplyEmail } from '../../templates/email/index.js';
import { recordAdminAction } from '../auditLog/auditLog.service.js';
import * as userRepository from '../user/user.repository.js';
import * as categoryRepository from '../category/category.repository.js';
import { getSlaSnapshot } from '../sla/sla.service.js';
import * as repository from './ticket.repository.js';

const statuses = new Set(['open', 'in_progress', 'pending', 'resolved', 'closed']);
const priorities = new Set(['low', 'medium', 'high', 'urgent']);

async function enqueueEmail(payload) {
  const { enqueueEmail: enqueue } = await import('../email/email.service.js');
  return enqueue(payload);
}

function error(message, statusCode) {
  const result = new Error(message);
  result.statusCode = statusCode;
  return result;
}

function validateId(value, label = 'ticketId') {
  if (!mongoose.isValidObjectId(value)) throw error(`A valid ${label} is required`, 400);
  return String(value);
}

function rejectUnknown(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('Request body must be an object', 400);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw error('Request contains unsupported fields', 400);
}

function escaped(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function ticketScope(role, userId) {
  if (role === 'user') return { requesterId: userId };
  if (role === 'agent') return { assignedTo: userId };
  return {};
}

function assertCanModify(ticket, actor) {
  if (!ticket) throw error('Ticket not found', 404);
  if (ticket.isBlocked && actor.role !== 'admin') throw error('Ticket is blocked', 423);
}

function assertRole(actor) {
  if (!['user', 'agent', 'admin'].includes(actor?.role)) throw error('A valid authenticated role is required', 403);
}

function assertAdmin(actor) {
  assertRole(actor);
  if (actor.role !== 'admin') throw error('Admin access is required', 403);
}

async function getAuthorizedTicket(ticketId, actor) {
  assertRole(actor);
  const id = validateId(ticketId);
  const ticket = await repository.findTicket(id, ticketScope(actor.role, actor.userId));
  if (!ticket) throw error('Ticket not found', 404);
  return ticket;
}

function validatePageQuery(query, { admin = false } = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw error('page must be positive and limit must be between 1 and 100', 400);
  }
  const filter = {};
  if (query.status !== undefined) {
    if (!statuses.has(query.status)) throw error('status is invalid', 400);
    filter.status = query.status;
  }
  if (query.priority !== undefined) {
    if (!priorities.has(query.priority)) throw error('priority is invalid', 400);
    filter.priority = query.priority;
  }
  if (admin) {
    if (query.category !== undefined) filter.category = validateId(query.category, 'category');
    if (query.assignedTo !== undefined) filter.assignedTo = validateId(query.assignedTo, 'assignedTo');
    if (query.from || query.to) {
      const createdAt = {};
      if (query.from) {
        const from = new Date(query.from);
        if (Number.isNaN(from.getTime())) throw error('from must be a valid date', 400);
        createdAt.$gte = from;
      }
      if (query.to) {
        const to = new Date(query.to);
        if (Number.isNaN(to.getTime())) throw error('to must be a valid date', 400);
        createdAt.$lte = to;
      }
      if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
        throw error('from must be earlier than or equal to to', 400);
      }
      filter.createdAt = createdAt;
    }
  }
  return { page, limit, filter };
}

export async function createTicket(input, actor) {
  assertRole(actor);
  if (!['user', 'admin'].includes(actor.role)) throw error('Agents cannot create tickets', 403);
  const allowedFields = actor.role === 'admin'
    ? new Set(['subject', 'description', 'category', 'requesterId', 'priority'])
    : new Set(['subject', 'description', 'category']);
  rejectUnknown(input, allowedFields);
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!subject || subject.length > 500) throw error('Subject is required and must be at most 500 characters', 400);
  if (!description || description.length > 20000) throw error('Description is required and must be at most 20000 characters', 400);

  const requesterId = actor.role === 'admin'
    ? validateId(input.requesterId, 'requesterId')
    : actor.userId;
  const requester = await repository.findActor(requesterId);
  if (!requester || requester.role !== 'user' || requester.isBlocked) {
    throw error('An active customer account is required to create a ticket', 403);
  }
  let categoryId = null;
  if (input.category !== undefined) {
    categoryId = validateId(input.category, 'category');
    const category = await categoryRepository.findCategoryById(categoryId);
    if (!category || !category.isActive) throw error('An active category is required', 400);
  }

  const priority = input.priority === undefined ? 'medium' : input.priority;
  if (!priorities.has(priority)) throw error('A valid priority is required', 400);
  const ticket = await repository.createTicket({
    ticketNumber: `TKT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
    subject,
    description,
    requesterId: requester._id,
    requesterEmail: requester.email,
    ...(categoryId ? { category: categoryId } : {}),
    priority,
    status: 'open',
    isBlocked: false,
    slaSnapshot: await getSlaSnapshot(priority),
  });
  await repository.createActivity({
    ticketId: ticket._id,
    actorId: actor.userId,
    action: 'ticket_created',
    metadata: { ticketNumber: ticket.ticketNumber, requesterId: requester._id },
  });
  if (actor.role === 'admin') {
    await recordAdminAction({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'ticket_created',
      targetType: 'ticket',
      targetId: ticket._id,
      details: { requesterId: requester._id },
    });
  }

  try {
    const rendered = renderTicketCreatedEmail({
      name: requester.name,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
    });
    await enqueueEmail({
      recipient: requester.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      emailType: 'ticket_created',
      ticketId: String(ticket._id),
    });
  } catch (queueError) {
    console.error(`Ticket creation notification was not queued (${queueError.name})`);
  }

  return ticket;
}

export async function listTickets(query, actor) {
  assertRole(actor);
  const { page, limit, filter } = validatePageQuery(query);
  return repository.listTickets({
    scope: ticketScope(actor.role, actor.userId),
    filter,
    page,
    limit,
  });
}

export async function getTicket(ticketId, actor) {
  const ticket = await getAuthorizedTicket(ticketId, actor);
  const history = await repository.getTicketHistory(ticket._id, {
    includeInternal: actor.role !== 'user',
  });
  return { ...ticket, ...history };
}

export async function replyToTicket(ticketId, input, actor) {
  assertRole(actor);
  rejectUnknown(input, new Set(['body', 'type']));
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body || body.length > 20000) throw error('Message body is required and must be at most 20000 characters', 400);

  const type = input.type === undefined ? 'public' : input.type;
  if (!['public', 'internal'].includes(type)) throw error('type must be public or internal', 400);
  if (actor.role === 'user' && type !== 'public') throw error('Customers can only send public replies', 403);
  const sender = await repository.findActor(actor.userId);
  if (!sender || sender.isBlocked) throw error('Account is unavailable', 403);

  const createdAt = new Date();
  const message = await repository.createMessage({
    ticketId: ticket._id,
    senderId: sender._id,
    senderEmail: sender.email,
    senderRole: sender.role,
    type,
    body,
    source: 'web',
  });
  await repository.touchLastMessage(ticket._id, createdAt);
  await repository.createActivity({
    ticketId: ticket._id,
    actorId: sender._id,
    action: sender.role === 'user' ? 'customer_reply' : 'agent_reply',
    metadata: { messageId: message._id, type },
  });

  let emailStatus = 'not_applicable';
  if (type === 'public' && sender.role !== 'user') {
    try {
      const rendered = renderTicketReplyEmail({
        name: ticket.requesterId?.name || 'there',
        ticketNumber: ticket.ticketNumber,
        message: { body, type: 'public' },
      });
      await enqueueEmail({
        recipient: ticket.requesterEmail,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        emailType: 'ticket_reply',
        ticketId: String(ticket._id),
        ticketMessageType: 'public',
      });
      emailStatus = 'queued';
    } catch (queueError) {
      emailStatus = 'not_queued';
      console.error(`Ticket reply notification was not queued (${queueError.name})`);
    }
  }

  return { message, emailStatus };
}

export async function changeTicketStatus(ticketId, input, actor) {
  assertRole(actor);
  rejectUnknown(input, new Set(['status']));
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  const status = input.status;
  if (!statuses.has(status)) throw error('A valid ticket status is required', 400);
  if (actor.role === 'user' && !['closed', 'open'].includes(status)) {
    throw error('Customers may only close or reopen their tickets', 403);
  }
  if (actor.role === 'user' && status === 'open' && !['closed', 'resolved'].includes(ticket.status)) {
    throw error('Only closed or resolved tickets can be reopened', 409);
  }
  if (actor.role === 'agent') {
    const allowedTransitions = {
      open: ['in_progress', 'pending', 'resolved', 'closed'],
      in_progress: ['open', 'pending', 'resolved', 'closed'],
      pending: ['open', 'in_progress', 'resolved', 'closed'],
      resolved: ['open', 'closed'],
      closed: ['open'],
    };
    if (status !== ticket.status && !allowedTransitions[ticket.status].includes(status)) {
      throw error(`Agents cannot change ticket status from ${ticket.status} to ${status}`, 409);
    }
  }
  if (actor.role !== 'admin' && ticket.status === status) return ticket;

  const oldStatus = ticket.status;
  const now = new Date();
  const updates = {
    status,
    ...(status === 'resolved' ? { resolvedAt: now } : status === 'open' ? { resolvedAt: null } : {}),
    ...(status === 'closed' ? { closedAt: now } : status === 'open' ? { closedAt: null } : {}),
  };
  const scope = {
    ...ticketScope(actor.role, actor.userId),
    ...(actor.role !== 'admin' ? { isBlocked: { $ne: true } } : {}),
  };
  const updated = await repository.updateTicket(ticket._id, updates, scope);
  if (!updated) throw error('Ticket changed or is no longer accessible; reload and retry', 409);
  const action = status === 'resolved' ? 'resolved'
    : status === 'closed' ? 'closed'
      : status === 'open' && ['closed', 'resolved'].includes(oldStatus) ? 'reopened'
        : 'status_changed';
  await repository.createActivity({
    ticketId: ticket._id,
    actorId: actor.userId,
    action,
    oldValue: oldStatus,
    newValue: status,
  });
  if (actor.role === 'admin') {
    await recordAdminAction({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'ticket_status_changed',
      targetType: 'ticket',
      targetId: ticket._id,
      details: { oldStatus, newStatus: status },
    });
  }
  return updated;
}

export async function changeTicketPriority(ticketId, input, actor) {
  assertRole(actor);
  rejectUnknown(input, new Set(['priority']));
  if (actor.role === 'user') throw error('Customers cannot change ticket priority', 403);
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  const priority = input.priority;
  if (!priorities.has(priority)) throw error('A valid priority is required', 400);
  const slaSnapshot = await getSlaSnapshot(priority);
  const updated = await repository.updateTicket(ticket._id, {
    priority,
    slaSnapshot,
  }, {
    ...ticketScope(actor.role, actor.userId),
    ...(actor.role !== 'admin' ? { isBlocked: { $ne: true } } : {}),
  });
  if (!updated) throw error('Ticket changed or is no longer accessible; reload and retry', 409);
  await repository.createActivity({
    ticketId: ticket._id,
    actorId: actor.userId,
    action: 'priority_changed',
    oldValue: ticket.priority,
    newValue: priority,
    metadata: {
      oldSlaSnapshot: ticket.slaSnapshot || null,
      newSlaSnapshot: slaSnapshot,
    },
  });
  if (actor.role === 'admin') {
    await recordAdminAction({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'ticket_priority_changed',
      targetType: 'ticket',
      targetId: ticket._id,
      details: { oldPriority: ticket.priority, newPriority: priority },
    });
  }
  return updated;
}

export async function changeTicketCategory(ticketId, input, actor) {
  assertAdmin(actor);
  rejectUnknown(input, new Set(['category']));
  const ticket = await getAuthorizedTicket(ticketId, actor);
  let categoryId = null;
  if (input.category !== null) {
    categoryId = validateId(input.category, 'category');
    const category = await categoryRepository.findCategoryById(categoryId);
    if (!category || !category.isActive) throw error('An active category is required', 400);
  }
  const updated = await repository.updateTicket(ticket._id, { category: categoryId });
  await repository.createActivity({
    ticketId: ticket._id,
    actorId: actor.userId,
    action: 'category_changed',
    oldValue: ticket.category?._id || ticket.category || null,
    newValue: categoryId,
  });
  await recordAdminAction({
    actorId: actor.userId,
    ipAddress: actor.ipAddress,
    action: 'ticket_category_changed',
    targetType: 'ticket',
    targetId: ticket._id,
    details: {
      oldCategoryId: ticket.category?._id || ticket.category || null,
      newCategoryId: categoryId,
    },
  });
  return updated;
}

async function notifyAgent(agent, ticket, { reassigned = false } = {}) {
  const subject = `Ticket ${ticket.ticketNumber} ${reassigned ? 'reassigned' : 'assigned'}`;
  const action = reassigned ? 'has been reassigned from you' : 'has been assigned to you';
  const text = `Hello ${agent.name},\n\nTicket ${ticket.ticketNumber} ${action}: ${ticket.subject}`;
  const html = `<p>Hello ${escaped(agent.name)},</p><p>Ticket <strong>${escaped(ticket.ticketNumber)}</strong> ${action}.</p><p>${escaped(ticket.subject)}</p>`;
  return enqueueEmail({
    recipient: agent.email,
    subject,
    text,
    html,
    emailType: 'ticket_assigned',
    ticketId: String(ticket._id),
  });
}

export async function assignTicket(ticketId, input, actor, { reassign = false } = {}) {
  assertAdmin(actor);
  rejectUnknown(input, reassign ? new Set(['agentId', 'reason']) : new Set(['agentId']));
  if (reassign && (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500)) {
    throw error('A reassignment reason of at most 500 characters is required', 400);
  }
  const id = validateId(ticketId);
  const agentId = validateId(input.agentId, 'agentId');
  const [ticket, agent] = await Promise.all([
    repository.findTicket(id, {}),
    userRepository.findManagedUser(agentId, 'agent'),
  ]);
  if (!ticket) throw error('Ticket not found', 404);
  if (!agent || !agent.isVerified) throw error('A valid verified support agent is required', 400);
  if (agent.isBlocked) throw error('Blocked agents cannot be assigned tickets', 409);
  if (reassign && !ticket.assignedTo) throw error('Ticket is not currently assigned; use assign', 409);
  if (!reassign && ticket.assignedTo) throw error('Ticket is already assigned; use reassign', 409);
  if (String(ticket.assignedTo?._id || ticket.assignedTo) === agentId) throw error('Ticket is already assigned to this agent', 409);

  const oldAgent = ticket.assignedTo;
  const now = new Date();
  const updated = await repository.updateTicket(id, {
    assignedTo: agentId,
    assignedBy: actor.userId,
    assignedAt: now,
  }, reassign ? { assignedTo: oldAgent?._id || oldAgent } : { assignedTo: null });
  if (!updated) throw error('Ticket assignment changed concurrently; reload and retry', 409);
  await repository.createActivity({
    ticketId: id,
    actorId: actor.userId,
    action: 'assignment_changed',
    oldValue: oldAgent?._id || oldAgent || null,
    newValue: agentId,
    metadata: {
      assignedBy: actor.userId,
      assignedAt: now,
      ...(reassign ? { reason: input.reason.trim() } : {}),
    },
  });
  await recordAdminAction({
    actorId: actor.userId,
    ipAddress: actor.ipAddress,
    action: reassign ? 'ticket_reassigned' : 'ticket_assigned',
    targetType: 'ticket',
    targetId: id,
    details: {
      previousAgentId: oldAgent?._id || oldAgent || null,
      newAgentId: agentId,
      ...(reassign ? { reason: input.reason.trim() } : {}),
    },
  });

  const notificationResults = await Promise.allSettled([
    notifyAgent(agent, { ...ticket, _id: id }),
    ...(reassign && oldAgent?.email
      ? [notifyAgent(oldAgent, { ...ticket, _id: id }, { reassigned: true })]
      : []),
  ]);
  const notificationsQueued = notificationResults.filter((item) => item.status === 'fulfilled').length;
  if (notificationsQueued !== notificationResults.length) {
    console.error(`Ticket assignment notification queue failed for ticket ${id}`);
  }
  return { ticket: updated, notificationsQueued, notificationCount: notificationResults.length };
}

export async function setTicketBlocked(ticketId, input, actor, blocked) {
  assertAdmin(actor);
  const id = validateId(ticketId);
  let reason;
  if (blocked) {
    rejectUnknown(input, new Set(['reason']));
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) {
      throw error('A blocking reason of at most 500 characters is required', 400);
    }
    reason = input.reason.trim();
  } else {
    rejectUnknown(input, new Set());
  }
  const ticket = await repository.findTicket(id, {});
  if (!ticket) throw error('Ticket not found', 404);
  const updated = await repository.updateTicket(id, {
    isBlocked: blocked,
    blockedAt: blocked ? new Date() : null,
    blockReason: reason || null,
  }, { isBlocked: blocked ? { $ne: true } : true });
  if (!updated) throw error(`Ticket is already ${blocked ? 'blocked' : 'unblocked'}`, 409);
  await repository.createActivity({
    ticketId: id,
    actorId: actor.userId,
    action: blocked ? 'ticket_blocked' : 'ticket_unblocked',
    oldValue: blocked ? false : true,
    newValue: blocked,
    metadata: blocked ? { reason } : {},
  });
  await recordAdminAction({
    actorId: actor.userId,
    ipAddress: actor.ipAddress,
    action: blocked ? 'ticket_blocked' : 'ticket_unblocked',
    targetType: 'ticket',
    targetId: id,
    details: blocked ? { reason } : {},
  });
  return updated;
}

export async function listAdminTickets(query, actor) {
  assertAdmin(actor);
  const { page, limit, filter } = validatePageQuery(query, { admin: true });
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 120) throw error('search is invalid', 400);
    const search = query.search.trim();
    const clauses = [];
    if (mongoose.isValidObjectId(search)) clauses.push({ _id: search });
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clauses.push({ subject: { $regex: escapedSearch, $options: 'i' } });
    clauses.push({ ticketNumber: { $regex: escapedSearch, $options: 'i' } });
    filter.$or = clauses;
  }
  return repository.listAllAdminTickets({ filter, page, limit });
}

export async function getAdminTicket(ticketId, actor) {
  assertAdmin(actor);
  const id = validateId(ticketId);
  const ticket = await repository.findTicketWithHistory(id);
  if (!ticket) throw error('Ticket not found', 404);
  return ticket;
}
