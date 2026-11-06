import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import adminRouter from '../modules/admin/admin.routes.js';
import agentRouter from '../modules/agent/agent.routes.js';
import ticketRouter from '../modules/ticket/ticket.routes.js';
import { createAgent, setAgentBlocked } from '../modules/agent/agent.service.js';
import { validateAgentInput, validateAgentListQuery } from '../modules/agent/agent.validator.js';
import { createCategory } from '../modules/category/category.service.js';
import { createPolicy } from '../modules/sla/sla.service.js';
import { assignTicket, changeTicketCategory, changeTicketPriority, changeTicketStatus, setTicketBlocked } from '../modules/ticket/ticket.service.js';
import User from '../modules/user/user.model.js';
import Ticket from '../modules/ticket/ticket.model.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';
import { createTokenPair } from '../modules/auth/auth.token.js';

process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('base64url');

test('admin and ticket endpoints reject unauthenticated requests', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use('/api/agents', agentRouter);
  app.use('/api/tickets', ticketRouter);
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const root = `http://127.0.0.1:${server.address().port}`;
    const responses = await Promise.all([
      fetch(`${root}/api/admin/agents`),
      fetch(`${root}/api/agents`),
      fetch(`${root}/api/admin/users`),
      fetch(`${root}/api/admin/audit-logs`),
      fetch(`${root}/api/admin/tickets`),
      fetch(`${root}/api/admin/categories`),
      fetch(`${root}/api/admin/sla`),
      fetch(`${root}/api/tickets`),
    ]);
    assert.ok(responses.every((response) => response.status === 401));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('management input validation rejects role escalation and unsafe filters', () => {
  assert.throws(
    () => validateAgentInput({
      name: 'Agent',
      email: 'agent@example.com',
      phone: '+14155550123',
      password: 'AgentPassword123',
      role: 'admin',
    }),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateAgentInput({
      name: 'Agent',
      email: 'agent@example.com',
      phone: '+14155550123',
      password: 'AgentPassword123',
      isVerified: true,
    }),
    { statusCode: 400 },
  );
  assert.throws(() => validateAgentListQuery({ limit: '1000' }), { statusCode: 400 });
  assert.deepEqual(validateAgentListQuery({ active: 'false' }), {
    page: 1,
    limit: 20,
    blocked: true,
  });
});

test('admin-only services enforce role authorization independently of routes', async () => {
  const customerContext = { userId: '000000000000000000000001', role: 'user' };
  await assert.rejects(createAgent({}, customerContext), { statusCode: 403 });
  await assert.rejects(setAgentBlocked('bad-id', true, {}, customerContext), { statusCode: 403 });
  await assert.rejects(createCategory({}, customerContext), { statusCode: 403 });
  await assert.rejects(createPolicy({}, customerContext), { statusCode: 403 });
  await assert.rejects(assignTicket('bad-id', {}, { userId: customerContext.actorId, role: 'agent' }), { statusCode: 403 });
  await assert.rejects(setTicketBlocked('bad-id', {}, { userId: customerContext.actorId, role: 'user' }, true), { statusCode: 403 });
});

test('duplicate agent creation returns conflict without creating an account', async () => {
  const originalCreate = User.create;
  User.create = async () => {
    const error = new Error('duplicate key');
    error.code = 11000;
    throw error;
  };
  try {
    await assert.rejects(createAgent({
      name: 'Existing Agent',
      email: 'existing@example.com',
      phone: '+14155550123',
      password: 'AgentPassword123',
    }, { userId: '000000000000000000000001', role: 'admin' }), { statusCode: 409 });
  } finally {
    User.create = originalCreate;
  }
});

test('ticket assignment rejects invalid targets and closed tickets, while blocked tickets reject customer changes', async () => {
  const originalTicketFindOne = Ticket.findOne;
  const originalUserFindOne = User.findOne;
  const ticketId = '000000000000000000000011';
  const agentId = '000000000000000000000012';
  const ticket = { _id: ticketId, requesterId: '000000000000000000000013', assignedTo: null };
  Ticket.findOne = () => ({
    populate() { return this; },
    lean: async () => ticket,
  });
  User.findOne = () => ({
    select() { return this; },
    lean: async () => null,
  });
  try {
    await assert.rejects(assignTicket(
      ticketId,
      { agentId },
      { userId: '000000000000000000000001', role: 'admin' },
    ), { statusCode: 400 });

    Ticket.findOne = () => ({
      populate() { return this; },
      lean: async () => ({ ...ticket, status: 'closed' }),
    });
    await assert.rejects(assignTicket(
      ticketId,
      { agentId },
      { userId: '000000000000000000000001', role: 'admin' },
    ), { statusCode: 409 });

    Ticket.findOne = () => ({
      populate() { return this; },
      lean: async () => ({ ...ticket, status: 'open', isBlocked: true }),
    });
    await assert.rejects(assignTicket(
      ticketId,
      { agentId },
      { userId: '000000000000000000000001', role: 'admin' },
    ), { statusCode: 423 });

    Ticket.findOne = () => ({
      populate() { return this; },
      lean: async () => ({ ...ticket, isBlocked: true }),
    });
    await assert.rejects(changeTicketStatus(
      ticketId,
      { status: 'closed' },
      { userId: ticket.requesterId, role: 'user' },
    ), { statusCode: 423 });
    await assert.rejects(changeTicketStatus(
      ticketId,
      { status: 'open' },
      { userId: '000000000000000000000001', role: 'admin' },
    ), { statusCode: 423 });
    await assert.rejects(changeTicketPriority(
      ticketId,
      { priority: 'high' },
      { userId: '000000000000000000000001', role: 'admin' },
    ), { statusCode: 423 });
    await assert.rejects(changeTicketCategory(
      ticketId,
      { category: null },
      { userId: '000000000000000000000001', role: 'admin' },
    ), { statusCode: 423 });
  } finally {
    Ticket.findOne = originalTicketFindOne;
    User.findOne = originalUserFindOne;
  }
});

test('authorization uses the current database role and rejects blocked accounts', async () => {
  const originalFindById = User.findById;
  const originalExists = User.exists;
  const userId = '000000000000000000000021';
  const tokens = createTokenPair({ _id: userId, role: 'admin' });
  let blocked = false;
  User.findById = () => ({
    select: async () => ({ _id: userId, role: 'user', isVerified: true, isBlocked: blocked }),
  });
  User.exists = async () => ({ _id: userId });
  const app = express();
  app.get('/admin', authenticate, authorizeRoles('admin'), (_req, res) => res.sendStatus(204));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/admin`;
    const headers = { authorization: `Bearer ${tokens.accessToken}` };
    assert.equal((await fetch(url, { headers })).status, 403);
    blocked = true;
    assert.equal((await fetch(url, { headers })).status, 403);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    User.findById = originalFindById;
    User.exists = originalExists;
  }
});
