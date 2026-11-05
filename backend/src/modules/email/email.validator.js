import mongoose from 'mongoose';
import { httpError } from '../../utils/http.js';

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

export function validateEmailPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw httpError('Email payload must be an object', 400);
  }

  const recipient = typeof input.recipient === 'string' ? input.recipient.trim().toLowerCase() : '';
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const text = typeof input.text === 'string' ? input.text : '';
  const html = typeof input.html === 'string' ? input.html : '';
  const replyTo = typeof input.replyTo === 'string' ? input.replyTo.trim().toLowerCase() : undefined;
  const { emailType, ticketId, idempotencyKey } = input;

  if (!emailPattern.test(recipient)) throw httpError('A valid recipient email is required', 400);
  if (!subject || subject.length > 500 || /[\r\n]/.test(subject)) {
    throw httpError('Subject is required and must be at most 500 characters', 400);
  }
  if (
    (input.text !== undefined && typeof input.text !== 'string') ||
    (input.html !== undefined && typeof input.html !== 'string')
  ) {
    throw httpError('Email text and HTML must be strings', 400);
  }
  if ((!text.trim() && !html.trim()) || text.length > 1_000_000 || html.length > 1_000_000) {
    throw httpError('Email text or HTML is required and must be at most 1 MB', 400);
  }
  if (replyTo !== undefined && !emailPattern.test(replyTo)) {
    throw httpError('replyTo must be a valid email address', 400);
  }
  if (!emailTypes.has(emailType)) throw httpError('A supported emailType is required', 400);

  assertPublicTicketReply(input);

  if (ticketId !== undefined && !mongoose.isValidObjectId(ticketId)) {
    throw httpError('ticketId must be a valid MongoDB ObjectId', 400);
  }
  if (
    idempotencyKey !== undefined &&
    (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200)
  ) {
    throw httpError('idempotencyKey must be a non-empty string of at most 200 characters', 400);
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

function assertPublicTicketReply(input) {
  if (input.emailType !== 'ticket_reply') return;

  const isInternal = input.isInternal === true ||
    input.type === 'internal' ||
    input.visibility === 'internal' ||
    input.ticketMessageType === 'internal';
  if (isInternal) {
    throw httpError('Internal ticket messages must never be emailed to customers', 400);
  }
  if (input.ticketMessageType !== 'public') {
    throw httpError('Only explicitly public ticket messages can be emailed', 400);
  }
}
