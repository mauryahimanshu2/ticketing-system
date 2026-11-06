import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import test from 'node:test';
import authRouter from '../modules/auth/auth.routes.js';
import { createAuthService } from '../modules/auth/auth.service.js';
import { authenticateAccessToken } from '../middleware/authenticate.js';
import { validateOtpInput, validateRegistrationInput } from '../modules/auth/auth.validator.js';

process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('base64url');

class MemoryRedis {
  constructor() {
    this.values = new Map();
  }

  current(key) {
    const entry = this.values.get(key);
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry;
  }

  async set(key, value, ...options) {
    const existing = this.current(key);
    if (options.includes('NX') && existing) {
      return null;
    }
    const pxIndex = options.indexOf('PX');
    const exIndex = options.indexOf('EX');
    const expiresAt = pxIndex >= 0
      ? Date.now() + Number(options[pxIndex + 1])
      : exIndex >= 0
        ? Date.now() + Number(options[exIndex + 1]) * 1000
        : undefined;
    this.values.set(key, { value: String(value), expiresAt });
    return 'OK';
  }

  async get(key) {
    return this.current(key)?.value ?? null;
  }

  async exists(key) {
    return this.current(key) ? 1 : 0;
  }

  async del(...keys) {
    let removed = 0;
    for (const key of keys) {
      removed += this.values.delete(key) ? 1 : 0;
    }
    return removed;
  }

  async incr(key) {
    const current = this.current(key);
    const value = Number(current?.value || 0) + 1;
    this.values.set(key, { value: String(value), expiresAt: current?.expiresAt });
    return value;
  }

  async eval(script, keyCount, ...args) {
    if (script.includes("local count = redis.call('INCR'")) {
      const [key, ttlSeconds] = args;
      const count = await this.incr(key);
      if (count === 1) {
        this.current(key).expiresAt = Date.now() + Number(ttlSeconds) * 1000;
      }
      return count;
    }

    if (keyCount === 1) {
      const [key, token] = args;
      if (await this.get(key) === token) {
        return this.del(key);
      }
      return 0;
    }

    const [pendingKey, attemptsKey, pendingValue, ttlSeconds] = args;
    if (script.includes('local stored')) {
      if (await this.exists(pendingKey)) {
        return 0;
      }
      await this.set(pendingKey, pendingValue, 'EX', ttlSeconds, 'NX');
      await this.set(attemptsKey, '0', 'EX', ttlSeconds);
      return 1;
    }
    await this.set(pendingKey, pendingValue, 'EX', ttlSeconds);
    await this.set(attemptsKey, '0', 'EX', ttlSeconds);
    return 1;
  }

  expireNow(key) {
    this.values.delete(key);
  }
}

function createHarness({ existingUsers = [], now } = {}) {
  const redis = new MemoryRedis();
  const users = new Map(existingUsers.map((user, index) => [
    user.email,
    {
      _id: user._id || `existing-${index + 1}`,
      name: user.name || 'Existing User',
      role: user.role || 'user',
      isVerified: user.isVerified ?? true,
      loginAttempts: 0,
      sessions: [],
      ...user,
    },
  ]));
  const emails = [];
  let nextId = 1;
  const repository = {
    async findUserByEmail(email) {
      return users.get(email) || null;
    },
    async createUser(userData) {
      if (users.has(userData.email)) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      const user = {
        ...userData,
        _id: String(nextId++),
        createdAt: new Date(),
      };
      users.set(user.email, user);
      return user;
    },
    async findUserByEmailForAuth(email) {
      return users.get(email) || null;
    },
    async addSession(userId, session, currentTime = new Date(), expectedPasswordHash) {
      const user = [...users.values()].find((item) => item._id === String(userId));
      if (!user || !user.isVerified || (user.lockUntil && user.lockUntil > currentTime)) return false;
      if (expectedPasswordHash && user.passwordHash !== expectedPasswordHash) return false;
      user.sessions.push(session);
      user.loginAttempts = 0;
      user.lockUntil = null;
      return true;
    },
    async recordFailedLogin(userId, currentTime, maxAttempts, lockDurationMs) {
      const user = [...users.values()].find((item) => item._id === String(userId));
      if (!user || (user.lockUntil && user.lockUntil > currentTime)) return;
      if (user.lockUntil && user.lockUntil <= currentTime) {
        user.loginAttempts = 0;
        user.lockUntil = null;
      }
      user.loginAttempts += 1;
      if (user.loginAttempts >= maxAttempts) {
        user.lockUntil = new Date(currentTime.getTime() + lockDurationMs);
      }
    },
    async findSessionByTokenHash(tokenHash) {
      return [...users.values()].find((user) =>
        user.sessions.some((session) => session.tokenHash === tokenHash),
      ) || null;
    },
    async findSessionByPreviousTokenHash(tokenHash) {
      return [...users.values()].find((user) =>
        user.sessions.some((session) => session.previousTokenHashes.includes(tokenHash)),
      ) || null;
    },
    async rotateSessionToken({ oldTokenHash, newTokenHash, expiresAt, now }) {
      const user = await this.findSessionByTokenHash(oldTokenHash);
      const session = user?.sessions.find((item) =>
        item.tokenHash === oldTokenHash && item.expiresAt > now,
      );
      if (!session) return null;
      session.previousTokenHashes.push(oldTokenHash);
      session.tokenHash = newTokenHash;
      session.expiresAt = expiresAt;
      return user;
    },
    async revokeSessionById(userId, sessionId) {
      const user = [...users.values()].find((item) => item._id === String(userId));
      if (user) user.sessions = user.sessions.filter((session) => session.sessionId !== sessionId);
    },
    async revokeSessionByTokenHash(tokenHash) {
      for (const user of users.values()) {
        user.sessions = user.sessions.filter((session) =>
          session.tokenHash !== tokenHash && !session.previousTokenHashes.includes(tokenHash),
        );
      }
    },
    async revokeAllSessions(userId) {
      const user = [...users.values()].find((item) => item._id === String(userId));
      if (user) user.sessions = [];
    },
    async hasActiveSession(userId, sessionId, currentTime = new Date()) {
      const user = [...users.values()].find((item) => item._id === String(userId));
      return Boolean(user?.sessions.some(
        (session) => session.sessionId === sessionId && session.expiresAt > currentTime,
      ));
    },
    async resetPasswordAndRevokeSessions(email, passwordHash) {
      const user = users.get(email);
      if (!user || !user.isVerified) return { matchedCount: 0 };
      user.passwordHash = passwordHash;
      user.sessions = [];
      user.loginAttempts = 0;
      user.lockUntil = null;
      return { matchedCount: 1 };
    },
  };
  const service = createAuthService({
    redis,
    repository,
    passwordHasher: {
      hash: (value) => bcrypt.hash(value, 4),
      compare: bcrypt.compare,
    },
    otpGenerator: () => '123456',
    ...(now ? { now } : {}),
    enqueueEmail: async (payload) => {
      emails.push(payload);
      return { jobId: 'email-job-1', status: 'queued' };
    },
  });

  return { service, redis, users, emails };
}

const validRegistration = {
  name: 'Taylor User',
  email: 'Taylor@example.com',
  phone: '+1 (415) 555-0134',
  password: 'a-secure-password',
};

async function makeExistingUser(overrides = {}) {
  return {
    name: 'Existing User',
    email: 'existing@example.com',
    phone: '+14155550199',
    passwordHash: await bcrypt.hash('StrongPassword123', 4),
    role: 'user',
    isVerified: true,
    ...overrides,
  };
}

function extractOtp(emailPayload) {
  return emailPayload.text.match(/verification code is: (\d{6})/i)?.[1];
}

test('registration stores only password and OTP hashes and queues OTP to recipient', async () => {
  const { service, redis, users, emails } = createHarness();

  const result = await service.register(validRegistration);

  assert.deepEqual(result, { status: 'queued', jobId: 'email-job-1' });
  assert.equal(users.size, 0);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].recipient, 'taylor@example.com');
  assert.equal(emails[0].emailType, 'otp');
  assert.ok(emails[0].idempotencyKey);
  assert.equal(Object.hasOwn(emails[0], 'to'), false);

  const pending = [...redis.values.values()].find((entry) => entry.value.includes('"otpHash"'));
  assert.ok(pending);
  assert.equal(pending.value.includes('123456'), false);
  assert.equal(pending.value.includes(validRegistration.password), false);
  assert.ok(JSON.parse(pending.value).passwordHash.startsWith('$2'));
});

test('correct OTP creates a verified user with the forced user role and clears Redis keys', async () => {
  const { service, redis, users } = createHarness();
  await service.register(validRegistration);

  const user = await service.verifyRegistrationOtp({ email: 'TAYLOR@example.com', otp: '123456' });

  assert.equal(users.size, 1);
  assert.equal(user.email, 'taylor@example.com');
  assert.equal(user.role, 'user');
  assert.equal(user.isVerified, true);
  assert.equal(Object.hasOwn(user, 'passwordHash'), false);
  assert.equal([...redis.values.keys()].some((key) => key.includes(':pending') || key.includes(':attempts')), false);
});

test('wrong OTP is rejected and registration is removed after five attempts', async () => {
  const { service, users } = createHarness();
  await service.register(validRegistration);

  for (let attempt = 1; attempt < 5; attempt += 1) {
    await assert.rejects(
      service.verifyRegistrationOtp({ email: validRegistration.email, otp: '000000' }),
      { statusCode: 400 },
    );
  }
  await assert.rejects(
    service.verifyRegistrationOtp({ email: validRegistration.email, otp: '000000' }),
    { statusCode: 429 },
  );
  await assert.rejects(
    service.verifyRegistrationOtp({ email: validRegistration.email, otp: '123456' }),
    { statusCode: 410 },
  );
  assert.equal(users.size, 0);
});

test('OTP request and verification limits can be disabled for local development', async () => {
  const originalValue = process.env.OTP_LIMITS_ENABLED;
  process.env.OTP_LIMITS_ENABLED = 'false';
  try {
    const { service, users } = createHarness();
    await service.register(validRegistration);

    for (let attempt = 0; attempt < 7; attempt += 1) {
      await assert.rejects(
        service.verifyRegistrationOtp({ email: validRegistration.email, otp: '000000' }),
        { statusCode: 400 },
      );
    }

    await service.verifyRegistrationOtp({
      email: validRegistration.email,
      otp: '123456',
    });
    assert.equal(users.size, 1);

    for (let request = 0; request < 7; request += 1) {
      await service.requestPasswordReset({ email: validRegistration.email });
    }
  } finally {
    if (originalValue === undefined) delete process.env.OTP_LIMITS_ENABLED;
    else process.env.OTP_LIMITS_ENABLED = originalValue;
  }
});

test('expired pending registration cannot be verified', async () => {
  const { service, redis } = createHarness();
  await service.register(validRegistration);

  const pendingKey = [...redis.values.keys()].find((key) => key.endsWith(':pending'));
  const attemptsKey = [...redis.values.keys()].find((key) => key.endsWith(':attempts'));
  redis.expireNow(pendingKey);
  redis.expireNow(attemptsKey);

  await assert.rejects(
    service.verifyRegistrationOtp({ email: validRegistration.email, otp: '123456' }),
    { statusCode: 410 },
  );
});

test('duplicate email is rejected and repeated verification does not create another user', async () => {
  const { service, users } = createHarness({
    existingUsers: [{ email: 'taylor@example.com' }],
  });
  await assert.rejects(service.register(validRegistration), { statusCode: 409 });

  users.clear();
  await service.register(validRegistration);
  await service.verifyRegistrationOtp({ email: validRegistration.email, otp: '123456' });
  await assert.rejects(
    service.verifyRegistrationOtp({ email: validRegistration.email, otp: '123456' }),
    { statusCode: 410 },
  );
  assert.equal(users.size, 1);
});

test('MongoDB duplicate-key race is returned as conflict and consumes the pending registration', async () => {
  const redis = new MemoryRedis();
  const duplicateRepository = {
    async findUserByEmail() {
      return null;
    },
    async createUser() {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    },
  };
  const duplicateService = createAuthService({
    redis,
    repository: duplicateRepository,
    passwordHasher: {
      hash: (value) => bcrypt.hash(value, 4),
      compare: bcrypt.compare,
    },
    otpGenerator: () => '654321',
    enqueueEmail: async () => ({ jobId: 'email-job-2', status: 'queued' }),
  });

  await duplicateService.register(validRegistration);
  await assert.rejects(
    duplicateService.verifyRegistrationOtp({ email: validRegistration.email, otp: '654321' }),
    { statusCode: 409 },
  );
  assert.equal([...redis.values.keys()].some((key) => key.endsWith(':pending')), false);
});

test('email queue failure removes the pending registration and does not report acceptance', async () => {
  const redis = new MemoryRedis();
  const service = createAuthService({
    redis,
    repository: {
      async findUserByEmail() {
        return null;
      },
      async createUser() {
        throw new Error('should not create before verification');
      },
    },
    passwordHasher: {
      hash: (value) => bcrypt.hash(value, 4),
      compare: bcrypt.compare,
    },
    otpGenerator: () => '123456',
    enqueueEmail: async () => {
      throw new Error('queue unavailable');
    },
  });

  await assert.rejects(service.register(validRegistration), { statusCode: 503 });
  assert.equal(redis.values.size, 0);
});

test('concurrent OTP verification creates at most one account', async () => {
  const { service, users } = createHarness();
  await service.register(validRegistration);

  const results = await Promise.allSettled([
    service.verifyRegistrationOtp({ email: validRegistration.email, otp: '123456' }),
    service.verifyRegistrationOtp({ email: validRegistration.email, otp: '123456' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);
  assert.equal(users.size, 1);
});

test('validators reject privileged registration fields and malformed OTP requests', () => {
  assert.throws(
    () => validateRegistrationInput({ ...validRegistration, role: 'admin' }),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateRegistrationInput({ ...validRegistration, passwordHash: 'attacker-hash' }),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateOtpInput({ email: validRegistration.email, otp: 123456 }),
    { statusCode: 400 },
  );
});

test('auth routes expose the requested paths and return validation errors', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
    const registration = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validRegistration, role: 'admin' }),
    });
    const verification = await fetch(`${baseUrl}/verify-registration-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: validRegistration.email, otp: 'bad' }),
    });
    const invalidAuthPaths = [
      '/login-password',
      '/login-otp',
      '/verify-login-otp',
      '/refresh-token',
      '/logout',
      '/forgot-password',
      '/reset-password',
    ];
    const invalidAuthResponses = await Promise.all(invalidAuthPaths.map((path) =>
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    ));
    const unauthenticatedLogoutAll = await fetch(`${baseUrl}/logout-all`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(registration.status, 400);
    assert.equal(verification.status, 400);
    assert.ok(invalidAuthResponses.every((response) => response.status === 400));
    assert.equal(unauthenticatedLogoutAll.status, 401);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('password login returns tokens and stores only a hashed refresh token per device', async () => {
  const existingUser = await makeExistingUser();
  const { service, users } = createHarness({ existingUsers: [existingUser] });

  const firstLogin = await service.passwordLogin({
    email: existingUser.email,
    password: 'StrongPassword123',
  }, { ipAddress: '127.0.0.1', userAgent: 'test-agent' });
  const secondLogin = await service.passwordLogin({
    email: existingUser.email,
    password: 'StrongPassword123',
  });
  const storedUser = users.get(existingUser.email);

  assert.ok(firstLogin.accessToken);
  assert.ok(firstLogin.refreshToken);
  assert.equal(firstLogin.user.email, existingUser.email);
  assert.equal(storedUser.sessions.length, 2);
  assert.notEqual(storedUser.sessions[0].sessionId, storedUser.sessions[1].sessionId);
  assert.equal(storedUser.sessions[0].tokenHash, createHash('sha256').update(firstLogin.refreshToken).digest('hex'));
  assert.notEqual(storedUser.sessions[0].tokenHash, firstLogin.refreshToken);
  assert.notEqual(storedUser.sessions[1].tokenHash, secondLogin.refreshToken);
});

test('shared password login accepts customer, agent, and admin accounts', async () => {
  const users = await Promise.all([
    makeExistingUser({ email: 'role-user@example.com', role: 'user' }),
    makeExistingUser({ email: 'role-agent@example.com', role: 'agent' }),
    makeExistingUser({ email: 'role-admin@example.com', role: 'admin' }),
  ]);
  const { service, users: storedUsers } = createHarness({ existingUsers: users });
  for (const user of users) {
    const result = await service.passwordLogin({
      email: user.email,
      password: 'StrongPassword123',
    });
    assert.equal(result.user.role, user.role);
    assert.ok(result.accessToken);
    assert.ok(result.refreshToken);
    assert.equal(storedUsers.get(user.email).sessions.length, 1);
  }
});

test('password login rejects invalid passwords, unverified users and locks repeated failures', async () => {
  const user = await makeExistingUser();
  const unverifiedUser = await makeExistingUser({
    email: 'unverified@example.com',
    isVerified: false,
  });
  const { service, users } = createHarness({ existingUsers: [user, unverifiedUser] });

  await assert.rejects(
    service.passwordLogin({ email: user.email, password: 'incorrect-password' }),
    { statusCode: 401 },
  );
  await assert.rejects(
    service.passwordLogin({ email: unverifiedUser.email, password: 'StrongPassword123' }),
    { statusCode: 403 },
  );

  for (let attempt = 1; attempt < 5; attempt += 1) {
    await assert.rejects(
      service.passwordLogin({ email: user.email, password: 'incorrect-password' }),
      { statusCode: 401 },
    );
  }
  await assert.rejects(
    service.passwordLogin({ email: user.email, password: 'StrongPassword123' }),
    { statusCode: 423 },
  );
  assert.equal(users.get(user.email).loginAttempts, 5);
});

test('blocked accounts cannot log in or refresh, and only customers can use OTP recovery', async () => {
  const agent = await makeExistingUser({ email: 'agent@example.com', role: 'agent' });
  const blockedUser = await makeExistingUser({ email: 'blocked@example.com', isBlocked: true });
  const { service, users, emails } = createHarness({ existingUsers: [agent, blockedUser] });

  await assert.rejects(
    service.passwordLogin({ email: blockedUser.email, password: 'StrongPassword123' }),
    { statusCode: 403 },
  );
  await assert.rejects(
    service.requestLoginOtp({ email: agent.email }),
    { statusCode: 404 },
  );
  await assert.rejects(
    service.requestLoginOtp({ email: blockedUser.email }),
    { statusCode: 404 },
  );
  await service.requestPasswordReset({ email: agent.email });
  assert.equal(emails.length, 0);

  users.get(blockedUser.email).isBlocked = false;
  const issued = await service.passwordLogin({
    email: blockedUser.email,
    password: 'StrongPassword123',
  });
  users.get(blockedUser.email).isBlocked = true;
  await assert.rejects(
    service.rotateRefreshToken({ refreshToken: issued.refreshToken }),
    { statusCode: 403 },
  );
  assert.equal(users.get(blockedUser.email).sessions.length, 0);
});

test('login OTP rejects unknown customer emails without storing or sending an OTP', async () => {
  const { service, redis, emails } = createHarness();

  await assert.rejects(
    service.requestLoginOtp({ email: 'unknown@example.com' }),
    {
      statusCode: 404,
      message: 'No active customer account was found with this email',
    },
  );

  assert.equal(emails.length, 0);
  assert.equal(
    [...redis.values.keys()].some((key) =>
      key.startsWith('auth:login-otp:') &&
      (key.endsWith(':otp') || key.endsWith(':attempts')),
    ),
    false,
  );
});

test('expired password lockout resets the failed-attempt counter', async () => {
  let currentTime = new Date('2025-01-01T00:00:00.000Z');
  const user = await makeExistingUser();
  const { service, users } = createHarness({
    existingUsers: [user],
    now: () => currentTime,
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(
      service.passwordLogin({ email: user.email, password: 'incorrect-password' }),
      { statusCode: 401 },
    );
  }
  await assert.rejects(
    service.passwordLogin({ email: user.email, password: 'StrongPassword123' }),
    { statusCode: 423 },
  );

  currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000 + 1);
  await assert.rejects(
    service.passwordLogin({ email: user.email, password: 'incorrect-password' }),
    { statusCode: 401 },
  );
  assert.equal(users.get(user.email).loginAttempts, 1);
  assert.equal(users.get(user.email).lockUntil, null);
});

test('login OTP uses the queue, rejects wrong/expired OTPs and enforces five attempts', async () => {
  const user = await makeExistingUser();
  const { service, redis, emails } = createHarness({ existingUsers: [user] });
  const request = await service.requestLoginOtp({ email: user.email });

  assert.deepEqual(request, { status: 'accepted' });
  assert.equal(emails[0].recipient, user.email);
  assert.equal(emails[0].emailType, 'otp');
  await assert.rejects(
    service.verifyLoginOtp({ email: user.email, otp: '000000' }),
    { statusCode: 400 },
  );

  const keys = [...redis.values.keys()].filter((key) => key.startsWith('auth:login-otp:'));
  const otpKey = keys.find((key) => key.endsWith(':otp'));
  const attemptsKey = keys.find((key) => key.endsWith(':attempts'));
  redis.expireNow(otpKey);
  redis.expireNow(attemptsKey);
  await assert.rejects(
    service.verifyLoginOtp({ email: user.email, otp: '123456' }),
    { statusCode: 400 },
  );

  await service.requestLoginOtp({ email: user.email });
  for (let attempt = 1; attempt < 5; attempt += 1) {
    await assert.rejects(
      service.verifyLoginOtp({ email: user.email, otp: '000000' }),
      { statusCode: 400 },
    );
  }
  await assert.rejects(
    service.verifyLoginOtp({ email: user.email, otp: '000000' }),
    { statusCode: 429 },
  );
});

test('successful OTP login consumes the OTP and returns access and refresh tokens', async () => {
  const user = await makeExistingUser();
  const { service, redis, users } = createHarness({ existingUsers: [user] });
  await service.requestLoginOtp({ email: user.email });

  const result = await service.verifyLoginOtp({ email: user.email, otp: '123456' });

  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(users.get(user.email).sessions.length, 1);
  assert.equal(
    [...redis.values.keys()].some(
      (key) =>
        key.startsWith('auth:login-otp:') &&
        (key.endsWith(':otp') || key.endsWith(':attempts')),
    ),
    false,
  );
  await assert.rejects(
    service.verifyLoginOtp({ email: user.email, otp: '123456' }),
    { statusCode: 400 },
  );
});

test('refresh rotates tokens, allows multiple sessions, and revokes a session on token reuse', async () => {
  const user = await makeExistingUser();
  const { service, users } = createHarness({ existingUsers: [user] });
  const firstSession = await service.passwordLogin({ email: user.email, password: 'StrongPassword123' });
  const otherSession = await service.passwordLogin({ email: user.email, password: 'StrongPassword123' });
  const rotated = await service.rotateRefreshToken({ refreshToken: firstSession.refreshToken });

  assert.notEqual(rotated.refreshToken, firstSession.refreshToken);
  assert.equal(users.get(user.email).sessions.length, 2);
  await assert.rejects(
    service.rotateRefreshToken({ refreshToken: firstSession.refreshToken }),
    { statusCode: 401 },
  );
  assert.equal(users.get(user.email).sessions.length, 1);
  assert.equal(
    users.get(user.email).sessions[0].tokenHash,
    createHash('sha256').update(otherSession.refreshToken).digest('hex'),
  );
  await assert.rejects(
    service.rotateRefreshToken({ refreshToken: rotated.refreshToken }),
    { statusCode: 401 },
  );
});

test('expired refresh token is rejected and its session is revoked', async () => {
  const user = await makeExistingUser();
  const now = new Date();
  const { service, users } = createHarness({ existingUsers: [user] });
  const expiredToken = randomBytes(64).toString('base64url');
  users.get(user.email).sessions.push({
    sessionId: 'expired-session',
    tokenHash: createHash('sha256').update(expiredToken).digest('hex'),
    previousTokenHashes: [],
    createdAt: new Date(now.getTime() - 10_000),
    expiresAt: new Date(now.getTime() - 1),
  });

  await assert.rejects(
    service.rotateRefreshToken({ refreshToken: expiredToken }),
    { statusCode: 401 },
  );
  assert.equal(users.get(user.email).sessions.length, 0);
});

test('logout current session and logout-all revoke refresh sessions', async () => {
  const user = await makeExistingUser();
  const { service, users } = createHarness({ existingUsers: [user] });
  const first = await service.passwordLogin({ email: user.email, password: 'StrongPassword123' });
  const second = await service.passwordLogin({ email: user.email, password: 'StrongPassword123' });

  await service.logoutCurrentSession({ refreshToken: first.refreshToken });
  assert.equal(users.get(user.email).sessions.length, 1);
  await assert.rejects(
    service.rotateRefreshToken({ refreshToken: first.refreshToken }),
    { statusCode: 401 },
  );

  await service.logoutAllSessions(users.get(user.email)._id);
  assert.equal(users.get(user.email).sessions.length, 0);
  await assert.rejects(
    service.rotateRefreshToken({ refreshToken: second.refreshToken }),
    { statusCode: 401 },
  );
});

test('forgot password response is generic and password reset revokes every session', async () => {
  const user = await makeExistingUser();
  const { service, users, emails } = createHarness({ existingUsers: [user] });
  const login = await service.passwordLogin({ email: user.email, password: 'StrongPassword123' });
  await service.requestLoginOtp({ email: user.email });
  const genericResponse = await service.requestPasswordReset({ email: user.email });

  assert.deepEqual(genericResponse, { status: 'accepted' });
  assert.equal(emails[0].emailType, 'otp');
  assert.equal(emails[1].emailType, 'password_reset');
  const otp = extractOtp(emails[1]);
  assert.match(otp, /^\d{6}$/);
  await assert.rejects(
    service.resetPassword({ email: user.email, otp: '000000', newPassword: 'NewStrongPassword123' }),
    { statusCode: 400 },
  );

  await service.resetPassword({
    email: user.email,
    otp,
    newPassword: 'NewStrongPassword123',
  });
  assert.equal(users.get(user.email).sessions.length, 0);
  await assert.rejects(
    service.verifyLoginOtp({ email: user.email, otp: '123456' }),
    { statusCode: 400 },
  );
  await assert.rejects(
    service.rotateRefreshToken({ refreshToken: login.refreshToken }),
    { statusCode: 401 },
  );
  await assert.rejects(
    service.passwordLogin({ email: user.email, password: 'StrongPassword123' }),
    { statusCode: 401 },
  );
  const newLogin = await service.passwordLogin({
    email: user.email,
    password: 'NewStrongPassword123',
  });
  assert.ok(newLogin.refreshToken);
  assert.equal(await bcrypt.compare('NewStrongPassword123', users.get(user.email).passwordHash), true);
});

test('forgot password returns the same generic response for an unknown account', async () => {
  const { service, emails } = createHarness();
  assert.deepEqual(
    await service.requestPasswordReset({ email: 'unknown@example.com' }),
    { status: 'accepted' },
  );
  assert.equal(emails.length, 0);
});

test('access tokens are signed and contain user id and role', async () => {
  const user = await makeExistingUser();
  const { service } = createHarness({ existingUsers: [user] });
  const result = await service.passwordLogin({ email: user.email, password: 'StrongPassword123' });
  const { verifyAccessToken } = await import('../modules/auth/auth.token.js');
  const payload = verifyAccessToken(result.accessToken);

  assert.equal(payload.sub, 'existing-1');
  assert.equal(payload.role, user.role);
  assert.ok(payload.exp > payload.iat);
});
