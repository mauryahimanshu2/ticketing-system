import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import app from '../app.js';
import User from '../modules/user/user.model.js';
import Ticket from '../modules/ticket/ticket.model.js';
import Category from '../modules/category/category.model.js';
import SlaPolicy from '../modules/sla/sla.model.js';
import AuditLog from '../modules/auditLog/auditLog.model.js';
import { createTokenPair } from '../modules/auth/auth.token.js';
import emailQueue from '../queues/email.queue.js';
import { redisConnection } from '../config/redis.js';

process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('base64url');

const userId = '000000000000000000000091';
const originalFindById = User.findById;
const originalExists = User.exists;
let currentRole = 'user';
let server;
let root;
let accessToken;

before(async () => {
  const tokens = createTokenPair({ _id: userId, role: 'user' });
  accessToken = tokens.accessToken;

  User.findById = () => ({
    select: async () => ({
      _id: userId,
      role: currentRole,
      isVerified: true,
      isBlocked: false,
    }),
  });
  User.exists = async () => ({ _id: userId });

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  root = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  User.findById = originalFindById;
  User.exists = originalExists;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await Promise.allSettled([
    emailQueue.close(),
    redisConnection.quit(),
  ]);
});

async function request(method, path, { authenticated = false, body, headers = {} } = {}) {
  const response = await fetch(`${root}${path}`, {
    method,
    headers: {
      ...(authenticated ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response;
}

const protectedEndpoints = [
  ['GET', '/api/agents'],
  ['POST', '/api/agents', {}],
  ['GET', '/api/agents/bad-id'],
  ['PATCH', '/api/agents/bad-id', {}],
  ['PATCH', '/api/agents/bad-id/block', {}],
  ['PATCH', '/api/agents/bad-id/unblock', {}],
  ['GET', '/api/admin/users'],
  ['GET', '/api/admin/users/bad-id'],
  ['PATCH', '/api/admin/users/bad-id/block', {}],
  ['PATCH', '/api/admin/users/bad-id/unblock', {}],
  ['GET', '/api/admin/audit-logs'],
  ['GET', '/api/admin/audit-logs/bad-id'],
  ['GET', '/api/admin/tickets'],
  ['POST', '/api/admin/tickets', {}],
  ['GET', '/api/admin/tickets/bad-id'],
  ['PATCH', '/api/admin/tickets/bad-id/assign', {}],
  ['PATCH', '/api/admin/tickets/bad-id/reassign', {}],
  ['PATCH', '/api/admin/tickets/bad-id/status', {}],
  ['PATCH', '/api/admin/tickets/bad-id/priority', {}],
  ['PATCH', '/api/admin/tickets/bad-id/category', {}],
  ['PATCH', '/api/admin/tickets/bad-id/block', {}],
  ['PATCH', '/api/admin/tickets/bad-id/unblock', {}],
  ['GET', '/api/admin/categories'],
  ['POST', '/api/admin/categories', {}],
  ['GET', '/api/admin/categories/bad-id'],
  ['PATCH', '/api/admin/categories/bad-id', {}],
  ['DELETE', '/api/admin/categories/bad-id'],
  ['GET', '/api/admin/sla'],
  ['POST', '/api/admin/sla', {}],
  ['GET', '/api/admin/sla/bad-id'],
  ['PATCH', '/api/admin/sla/bad-id', {}],
  ['DELETE', '/api/admin/sla/bad-id'],
  ['GET', '/api/tickets'],
  ['POST', '/api/tickets', {}],
  ['GET', '/api/tickets/bad-id'],
  ['POST', '/api/tickets/bad-id/messages', {}],
  ['PATCH', '/api/tickets/bad-id/status', {}],
  ['PATCH', '/api/tickets/bad-id/priority', {}],
];

test('health endpoint succeeds and unknown routes return 404', async () => {
  const health = await request('GET', '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal((await request('GET', '/does-not-exist')).status, 404);
});

test('every protected endpoint rejects missing authentication', async () => {
  for (const [method, path, body] of protectedEndpoints) {
    const response = await request(method, path, { body });
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});

test('every admin endpoint rejects an authenticated customer', async () => {
  currentRole = 'user';
  const adminEndpoints = protectedEndpoints.filter(([, path]) =>
    path.startsWith('/api/admin') || path.startsWith('/api/agents'),
  );

  for (const [method, path, body] of adminEndpoints) {
    const response = await request(method, path, { authenticated: true, body });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test('public auth endpoints reject malformed request bodies', async () => {
  const invalidAuthEndpoints = [
    '/api/auth/register',
    '/api/auth/verify-registration-otp',
    '/api/auth/login-password',
    '/api/auth/login-otp',
    '/api/auth/verify-login-otp',
    '/api/auth/refresh-token',
    '/api/auth/logout',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ];

  for (const path of invalidAuthEndpoints) {
    const response = await request('POST', path, { body: {} });
    assert.equal(response.status, 400, `POST ${path}`);
  }
  assert.equal((await request('POST', '/api/auth/logout-all', { body: {} })).status, 401);
});

test('authorized routes reject invalid ids, filters, and bodies before database access', async () => {
  currentRole = 'admin';
  const invalidAdminRequests = [
    ['POST', '/api/agents', {}],
    ['GET', '/api/agents/bad-id'],
    ['PATCH', '/api/agents/bad-id', {}],
    ['GET', '/api/admin/users/bad-id'],
    ['PATCH', '/api/admin/users/bad-id/block', {}],
    ['GET', '/api/admin/audit-logs?limit=0'],
    ['GET', '/api/admin/audit-logs/bad-id'],
    ['GET', '/api/admin/tickets?limit=101'],
    ['POST', '/api/admin/tickets', {}],
    ['GET', '/api/admin/tickets/bad-id'],
    ['PATCH', '/api/admin/tickets/bad-id/assign', {}],
    ['POST', '/api/admin/categories', {}],
    ['GET', '/api/admin/categories/bad-id'],
    ['PATCH', '/api/admin/categories/bad-id', {}],
    ['DELETE', '/api/admin/categories/bad-id'],
    ['POST', '/api/admin/sla', {}],
    ['GET', '/api/admin/sla/bad-id'],
    ['PATCH', '/api/admin/sla/bad-id', {}],
    ['DELETE', '/api/admin/sla/bad-id'],
  ];

  for (const [method, path, body] of invalidAdminRequests) {
    const response = await request(method, path, { authenticated: true, body });
    assert.equal(response.status, 400, `${method} ${path}`);
  }

  currentRole = 'user';
  const invalidTicketRequests = [
    ['GET', '/api/tickets?limit=0'],
    ['POST', '/api/tickets', {}],
    ['GET', '/api/tickets/bad-id'],
    ['POST', '/api/tickets/bad-id/messages', {}],
    ['PATCH', '/api/tickets/bad-id/status', {}],
  ];
  for (const [method, path, body] of invalidTicketRequests) {
    const response = await request(method, path, { authenticated: true, body });
    assert.equal(response.status, 400, `${method} ${path}`);
  }
  assert.equal((await request('PATCH', '/api/tickets/bad-id/priority', {
    authenticated: true,
    body: { priority: 'high' },
  })).status, 403);
});

test('authorized list endpoints return successful pagination responses', async () => {
  const originals = {
    userAggregate: User.aggregate,
    userCount: User.countDocuments,
    ticketFind: Ticket.find,
    ticketCount: Ticket.countDocuments,
    categoryFind: Category.find,
    categoryCount: Category.countDocuments,
    slaFind: SlaPolicy.find,
    slaCount: SlaPolicy.countDocuments,
    auditFind: AuditLog.find,
    auditCount: AuditLog.countDocuments,
  };
  const emptyQuery = () => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    populate() { return this; },
    lean: async () => [],
  });

  User.aggregate = async () => [];
  User.countDocuments = async () => 0;
  Ticket.find = emptyQuery;
  Ticket.countDocuments = async () => 0;
  Category.find = emptyQuery;
  Category.countDocuments = async () => 0;
  SlaPolicy.find = emptyQuery;
  SlaPolicy.countDocuments = async () => 0;
  AuditLog.find = emptyQuery;
  AuditLog.countDocuments = async () => 0;

  try {
    currentRole = 'admin';
    const listEndpoints = [
      '/api/agents',
      '/api/admin/users',
      '/api/admin/audit-logs',
      '/api/admin/tickets',
      '/api/admin/categories',
      '/api/admin/sla',
      '/api/tickets',
    ];
    const expected = { items: [], page: 1, limit: 20, total: 0, pages: 0 };

    for (const path of listEndpoints) {
      const response = await request('GET', path, { authenticated: true });
      assert.equal(response.status, 200, `GET ${path}`);
      assert.deepEqual(await response.json(), expected, `GET ${path}`);
    }
  } finally {
    User.aggregate = originals.userAggregate;
    User.countDocuments = originals.userCount;
    Ticket.find = originals.ticketFind;
    Ticket.countDocuments = originals.ticketCount;
    Category.find = originals.categoryFind;
    Category.countDocuments = originals.categoryCount;
    SlaPolicy.find = originals.slaFind;
    SlaPolicy.countDocuments = originals.slaCount;
    AuditLog.find = originals.auditFind;
    AuditLog.countDocuments = originals.auditCount;
  }
});

test('email endpoint enforces configuration and API key authentication', async () => {
  const originalApiKey = process.env.EMAIL_API_KEY;
  try {
    delete process.env.EMAIL_API_KEY;
    assert.equal((await request('POST', '/emails', { body: {} })).status, 503);

    process.env.EMAIL_API_KEY = 'endpoint-test-api-key';
    assert.equal((await request('POST', '/emails', {
      body: {},
      headers: { authorization: 'Bearer wrong-key' },
    })).status, 401);
    assert.equal((await request('POST', '/emails', {
      body: {},
      headers: { authorization: 'Bearer endpoint-test-api-key' },
    })).status, 400);
  } finally {
    if (originalApiKey === undefined) delete process.env.EMAIL_API_KEY;
    else process.env.EMAIL_API_KEY = originalApiKey;
  }
});
