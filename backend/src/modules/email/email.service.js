import { createHash, createHmac, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { redisConnection } from '../../config/redis.js';
import emailQueue from '../../queues/email.queue.js';
import {
  createQueuedEvent,
  findByIdempotencyKey,
  markEventFailed,
} from './email.repository.js';
import { encryptEmailPayload } from './emailPayloadCipher.js';

const emailTypes = new Set([
  'otp',
  'welcome',
  'ticket_created',
  'ticket_reply',
  'ticket_assigned',
  'ticket_status_update',
  'ticket_notification',
  'password_reset',
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const otpRateLimitScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

function createRequestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validatePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createRequestError('Email payload must be an object', 400);
  }

  const recipient = typeof input.recipient === 'string' ? input.recipient.trim().toLowerCase() : '';
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const text = typeof input.text === 'string' ? input.text : '';
  const html = typeof input.html === 'string' ? input.html : '';
  const replyTo = typeof input.replyTo === 'string' ? input.replyTo.trim().toLowerCase() : undefined;
  const { emailType, ticketId, idempotencyKey } = input;

  if (!emailPattern.test(recipient)) {
    throw createRequestError('A valid recipient email is required', 400);
  }
  if (!subject || subject.length > 500 || /[\r\n]/.test(subject)) {
    throw createRequestError('Subject is required and must be at most 500 characters', 400);
  }
  if (
    (input.text !== undefined && typeof input.text !== 'string') ||
    (input.html !== undefined && typeof input.html !== 'string')
  ) {
    throw createRequestError('Email text and HTML must be strings', 400);
  }
  if ((!text.trim() && !html.trim()) || text.length > 1_000_000 || html.length > 1_000_000) {
    throw createRequestError('Email text or HTML is required and must be at most 1 MB', 400);
  }
  if (replyTo !== undefined && !emailPattern.test(replyTo)) {
    throw createRequestError('replyTo must be a valid email address', 400);
  }
  if (!emailTypes.has(emailType)) {
    throw createRequestError('A supported emailType is required', 400);
  }
  if (
    emailType === 'ticket_reply' &&
    (input.isInternal === true ||
      input.type === 'internal' ||
      input.visibility === 'internal' ||
      input.ticketMessageType === 'internal')
  ) {
    throw createRequestError('Internal ticket messages must never be emailed to customers', 400);
  }
  if (emailType === 'ticket_reply' && input.ticketMessageType !== 'public') {
    throw createRequestError('Only explicitly public ticket messages can be emailed', 400);
  }
  if (ticketId !== undefined && !mongoose.isValidObjectId(ticketId)) {
    throw createRequestError('ticketId must be a valid MongoDB ObjectId', 400);
  }
  if (
    idempotencyKey !== undefined &&
    (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200)
  ) {
    throw createRequestError('idempotencyKey must be a non-empty string of at most 200 characters', 400);
  }

  return {
    recipient,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
    emailType,
    ...(ticketId ? { ticketId: String(ticketId) } : {}),
  };
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fingerprintPayload(payload) {
  const sharedSecret = process.env.APPS_SCRIPT_SECRET;
  if (!sharedSecret) {
    throw createRequestError('APPS_SCRIPT_SECRET must be configured', 503);
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
    throw createRequestError('OTP email rate limit exceeded; try again later', 429);
  }
}

function verifyExistingEvent(event, payloadHash) {
  if (event.payloadHash !== payloadHash) {
    throw createRequestError('idempotencyKey was already used for a different email', 409);
  }

  return {
    jobId: event.idempotencyKey,
    status: event.status,
    alreadyQueued: true,
  };
}

export async function enqueueEmail(input) {
  const payload = validatePayload(input);
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
    throw createRequestError('Email could not be queued', 503);
  }

  return { jobId: idempotencyKey, status: 'queued', alreadyQueued: false };
}
