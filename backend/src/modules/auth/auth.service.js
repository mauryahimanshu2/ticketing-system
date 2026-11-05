import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { renderOtpVerificationEmail } from '../../templates/email/index.js';
import * as userRepository from '../user/user.repository.js';
import {
  validateEmailInput,
  validateOtpInput,
  validatePasswordLoginInput,
  validateRefreshTokenInput,
  validateRegistrationInput,
  validateResetPasswordInput,
} from './auth.validator.js';
import { createTokenPair, hashRefreshToken } from './auth.token.js';

const REGISTRATION_TTL_SECONDS = 10 * 60;
const REGISTRATION_LOCK_TTL_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT = 3;
const OTP_RATE_WINDOW_SECONDS = 15 * 60;
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_SECONDS = 15 * 60;
const OTP_TTL_SECONDS = 10 * 60;
const AUTH_LOCK_TTL_MS = 30 * 1000;
const BCRYPT_ROUNDS = 12;

const rateLimitScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

const createPendingRegistrationScript = `
  local stored = redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX')
  if not stored then
    return 0
  end
  redis.call('SET', KEYS[2], '0', 'EX', ARGV[2])
  return 1
`;

const storeOtpScript = `
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
  redis.call('SET', KEYS[2], '0', 'EX', ARGV[2])
  return 1
`;

const releaseLockScript = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function emailKey(email) {
  return createHash('sha256').update(email).digest('hex');
}

function redisKeys(email) {
  const hash = emailKey(email);
  const prefix = `auth:registration:${hash}`;
  return {
    pending: `${prefix}:pending`,
    attempts: `${prefix}:attempts`,
    lock: `${prefix}:lock`,
  };
}

function flowKeys(flow, email) {
  const hash = emailKey(email);
  const prefix = `auth:${flow}:${hash}`;
  return {
    pending: `${prefix}:otp`,
    attempts: `${prefix}:attempts`,
    lock: `${prefix}:lock`,
    rate: `${prefix}:rate`,
  };
}

function hashRateIdentity(value) {
  return emailKey(String(value || 'unknown'));
}

function toPublicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

function createAuthError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function createAuthService({
  redis: injectedRedis,
  enqueueEmail: injectedEnqueueEmail,
  repository = userRepository,
  passwordHasher = bcrypt,
  otpGenerator = () => String(randomInt(0, 1_000_000)).padStart(6, '0'),
  tokenPairFactory = createTokenPair,
  now = () => new Date(),
} = {}) {
  async function getRedis() {
    if (injectedRedis) {
      return injectedRedis;
    }

    const { redisConnection } = await import('../../config/redis.js');
    return redisConnection;
  }

  async function getEnqueueEmail() {
    if (injectedEnqueueEmail) {
      return injectedEnqueueEmail;
    }

    const { enqueueEmail } = await import('../email/email.service.js');
    return enqueueEmail;
  }

  async function acquireLock(redis, key) {
    const token = randomUUID();
    const acquired = await redis.set(key, token, 'PX', REGISTRATION_LOCK_TTL_MS, 'NX');
    if (acquired !== 'OK') {
      throw new AuthError('Registration operation is already in progress', 409);
    }
    return token;
  }

  async function releaseLock(redis, key, token) {
    await redis.eval(releaseLockScript, 1, key, token);
  }

  async function removePending(redis, keys) {
    await redis.del(keys.pending, keys.attempts);
  }

  async function enforceRateLimit(redis, key, maxCount, windowSeconds) {
    const count = await redis.eval(rateLimitScript, 1, key, windowSeconds);
    if (Number(count) > maxCount) {
      throw createAuthError('Too many requests; try again later', 429);
    }
  }

  async function enforceOtpRequestLimits(redis, flow, email, ipAddress) {
    await enforceRateLimit(
      redis,
      `${flowKeys(flow, email).rate}:email`,
      OTP_RATE_LIMIT,
      OTP_RATE_WINDOW_SECONDS,
    );
    await enforceRateLimit(
      redis,
      `auth:${flow}:rate:ip:${hashRateIdentity(ipAddress)}`,
      OTP_RATE_LIMIT * 5,
      OTP_RATE_WINDOW_SECONDS,
    );
  }

  async function acquireFlowLock(redis, key) {
    const token = randomUUID();
    const acquired = await redis.set(key, token, 'PX', AUTH_LOCK_TTL_MS, 'NX');
    if (acquired !== 'OK') {
      throw createAuthError('Authentication operation is already in progress', 409);
    }
    return token;
  }

  async function releaseFlowLock(redis, key, token) {
    await redis.eval(releaseLockScript, 1, key, token);
  }

  async function queueOtpEmail({ email, name, otp }) {
    const rendered = renderOtpVerificationEmail({
      name,
      otp,
      expiresInMinutes: OTP_TTL_SECONDS / 60,
    });
    const enqueue = await getEnqueueEmail();
    return enqueue({
      recipient: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      emailType: 'otp',
      idempotencyKey: randomUUID(),
    });
  }

  async function issueTokens(
    user,
    context = {},
    sessionId = randomUUID(),
    expectedPasswordHash,
  ) {
    const issued = tokenPairFactory(user, sessionId, now());
    const added = await repository.addSession(
      user._id,
      {
        sessionId: issued.sessionId,
        tokenHash: issued.refreshTokenHash,
        previousTokenHashes: [],
        createdAt: now(),
        expiresAt: issued.expiresAt,
        ...(context.ipAddress ? { ipAddress: String(context.ipAddress).slice(0, 64) } : {}),
        ...(context.userAgent ? { userAgent: String(context.userAgent).slice(0, 500) } : {}),
      },
      now(),
      expectedPasswordHash,
    );
    if (!added) {
      throw createAuthError('Account is temporarily locked or unavailable', 423);
    }

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      tokenType: 'Bearer',
      refreshExpiresAt: issued.expiresAt,
      user: toPublicUser(user),
    };
  }

  async function issueOtp({ flow, email, name, ipAddress, shouldSend }) {
    const redis = await getRedis();
    await enforceOtpRequestLimits(redis, flow, email, ipAddress);

    const recipient = await shouldSend();
    if (!recipient) {
      return { status: 'accepted' };
    }

    const keys = flowKeys(flow, email);
    const lockToken = await acquireFlowLock(redis, keys.lock);
    try {
      const otp = otpGenerator();
      const otpHash = await passwordHasher.hash(otp, BCRYPT_ROUNDS);
      const saved = await redis.eval(
        storeOtpScript,
        2,
        keys.pending,
        keys.attempts,
        JSON.stringify({ otpHash }),
        OTP_TTL_SECONDS,
      );
      if (Number(saved) !== 1) {
        throw createAuthError('OTP could not be stored', 503);
      }

      try {
        await queueOtpEmail({
          email,
          name: typeof recipient === 'object' ? recipient.name : name,
          otp,
        });
      } catch (error) {
        await removePending(redis, keys);
        throw createAuthError('Verification email could not be queued', 503);
      }

      return { status: 'accepted' };
    } finally {
      await releaseFlowLock(redis, keys.lock, lockToken);
    }
  }

  async function verifyOtp(redis, keys, otp) {
    const storedJson = await redis.get(keys.pending);
    const attemptsValue = await redis.get(keys.attempts);
    if (!storedJson || attemptsValue === null) {
      throw createAuthError('OTP is invalid or expired', 400);
    }

    const stored = JSON.parse(storedJson);
    if (!(await passwordHasher.compare(otp, stored.otpHash))) {
      const attempts = await redis.incr(keys.attempts);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await removePending(redis, keys);
        throw createAuthError('Maximum OTP attempts exceeded', 429);
      }
      throw createAuthError('OTP is invalid or expired', 400);
    }

    return stored;
  }

  async function passwordLogin(input, context = {}) {
    const { email, password } = validatePasswordLoginInput(input);
    const redis = await getRedis();
    await enforceRateLimit(
      redis,
      `auth:login-password:rate:ip:${hashRateIdentity(context.ipAddress)}`,
      LOGIN_RATE_LIMIT * 5,
      LOGIN_RATE_WINDOW_SECONDS,
    );
    await enforceRateLimit(
      redis,
      `auth:login-password:rate:email:${emailKey(email)}`,
      LOGIN_RATE_LIMIT,
      LOGIN_RATE_WINDOW_SECONDS,
    );

    const user = await repository.findUserByEmailForAuth(email);
    if (!user) {
      await passwordHasher.hash(randomBytes(32).toString('base64url'), BCRYPT_ROUNDS);
      throw createAuthError('Invalid email or password', 401);
    }
    if (user.isBlocked) {
      throw createAuthError('Account is blocked', 403);
    }
    if (!user.isVerified) {
      throw createAuthError('Email verification is required', 403);
    }

    const currentTime = now();
    if (user.lockUntil && user.lockUntil > currentTime) {
      throw createAuthError('Account is temporarily locked', 423);
    }
    if (!(await passwordHasher.compare(password, user.passwordHash))) {
      await repository.recordFailedLogin(
        user._id,
        currentTime,
        MAX_LOGIN_ATTEMPTS,
        LOGIN_LOCK_DURATION_MS,
      );
      throw createAuthError('Invalid email or password', 401);
    }
    return issueTokens(user, context, randomUUID(), user.passwordHash);
  }

  async function requestLoginOtp(input, context = {}) {
    const { email } = validateEmailInput(input);
    await issueOtp({
      flow: 'login-otp',
      email,
      ipAddress: context.ipAddress,
      shouldSend: async () => {
        const user = await repository.findUserByEmailForAuth(email);
        return user?.role === 'user' && user.isVerified && !user.isBlocked ? user : null;
      },
    });
    return { status: 'accepted' };
  }

  async function verifyLoginOtp(input, context = {}) {
    const { email, otp } = validateOtpInput(input);
    const redis = await getRedis();
    const keys = flowKeys('login-otp', email);
    const lockToken = await acquireFlowLock(redis, keys.lock);
    try {
      await verifyOtp(redis, keys, otp);
      const user = await repository.findUserByEmail(email);
      if (!user || user.role !== 'user' || !user.isVerified || user.isBlocked) {
        await removePending(redis, keys);
        throw createAuthError('OTP is invalid or expired', 400);
      }

      await removePending(redis, keys);
      return await issueTokens(user, context, randomUUID(), user.passwordHash);
    } finally {
      await releaseFlowLock(redis, keys.lock, lockToken);
    }
  }

  async function rotateRefreshToken(input) {
    const { refreshToken } = validateRefreshTokenInput(input);
    const oldTokenHash = hashRefreshToken(refreshToken);
    const currentTime = now();
    const user = await repository.findSessionByTokenHash(oldTokenHash);
    if (user?.isBlocked) {
      await repository.revokeAllSessions(user._id);
      throw createAuthError('Account is blocked', 403);
    }
    if (!user) {
      const reusedTokenOwner = await repository.findSessionByPreviousTokenHash(oldTokenHash);
      if (reusedTokenOwner) {
        const reusedSession = reusedTokenOwner.sessions.find((session) =>
          session.previousTokenHashes.includes(oldTokenHash),
        );
        if (reusedSession) {
          await repository.revokeSessionById(reusedTokenOwner._id, reusedSession.sessionId);
        }
      }
      throw createAuthError('Invalid or revoked refresh token', 401);
    }

    const session = user.sessions.find((item) => item.tokenHash === oldTokenHash);
    if (!session || session.expiresAt <= currentTime) {
      if (session) {
        await repository.revokeSessionById(user._id, session.sessionId);
      }
      throw createAuthError('Invalid or expired refresh token', 401);
    }

    const issued = tokenPairFactory(user, session.sessionId, currentTime);
    const rotatedUser = await repository.rotateSessionToken({
      oldTokenHash,
      newTokenHash: issued.refreshTokenHash,
      expiresAt: issued.expiresAt,
      now: currentTime,
    });

    if (!rotatedUser) {
      const reusedTokenOwner = await repository.findSessionByPreviousTokenHash(oldTokenHash);
      if (reusedTokenOwner) {
        await repository.revokeSessionById(reusedTokenOwner._id, session.sessionId);
      }
      throw createAuthError('Invalid or revoked refresh token', 401);
    }

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      tokenType: 'Bearer',
      refreshExpiresAt: issued.expiresAt,
      user: toPublicUser(rotatedUser),
    };
  }

  async function logoutCurrentSession(input) {
    const { refreshToken } = validateRefreshTokenInput(input);
    const tokenHash = hashRefreshToken(refreshToken);
    await repository.revokeSessionByTokenHash(tokenHash);
    return { message: 'Session logged out' };
  }

  async function logoutAllSessions(userId) {
    await repository.revokeAllSessions(userId);
    return { message: 'All sessions logged out' };
  }

  async function requestPasswordReset(input, context = {}) {
    const { email } = validateEmailInput(input);
    await issueOtp({
      flow: 'password-reset',
      email,
      ipAddress: context.ipAddress,
      shouldSend: async () => {
        const user = await repository.findUserByEmail(email);
        return user?.role === 'user' && user.isVerified && !user.isBlocked ? user : null;
      },
    });
    return { status: 'accepted' };
  }

  async function resetPassword(input) {
    const { email, otp, newPassword } = validateResetPasswordInput(input);
    const redis = await getRedis();
    const keys = flowKeys('password-reset', email);
    const loginOtpKeys = flowKeys('login-otp', email);
    const lockToken = await acquireFlowLock(redis, keys.lock);
    let loginOtpLockToken;
    try {
      loginOtpLockToken = await acquireFlowLock(redis, loginOtpKeys.lock);
      await verifyOtp(redis, keys, otp);
      const user = await repository.findUserByEmail(email);
      if (!user || user.role !== 'user' || !user.isVerified || user.isBlocked) {
        await removePending(redis, keys);
        throw createAuthError('OTP is invalid or expired', 400);
      }
      const passwordHash = await passwordHasher.hash(newPassword, BCRYPT_ROUNDS);
      const result = await repository.resetPasswordAndRevokeSessions(email, passwordHash);
      if (result.matchedCount !== 1) {
        await removePending(redis, keys);
        throw createAuthError('OTP is invalid or expired', 400);
      }
      await removePending(redis, keys);
      await removePending(redis, loginOtpKeys);
      return { message: 'Password reset successfully. Please log in again.' };
    } finally {
      if (loginOtpLockToken) {
        await releaseFlowLock(redis, loginOtpKeys.lock, loginOtpLockToken);
      }
      await releaseFlowLock(redis, keys.lock, lockToken);
    }
  }

  async function register(input) {
    const registration = validateRegistrationInput(input);
    const redis = await getRedis();
    const keys = redisKeys(registration.email);
    const lockToken = await acquireLock(redis, keys.lock);
    let pendingJson;

    try {
      if (await repository.findUserByEmail(registration.email)) {
        throw new AuthError('An account with this email already exists', 409);
      }
      if (await redis.exists(keys.pending)) {
        throw new AuthError('A registration verification is already pending for this email', 409);
      }

      const otp = otpGenerator();
      const [passwordHash, otpHash] = await Promise.all([
        passwordHasher.hash(registration.password, BCRYPT_ROUNDS),
        passwordHasher.hash(otp, BCRYPT_ROUNDS),
      ]);
      const pendingRegistration = {
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
        passwordHash,
        otpHash,
      };
      pendingJson = JSON.stringify(pendingRegistration);

      const stored = await redis.eval(
        createPendingRegistrationScript,
        2,
        keys.pending,
        keys.attempts,
        pendingJson,
        REGISTRATION_TTL_SECONDS,
      );
      if (Number(stored) !== 1) {
        throw new AuthError('A registration verification is already pending for this email', 409);
      }

      const email = renderOtpVerificationEmail({
        name: registration.name,
        otp,
        expiresInMinutes: REGISTRATION_TTL_SECONDS / 60,
      });
      const enqueue = await getEnqueueEmail();
      let queuedEmail;
      try {
        queuedEmail = await enqueue({
          recipient: registration.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          emailType: 'otp',
          idempotencyKey: randomUUID(),
        });
      } catch (error) {
        await removePending(redis, keys);
        if (error.statusCode) {
          throw new AuthError('Registration verification email could not be queued', error.statusCode);
        }
        throw new AuthError('Registration verification email could not be queued', 503);
      }

      return { status: 'queued', jobId: queuedEmail.jobId };
    } finally {
      await releaseLock(redis, keys.lock, lockToken);
    }
  }

  async function verifyRegistrationOtp(input) {
    const { email, otp } = validateOtpInput(input);
    const redis = await getRedis();
    const keys = redisKeys(email);
    const lockToken = await acquireLock(redis, keys.lock);

    try {
      const pendingJson = await redis.get(keys.pending);
      if (!pendingJson) {
        throw new AuthError('Registration has expired or does not exist', 410);
      }

      const pending = JSON.parse(pendingJson);
      const attemptCount = await redis.get(keys.attempts);
      if (attemptCount === null) {
        await removePending(redis, keys);
        throw new AuthError('Registration has expired or does not exist', 410);
      }

      const matches = await passwordHasher.compare(otp, pending.otpHash);
      if (!matches) {
        const attempts = await redis.incr(keys.attempts);
        if (attempts >= MAX_OTP_ATTEMPTS) {
          await removePending(redis, keys);
          throw new AuthError('Maximum OTP attempts exceeded; start registration again', 429);
        }
        throw new AuthError('Invalid OTP', 400);
      }

      const existingUser = await repository.findUserByEmail(email);
      if (existingUser) {
        await removePending(redis, keys);
        throw new AuthError('An account with this email already exists', 409);
      }

      let user;
      try {
        user = await repository.createUser({
          name: pending.name,
          email: pending.email,
          phone: pending.phone,
          passwordHash: pending.passwordHash,
          role: 'user',
          isVerified: true,
        });
      } catch (error) {
        if (error.code === 11000) {
          await removePending(redis, keys);
          throw new AuthError('An account with this email already exists', 409);
        }
        throw error;
      }

      await removePending(redis, keys);
      return toPublicUser(user);
    } finally {
      await releaseLock(redis, keys.lock, lockToken);
    }
  }

  return {
    register,
    verifyRegistrationOtp,
    passwordLogin,
    requestLoginOtp,
    verifyLoginOtp,
    rotateRefreshToken,
    logoutCurrentSession,
    logoutAllSessions,
    requestPasswordReset,
    resetPassword,
  };
}

export const {
  register,
  verifyRegistrationOtp,
  passwordLogin,
  requestLoginOtp,
  verifyLoginOtp,
  rotateRefreshToken,
  logoutCurrentSession,
  logoutAllSessions,
  requestPasswordReset,
  resetPassword,
} = createAuthService();
