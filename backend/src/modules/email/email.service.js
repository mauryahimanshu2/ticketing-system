import { createHash, createHmac, randomUUID } from 'node:crypto';
import { httpError } from '../../utils/http.js';
import { redisConnection } from '../../config/redis.js';
import emailQueue from '../../queues/email.queue.js';
import {
  createQueuedEvent,
  findByIdempotencyKey,
  markEventFailed,
} from './email.repository.js';
import { encryptEmailPayload } from './emailPayloadCipher.js';
import { validateEmailPayload } from './email.validator.js';
const otpRateLimitScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fingerprintPayload(payload) {
  const sharedSecret = process.env.APPS_SCRIPT_SECRET;
  if (!sharedSecret) {
    throw httpError('APPS_SCRIPT_SECRET must be configured', 503);
  }

  const fingerprintKey = createHmac('sha256', sharedSecret)
    .update('ticketing-email-payload-fingerprint-v1')
    .digest();
  return createHmac('sha256', fingerprintKey)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function enforceOtpRateLimit(recipient) {
  const recipientHash = hash(recipient);
  const count = await redisConnection.eval(
    otpRateLimitScript,
    1,
    `email:otp-rate:${recipientHash}`,
    900,
  );

  if (Number(count) > 3) {
    throw httpError('OTP email rate limit exceeded; try again later', 429);
  }
}

function verifyExistingEvent(event, payloadHash) {
  if (event.payloadHash !== payloadHash) {
    throw httpError('idempotencyKey was already used for a different email', 409);
  }

  return {
    jobId: event.idempotencyKey,
    status: event.status,
    alreadyQueued: true,
  };
}

export async function enqueueEmail(input) {
  const payload = validateEmailPayload(input);
  const requestId = input.idempotencyKey?.trim() || randomUUID();
  const idempotencyKey = hash(requestId);
  const payloadHash = fingerprintPayload(payload);

  const existing = await findByIdempotencyKey(idempotencyKey);
  if (existing) {
    return verifyExistingEvent(existing, payloadHash);
  }

  const requiresPayloadEncryption = ['otp', 'password_reset'].includes(payload.emailType);
  const encryptedPayload = requiresPayloadEncryption ? encryptEmailPayload(payload) : undefined;

  if (payload.emailType === 'otp') {
    await enforceOtpRateLimit(payload.recipient);
  }

  const event = await createQueuedEvent({
    direction: 'outbound',
    status: 'queued',
    recipientEmail: payload.recipient,
    emailType: payload.emailType,
    ticketId: payload.ticketId || null,
    idempotencyKey,
    payloadHash,
  });

  if (!event) {
    throw new Error('Email event could not be created');
  }
  if (event.idempotencyKey !== idempotencyKey) {
    return verifyExistingEvent(event, payloadHash);
  }

  const jobData = {
    eventId: String(event._id),
    idempotencyKey,
    emailType: payload.emailType,
    ...(encryptedPayload
      ? { encryptedPayload }
      : { payload }),
  };

  try {
    await emailQueue.add('send-email', jobData, { jobId: idempotencyKey });
  } catch (error) {
    await markEventFailed(event._id, 'queue_unavailable');
    throw httpError('Email could not be queued', 503);
  }

  return { jobId: idempotencyKey, status: 'queued', alreadyQueued: false };
}
