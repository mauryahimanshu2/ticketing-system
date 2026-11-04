import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import EmailEvent from '../modules/email/emailEvent.model.js';
import { decryptEmailPayload, encryptEmailPayload } from '../modules/email/emailPayloadCipher.js';
import {
  renderOtpVerificationEmail,
  renderPasswordResetEmail,
  renderTicketAssignedEmail,
  renderTicketCreatedEmail,
  renderTicketReplyEmail,
  renderTicketStatusUpdateEmail,
  renderWelcomeEmail,
} from '../templates/email/index.js';

process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY = randomBytes(32).toString('base64');

test('encrypts OTP email contents before they are placed on a queue', () => {
  const payload = {
    recipient: 'user@example.com',
    subject: 'Verification',
    text: 'Your code is 482913',
    emailType: 'otp',
  };
  const encrypted = encryptEmailPayload(payload);

  assert.equal(JSON.stringify(encrypted).includes('482913'), false);
  assert.deepEqual(decryptEmailPayload(encrypted), payload);
});

test('encrypts password reset tokens before they are placed on a queue', () => {
  const payload = {
    recipient: 'user@example.com',
    subject: 'Reset your password',
    text: 'https://support.example.com/reset?token=private-token',
    emailType: 'password_reset',
  };
  const encrypted = encryptEmailPayload(payload);

  assert.equal(JSON.stringify(encrypted).includes('private-token'), false);
  assert.deepEqual(decryptEmailPayload(encrypted), payload);
});

test('renders all email types with HTML and plain text', () => {
  const templates = [
    renderOtpVerificationEmail({ name: 'Alex', otp: '482913' }),
    renderWelcomeEmail({ name: 'Alex' }),
    renderTicketCreatedEmail({ name: 'Alex', ticketNumber: 'T-1', subject: 'Help' }),
    renderTicketReplyEmail({
      name: 'Alex',
      ticketNumber: 'T-1',
      message: { type: 'public', body: 'We can help.' },
    }),
    renderTicketAssignedEmail({ name: 'Alex', ticketNumber: 'T-1', agentName: 'Sam' }),
    renderTicketStatusUpdateEmail({ name: 'Alex', ticketNumber: 'T-1', status: 'pending' }),
    renderPasswordResetEmail({ name: 'Alex', resetUrl: 'https://support.example.com/reset' }),
  ];

  for (const template of templates) {
    assert.ok(template.subject);
    assert.ok(template.text);
    assert.ok(template.html.includes('<!doctype html>'));
  }
});

test('escapes dynamic HTML and refuses internal ticket messages', () => {
  const template = renderWelcomeEmail({ name: '<script>alert(1)</script>' });
  assert.equal(template.html.includes('<script>'), false);
  assert.throws(
    () =>
      renderTicketReplyEmail({
        name: 'Alex',
        ticketNumber: 'T-1',
        message: { type: 'internal', body: 'Private note' },
      }),
    /Internal ticket messages/,
  );
});

test('rejects non-HTTPS password reset links', () => {
  assert.throws(
    () => renderPasswordResetEmail({ name: 'Alex', resetUrl: 'javascript:alert(1)' }),
    /HTTPS URL/,
  );
});

test('EmailEvent accepts outbound statuses and enforces idempotency index', async () => {
  const event = new EmailEvent({
    direction: 'outbound',
    status: 'queued',
    emailType: 'ticket_assigned',
    recipientEmail: 'USER@EXAMPLE.COM',
    idempotencyKey: 'a'.repeat(64),
    payloadHash: 'b'.repeat(64),
  });

  await event.validate();
  assert.equal(event.recipientEmail, 'user@example.com');
  assert.ok(
    EmailEvent.schema.indexes().some(
      ([fields, options]) => fields.idempotencyKey === 1 && options.unique === true,
    ),
  );
});
