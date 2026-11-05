import { randomBytes } from 'node:crypto';
import { httpError } from '../../utils/http.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createTicketReplyAddress() {
  const supportEmail = String(process.env.SUPPORT_EMAIL || '').trim().toLowerCase();
  if (!emailPattern.test(supportEmail)) {
    throw httpError('SUPPORT_EMAIL must be configured to request information by email', 503);
  }

  const [mailbox, domain] = supportEmail.split('@');
  const baseMailbox = mailbox.split('+')[0];
  const token = randomBytes(18).toString('base64url').toLowerCase();
  return `${baseMailbox}+ticket-${token}@${domain}`;
}
