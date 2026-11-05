import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import Ticket from '../modules/ticket/ticket.model.js';
import TicketActivity from '../modules/ticketActivity/ticketActivity.model.js';
import TicketMessage from '../modules/ticketMessage/ticketMessage.model.js';
import User from '../modules/user/user.model.js';
import AuditLog from '../modules/auditLog/auditLog.model.js';
import EmailEvent from '../modules/email/emailEvent.model.js';
import emailQueue from '../queues/email.queue.js';
import { redisConnection } from '../config/redis.js';
import {
  assignTicket,
  changeTicketStatus,
  requestTicketInformation,
} from '../modules/ticket/ticket.service.js';

process.env.APPS_SCRIPT_SECRET ??= randomBytes(32).toString('base64url');

test('assignment and status changes queue detailed customer emails', async () => {
  const originals = {
    ticketFindOne: Ticket.findOne,
    ticketUpdate: Ticket.findOneAndUpdate,
    activityCreate: TicketActivity.create,
    messageCreate: TicketMessage.create,
    userFindOne: User.findOne,
    userFindById: User.findById,
    auditCreate: AuditLog.create,
    emailFindOne: EmailEvent.findOne,
    emailCreate: EmailEvent.create,
    queueAdd: emailQueue.add,
  };
  const ticketId = '000000000000000000000071';
  const requesterId = '000000000000000000000072';
  const agentId = '000000000000000000000073';
  const adminId = '000000000000000000000074';
  const agent = {
    _id: agentId,
    name: 'Sam Support',
    email: 'sam@example.com',
    role: 'agent',
    isVerified: true,
    isBlocked: false,
  };
  let ticket = {
    _id: ticketId,
    ticketNumber: 'TKT-71',
    subject: 'Cannot sign in',
    description: 'Login shows an error after submitting the form.',
    priority: 'high',
    status: 'open',
    requesterEmail: 'customer@example.com',
    requesterId: { _id: requesterId, name: 'Customer' },
    assignedTo: null,
    category: { _id: '000000000000000000000075', name: 'Account access' },
    isBlocked: false,
  };
  const jobs = [];
  let eventNumber = 0;
  const originalSupportEmail = process.env.SUPPORT_EMAIL;

  Ticket.findOne = () => ({
    populate() { return this; },
    lean: async () => ({ ...ticket }),
  });
  Ticket.findOneAndUpdate = async (_filter, update) => ({ ...ticket, ...update.$set });
  TicketActivity.create = async (data) => data;
  TicketMessage.create = async (data) => ({
    _id: '000000000000000000000076',
    ...data,
  });
  User.findOne = () => ({
    select() { return this; },
    lean: async () => ({ ...agent }),
  });
  User.findById = () => ({
    select() { return this; },
    lean: async () => ({ ...agent }),
  });
  AuditLog.create = async (data) => data;
  EmailEvent.findOne = () => ({ select: async () => null });
  EmailEvent.create = async (data) => ({
    _id: `0000000000000000000000${String(++eventNumber).padStart(2, '0')}`,
    ...data,
  });
  emailQueue.add = async (_name, data) => {
    jobs.push(data);
    return { id: data.idempotencyKey };
  };

  try {
    process.env.SUPPORT_EMAIL = 'support@gmail.com';
    const assignment = await assignTicket(
      ticketId,
      { agentId },
      { userId: adminId, role: 'admin', ipAddress: '127.0.0.1' },
    );
    assert.equal(assignment.notificationsQueued, 2);
    assert.equal(jobs.length, 2);

    const customerAssignment = jobs.find((job) =>
      job.payload?.recipient === ticket.requesterEmail,
    );
    assert.ok(customerAssignment);
    assert.equal(customerAssignment.emailType, 'ticket_assigned');
    assert.match(customerAssignment.payload.text, /Sam Support/);
    assert.match(customerAssignment.payload.text, /Cannot sign in/);
    assert.match(customerAssignment.payload.text, /Account access/);

    jobs.length = 0;
    ticket = { ...ticket, assignedTo: agent };
    const updated = await changeTicketStatus(
      ticketId,
      { status: 'in_progress' },
      { userId: agentId, role: 'agent', ipAddress: '127.0.0.1' },
    );
    assert.equal(updated.status, 'in_progress');
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].emailType, 'ticket_status_update');
    assert.equal(jobs[0].payload.recipient, ticket.requesterEmail);
    assert.match(jobs[0].payload.text, /Status: in_progress/);
    assert.match(jobs[0].payload.text, /Sam Support/);
    assert.match(jobs[0].payload.text, /Login shows an error/);

    jobs.length = 0;
    ticket = { ...ticket, status: 'in_progress' };
    await changeTicketStatus(
      ticketId,
      { status: 'in_progress' },
      { userId: adminId, role: 'admin', ipAddress: '127.0.0.1' },
    );
    assert.equal(jobs.length, 0, 'unchanged status must not send another customer email');

    ticket = { ...ticket, status: 'in_progress' };
    const informationRequest = await requestTicketInformation(
      ticketId,
      { message: 'Please send the transaction reference.' },
      { userId: agentId, role: 'agent', ipAddress: '127.0.0.1' },
    );
    assert.equal(informationRequest.ticket.status, 'pending');
    assert.equal(informationRequest.emailStatus, 'queued');
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].emailType, 'ticket_information_request');
    assert.equal(jobs[0].payload.recipient, ticket.requesterEmail);
    assert.match(jobs[0].payload.replyTo, /^support\+ticket-[a-z0-9_-]+@gmail\.com$/);
    assert.match(jobs[0].payload.text, /transaction reference/);

  } finally {
    if (originalSupportEmail === undefined) delete process.env.SUPPORT_EMAIL;
    else process.env.SUPPORT_EMAIL = originalSupportEmail;
    Ticket.findOne = originals.ticketFindOne;
    Ticket.findOneAndUpdate = originals.ticketUpdate;
    TicketActivity.create = originals.activityCreate;
    TicketMessage.create = originals.messageCreate;
    User.findOne = originals.userFindOne;
    User.findById = originals.userFindById;
    AuditLog.create = originals.auditCreate;
    EmailEvent.findOne = originals.emailFindOne;
    EmailEvent.create = originals.emailCreate;
    emailQueue.add = originals.queueAdd;
    await Promise.allSettled([
      emailQueue.close(),
      redisConnection.quit(),
    ]);
  }
});
