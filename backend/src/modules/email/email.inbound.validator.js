import { httpError } from '../../utils/http.js';
import { rejectUnknownFields } from '../../utils/validation.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inboundFields = new Set(['recipient', 'sender', 'messageId', 'inReplyTo', 'body']);

function normalizeEmail(value, label) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const bracketMatch = /<([^<>]+)>/.exec(text);
  const email = (bracketMatch?.[1] || text).trim();
  if (!emailPattern.test(email) || email.length > 254) {
    throw httpError(`A valid ${label} email is required`, 400);
  }
  return email;
}

function cleanReplyText(value) {
  if (typeof value !== 'string') return '';

  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const reply = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On .+wrote:$/i.test(trimmed) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) break;
    if (trimmed === '--') break;
    if (!trimmed.startsWith('>')) reply.push(line);
  }
  return reply.join('\n').trim();
}

export function validateInboundEmail(input) {
  rejectUnknownFields(input, inboundFields);
  const recipient = normalizeEmail(input.recipient, 'recipient');
  const sender = normalizeEmail(input.sender, 'sender');
  const messageId = typeof input.messageId === 'string' ? input.messageId.trim() : '';
  const inReplyTo = typeof input.inReplyTo === 'string' ? input.inReplyTo.trim() : '';
  const body = cleanReplyText(input.body);

  if (!messageId || messageId.length > 500) {
    throw httpError('A messageId of at most 500 characters is required', 400);
  }
  if (inReplyTo.length > 500) throw httpError('inReplyTo must be at most 500 characters', 400);
  if (!body || body.length > 20000) {
    throw httpError('Reply text is required and must be at most 20000 characters', 400);
  }

  return { recipient, sender, messageId, inReplyTo: inReplyTo || undefined, body };
}
