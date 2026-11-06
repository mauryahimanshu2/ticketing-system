import { randomBytes } from 'node:crypto';
import { requireAdmin } from '../../utils/authorization.js';
import { httpError } from '../../utils/http.js';
import { recordAdminAction } from '../auditLog/auditLog.service.js';
import * as userRepository from '../user/user.repository.js';
import * as categoryRepository from '../category/category.repository.js';
import { getSlaSnapshot } from '../sla/sla.service.js';
import * as repository from './ticket.repository.js';
import {
  queueAgentAssignmentEmail,
  queueCustomerAssignmentEmail,
  queueCustomerStatusEmail,
  queueInformationRequestEmail,
  queueTicketCreatedEmail,
  queueTicketReplyEmail,
} from './ticket.notifications.js';
import { createTicketReplyAddress } from './ticket.emailReply.js';
import {
  validateAssignment,
  validateBlockChange,
  validateCategoryChange,
  validateCreateTicket,
  validateInformationRequest,
  validatePriorityChange,
  validateReply,
  validateStatusChange,
  validateTicketId,
  validateTicketListQuery,
} from './ticket.validator.js';

function ticketScope(role, userId) {
  if (role === 'user') return { requesterId: userId };
  if (role === 'agent') return { assignedTo: userId };
  return {};
}

function ticketUpdateScope(actor) {
  return {
    ...ticketScope(actor.role, actor.userId),
    isBlocked: { $ne: true },
  };
}

function recordTicketAdminAction(actor, ticketId, action, details = {}) {
  return recordAdminAction({
    actorId: actor.userId,
    ipAddress: actor.ipAddress,
    action,
    targetType: 'ticket',
    targetId: ticketId,
    details,
  });
}

function assertCanModify(ticket, actor) {
  if (!ticket) throw httpError('Ticket not found', 404);
  if (ticket.isBlocked) throw httpError('Ticket is blocked; unblock it before making changes', 423);
}

function assertRole(actor) {
  if (!['user', 'agent', 'admin'].includes(actor?.role)) {
    throw httpError('A valid authenticated role is required', 403);
  }
}

async function getAuthorizedTicket(ticketId, actor) {
  assertRole(actor);
  const id = validateTicketId(ticketId);
  const ticket = await repository.findTicket(id, ticketScope(actor.role, actor.userId));
  if (!ticket) throw httpError('Ticket not found', 404);
  return ticket;
}

export async function createTicket(input, actor) {
  assertRole(actor);
  if (!['user', 'admin'].includes(actor.role)) throw httpError('Agents cannot create tickets', 403);
  const { subject, description, priority, requesterId: requestedUserId, categoryId } = validateCreateTicket(input, actor.role);
  const requesterId = requestedUserId || actor.userId;
  const requester = await repository.findActor(requesterId);
  if (!requester || requester.role !== 'user' || requester.isBlocked) {
    throw httpError('An active customer account is required to create a ticket', 403);
  }
  if (categoryId) {
    const category = await categoryRepository.findCategoryById(categoryId);
    if (!category || !category.isActive) throw httpError('An active category is required', 400);
  }
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
    await recordTicketAdminAction(actor, ticket._id, 'ticket_created', {
      requesterId: requester._id,
    });
  }

  try {
    await queueTicketCreatedEmail(ticket, requester);
  } catch (queueError) {
    console.error(`Ticket creation notification was not queued (${queueError.name})`);
  }

  return ticket;
}

export async function listTickets(query, actor) {
  assertRole(actor);
  const { page, limit, filter } = validateTicketListQuery(query);
  return repository.listTickets({
    scope: ticketScope(actor.role, actor.userId),
    filter,
    page,
    limit,
  });
}

export async function getTicketSummary(actor) {
  assertRole(actor);
  return repository.getTicketCounts(ticketScope(actor.role, actor.userId));
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
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  const { body, type } = validateReply(input);
  if (actor.role === 'user' && type !== 'public') throw httpError('Customers can only send public replies', 403);
  const sender = await repository.findActor(actor.userId);
  if (!sender || sender.isBlocked) throw httpError('Account is unavailable', 403);

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
      await queueTicketReplyEmail(ticket, body);
      emailStatus = 'queued';
    } catch (queueError) {
      emailStatus = 'not_queued';
      console.error(`Ticket reply notification was not queued (${queueError.name})`);
    }
  }

  return { message, emailStatus };
}

export async function requestTicketInformation(ticketId, input, actor) {
  assertRole(actor);
  if (!['agent', 'admin'].includes(actor.role)) {
    throw httpError('Only agents and admins can request additional information', 403);
  }

  const messageBody = validateInformationRequest(input);
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  if (!ticket.assignedTo) throw httpError('Assign the ticket before requesting additional information', 409);
  if (ticket.assignedTo.isBlocked) throw httpError('The assigned agent is unavailable', 409);
  if (['resolved', 'closed'].includes(ticket.status)) {
    throw httpError('Reopen the ticket before requesting additional information', 409);
  }

  const sender = await repository.findActor(actor.userId);
  if (!sender || sender.isBlocked) throw httpError('Account is unavailable', 403);

  const replyTo = ticket.emailReplyAddress || createTicketReplyAddress();
  const createdAt = new Date();
  const updated = await repository.updateTicket(ticket._id, {
    status: 'pending',
    lastMessageAt: createdAt,
    emailReplyAddress: replyTo,
  }, ticketUpdateScope(actor));
  if (!updated) throw httpError('Ticket changed or is no longer accessible; reload and retry', 409);

  const message = await repository.createMessage({
    ticketId: ticket._id,
    senderId: sender._id,
    senderEmail: sender.email,
    senderRole: sender.role,
    type: 'public',
    body: messageBody,
    source: 'web',
  });
  await repository.createActivity({
    ticketId: ticket._id,
    actorId: sender._id,
    action: 'information_requested',
    oldValue: ticket.status,
    newValue: 'pending',
    metadata: { messageId: message._id, type: 'public' },
  });
  if (actor.role === 'admin') {
    await recordTicketAdminAction(actor, ticket._id, 'ticket_information_requested', {
      messageId: message._id,
      assignedAgentId: ticket.assignedTo?._id || ticket.assignedTo,
    });
  }

  let emailStatus = 'queued';
  try {
    await queueInformationRequestEmail(
      { ...ticket, status: 'pending', emailReplyAddress: replyTo },
      sender,
      messageBody,
      replyTo,
    );
  } catch (queueError) {
    emailStatus = 'not_queued';
    console.error(`Ticket information request was not queued (${queueError.name})`);
  }

  return { ticket: updated, message, emailStatus };
}

export async function changeTicketStatus(ticketId, input, actor) {
  assertRole(actor);
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  const status = validateStatusChange(input);
  if (actor.role === 'user' && !['closed', 'open'].includes(status)) {
    throw httpError('Customers may only close or reopen their tickets', 403);
  }
  if (actor.role === 'user' && status === 'open' && !['closed', 'resolved'].includes(ticket.status)) {
    throw httpError('Only closed or resolved tickets can be reopened', 409);
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
      throw httpError(`Agents cannot change ticket status from ${ticket.status} to ${status}`, 409);
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
  const updated = await repository.updateTicket(ticket._id, updates, ticketUpdateScope(actor));
  if (!updated) throw httpError('Ticket changed or is no longer accessible; reload and retry', 409);
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
    await recordTicketAdminAction(actor, ticket._id, 'ticket_status_changed', {
      oldStatus,
      newStatus: status,
    });
  }
  if (oldStatus !== status) {
    try {
      await queueCustomerStatusEmail(ticket, status);
    } catch (queueError) {
      console.error(`Ticket status notification was not queued (${queueError.name})`);
    }
  }
  return updated;
}

export async function changeTicketPriority(ticketId, input, actor) {
  assertRole(actor);
  if (actor.role === 'user') throw httpError('Customers cannot change ticket priority', 403);
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  const priority = validatePriorityChange(input);
  const slaSnapshot = await getSlaSnapshot(priority);
  const updated = await repository.updateTicket(ticket._id, {
    priority,
    slaSnapshot,
  }, ticketUpdateScope(actor));
  if (!updated) throw httpError('Ticket changed or is no longer accessible; reload and retry', 409);
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
    await recordTicketAdminAction(actor, ticket._id, 'ticket_priority_changed', {
      oldPriority: ticket.priority,
      newPriority: priority,
    });
  }
  return updated;
}

export async function changeTicketCategory(ticketId, input, actor) {
  requireAdmin(actor);
  const ticket = await getAuthorizedTicket(ticketId, actor);
  assertCanModify(ticket, actor);
  const categoryId = validateCategoryChange(input);
  if (categoryId) {
    const category = await categoryRepository.findCategoryById(categoryId);
    if (!category || !category.isActive) throw httpError('An active category is required', 400);
  }
  const updated = await repository.updateTicket(ticket._id, { category: categoryId }, { isBlocked: { $ne: true } });
  if (!updated) throw httpError('Ticket changed or is blocked; reload and retry', 409);
  await repository.createActivity({
    ticketId: ticket._id,
    actorId: actor.userId,
    action: 'category_changed',
    oldValue: ticket.category?._id || ticket.category || null,
    newValue: categoryId,
  });
  await recordTicketAdminAction(actor, ticket._id, 'ticket_category_changed', {
    oldCategoryId: ticket.category?._id || ticket.category || null,
    newCategoryId: categoryId,
  });
  return updated;
}

export async function assignTicket(ticketId, input, actor, { reassign = false } = {}) {
  requireAdmin(actor);
  const id = validateTicketId(ticketId);
  const { agentId, reason } = validateAssignment(input, { reassign });
  const [ticket, agent] = await Promise.all([
    repository.findTicket(id, {}),
    userRepository.findManagedUser(agentId, 'agent'),
  ]);
  if (!ticket) throw httpError('Ticket not found', 404);
  if (ticket.isBlocked) throw httpError('Blocked tickets must be unblocked before assignment or reassignment', 423);
  if (ticket.status === 'closed') {
    throw httpError('Closed tickets must be reopened before assignment or reassignment', 409);
  }
  if (!agent || !agent.isVerified) throw httpError('A valid verified support agent is required', 400);
  if (agent.isBlocked) throw httpError('Blocked agents cannot be assigned tickets', 409);
  if (reassign && !ticket.assignedTo) throw httpError('Ticket is not currently assigned; use assign', 409);
  if (!reassign && ticket.assignedTo) throw httpError('Ticket is already assigned; use reassign', 409);
  if (String(ticket.assignedTo?._id || ticket.assignedTo) === agentId) throw httpError('Ticket is already assigned to this agent', 409);

  const oldAgent = ticket.assignedTo;
  const now = new Date();
  const updated = await repository.updateTicket(id, {
    assignedTo: agentId,
    assignedBy: actor.userId,
    assignedAt: now,
  }, reassign ? { assignedTo: oldAgent?._id || oldAgent } : { assignedTo: null });
  if (!updated) throw httpError('Ticket assignment changed concurrently; reload and retry', 409);
  await repository.createActivity({
    ticketId: id,
    actorId: actor.userId,
    action: 'assignment_changed',
    oldValue: oldAgent?._id || oldAgent || null,
    newValue: agentId,
    metadata: {
      assignedBy: actor.userId,
      assignedAt: now,
      ...(reassign ? { reason } : {}),
    },
  });
  await recordTicketAdminAction(actor, id, reassign ? 'ticket_reassigned' : 'ticket_assigned', {
    previousAgentId: oldAgent?._id || oldAgent || null,
    newAgentId: agentId,
    ...(reassign ? { reason } : {}),
  });

  const notificationResults = await Promise.allSettled([
    queueAgentAssignmentEmail(agent, { ...ticket, _id: id }),
    queueCustomerAssignmentEmail({ ...ticket, _id: id }, agent),
    ...(reassign && oldAgent?.email
      ? [queueAgentAssignmentEmail(oldAgent, { ...ticket, _id: id }, { reassigned: true })]
      : []),
  ]);
  const notificationsQueued = notificationResults.filter((item) => item.status === 'fulfilled').length;
  if (notificationsQueued !== notificationResults.length) {
    console.error(`Ticket assignment notification queue failed for ticket ${id}`);
  }
  return { ticket: updated, notificationsQueued, notificationCount: notificationResults.length };
}

export async function setTicketBlocked(ticketId, input, actor, blocked) {
  requireAdmin(actor);
  const id = validateTicketId(ticketId);
  const reason = validateBlockChange(input, blocked);
  const ticket = await repository.findTicket(id, {});
  if (!ticket) throw httpError('Ticket not found', 404);
  const updated = await repository.updateTicket(id, {
    isBlocked: blocked,
    blockedAt: blocked ? new Date() : null,
    blockReason: reason || null,
  }, { isBlocked: blocked ? { $ne: true } : true });
  if (!updated) throw httpError(`Ticket is already ${blocked ? 'blocked' : 'unblocked'}`, 409);
  await repository.createActivity({
    ticketId: id,
    actorId: actor.userId,
    action: blocked ? 'ticket_blocked' : 'ticket_unblocked',
    oldValue: blocked ? false : true,
    newValue: blocked,
    metadata: blocked ? { reason } : {},
  });
  await recordTicketAdminAction(
    actor,
    id,
    blocked ? 'ticket_blocked' : 'ticket_unblocked',
    blocked ? { reason } : {},
  );
  return updated;
}

export async function listAdminTickets(query, actor) {
  requireAdmin(actor);
  const { page, limit, filter } = validateTicketListQuery(query, { admin: true });
  return repository.listAllAdminTickets({ filter, page, limit });
}

export async function getAdminTicket(ticketId, actor) {
  requireAdmin(actor);
  const id = validateTicketId(ticketId);
  const ticket = await repository.findTicketWithHistory(id);
  if (!ticket) throw httpError('Ticket not found', 404);
  return ticket;
}
