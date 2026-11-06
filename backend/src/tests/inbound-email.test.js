import assert from 'node:assert/strict';
import test from 'node:test';
import { createInboundEmailService } from '../modules/email/email.inbound.service.js';
import { validateInboundEmail } from '../modules/email/email.inbound.validator.js';
import { createTicketReplyAddress } from '../modules/ticket/ticket.emailReply.js';

const ticketId = '000000000000000000000081';
const requesterId = '000000000000000000000082';
const ticket = {
  _id: ticketId,
  ticketNumber: 'TKT-81',
  requesterEmail: 'customer@example.com',
  requesterId: { _id: requesterId, name: 'Customer' },
  assignedTo: { name: 'Agent', email: 'agent@example.com' },
  emailReplyAddress: 'support+ticket-securetoken@gmail.com',
  status: 'pending',
  isBlocked: false,
};

function createRepository(overrides = {}) {
  const calls = { messages: [], updates: [], activities: [] };
  return {
    calls,
    findMessageByEmailId: async () => null,
    findTicketByReplyAddress: async () => ticket,
    createMessage: async (data) => {
      calls.messages.push(data);
      return { _id: '000000000000000000000083', ...data };
    },
    updateTicket: async (id, updates) => {
      calls.updates.push({ id, updates });
      return { ...ticket, ...updates };
    },
    createActivity: async (data) => {
      calls.activities.push(data);
      return data;
    },
    ...overrides,
  };
}

test('inbound customer email becomes a public ticket reply and notifies the agent', async () => {
  const repository = createRepository();
  const notifications = [];
  const processInboundEmail = createInboundEmailService({
    repository,
    notifyAgent: async (targetTicket, body) => notifications.push({ targetTicket, body }),
  });

  const result = await processInboundEmail({
    recipient: 'support+ticket-securetoken@gmail.com',
    sender: 'Customer Name <CUSTOMER@example.com>',
    messageId: 'gmail-message-1',
    inReplyTo: '<original-message@example.com>',
    body: 'The transaction reference is TX-123.\n\nOn Monday Agent wrote:\n> Old question',
  });

  assert.equal(result.status, 'processed');
  assert.equal(result.ticketStatus, 'in_progress');
  assert.equal(result.agentNotification, 'queued');
  assert.equal(repository.calls.messages.length, 1);
  assert.equal(repository.calls.messages[0].body, 'The transaction reference is TX-123.');
  assert.equal(repository.calls.messages[0].source, 'email');
  assert.equal(repository.calls.messages[0].type, 'public');
  assert.equal(repository.calls.messages[0].senderRole, 'user');
  assert.equal(repository.calls.updates[0].updates.status, 'in_progress');
  assert.equal(repository.calls.activities[0].action, 'customer_reply');
  assert.equal(repository.calls.activities[0].oldValue, 'pending');
  assert.equal(repository.calls.activities[0].newValue, 'in_progress');
  assert.equal(repository.calls.activities[0].metadata.messageId, '000000000000000000000083');
  assert.equal(repository.calls.activities[0].metadata.source, 'email');
  assert.equal(notifications.length, 1);
});

test('duplicate inbound email returns safely without creating another message', async () => {
  const repository = createRepository({
    findMessageByEmailId: async () => ({ ticketId }),
  });
  const processInboundEmail = createInboundEmailService({ repository });

  const result = await processInboundEmail({
    recipient: ticket.emailReplyAddress,
    sender: ticket.requesterEmail,
    messageId: 'gmail-message-1',
    body: 'Duplicate reply',
  });

  assert.deepEqual(result, { status: 'duplicate', ticketId });
  assert.equal(repository.calls.messages.length, 0);
});

test('inbound email rejects a sender who is not the ticket requester', async () => {
  const repository = createRepository();
  const processInboundEmail = createInboundEmailService({ repository });

  await assert.rejects(processInboundEmail({
    recipient: ticket.emailReplyAddress,
    sender: 'attacker@example.com',
    messageId: 'gmail-message-2',
    body: 'Unauthorized reply',
  }), { statusCode: 403 });
  assert.equal(repository.calls.messages.length, 0);
});

test('inbound validation accepts text only and rejects unsupported fields', () => {
  assert.throws(() => validateInboundEmail({
    recipient: ticket.emailReplyAddress,
    sender: ticket.requesterEmail,
    messageId: 'gmail-message-3',
    body: 'Reply',
    files: [],
  }), { statusCode: 400 });
});

test('ticket reply addresses use an opaque Gmail plus-address', () => {
  const originalSupportEmail = process.env.SUPPORT_EMAIL;
  try {
    process.env.SUPPORT_EMAIL = 'support@gmail.com';
    assert.match(
      createTicketReplyAddress(),
      /^support\+ticket-[a-z0-9_-]{24}@gmail\.com$/,
    );
    delete process.env.SUPPORT_EMAIL;
    assert.throws(() => createTicketReplyAddress(), { statusCode: 503 });
  } finally {
    if (originalSupportEmail === undefined) delete process.env.SUPPORT_EMAIL;
    else process.env.SUPPORT_EMAIL = originalSupportEmail;
  }
});
