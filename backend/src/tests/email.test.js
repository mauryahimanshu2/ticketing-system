import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import EmailEvent from '../modules/email/emailEvent.model.js';
import { decryptEmailPayload, encryptEmailPayload } from '../modules/email/emailPayloadCipher.js';
import {
  queueCustomerAssignmentEmail,
  queueCustomerStatusEmail,
} from '../modules/ticket/ticket.notifications.js';
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

test('customer assignment and status emails include complete safe ticket details', async () => {
  const ticket = {
    _id: '000000000000000000000099',
    ticketNumber: 'TKT-99',
    subject: 'Cannot sign in',
    description: 'Login shows an error',
    priority: 'high',
    status: 'open',
    requesterEmail: 'customer@example.com',
    requesterId: { name: 'Customer' },
    category: { name: 'Account access' },
  };
  const agent = { name: 'Sam Support' };
  const queued = [];
  const enqueue = async (payload) => {
    queued.push(payload);
    return { status: 'queued' };
  };

  await queueCustomerAssignmentEmail(ticket, agent, enqueue);
  await queueCustomerStatusEmail(ticket, 'in_progress', enqueue);

  assert.equal(queued.length, 2);
  assert.equal(queued[0].recipient, ticket.requesterEmail);
  assert.equal(queued[0].emailType, 'ticket_assigned');
  assert.match(queued[0].text, /Sam Support/);
  assert.match(queued[0].text, /Cannot sign in/);
  assert.match(queued[0].text, /Login shows an error/);
  assert.match(queued[0].text, /Account access/);
  assert.equal(queued[1].emailType, 'ticket_status_update');
  assert.match(queued[1].text, /Status: in_progress/);
  assert.match(queued[1].text, /Priority: high/);
});

test('detailed ticket emails escape customer-controlled HTML', () => {
  const rendered = renderTicketAssignedEmail({
    name: '<script>name</script>',
    ticketNumber: 'T-1',
    subject: '<img src=x onerror=alert(1)>',
    description: '<script>description</script>',
    priority: 'high',
    status: 'open',
    categoryName: '<b>category</b>',
    agentName: '<script>agent</script>',
  });

  assert.equal(rendered.html.includes('<script>'), false);
  assert.equal(rendered.html.includes('<img'), false);
  assert.equal(rendered.html.includes('<b>category</b>'), false);
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
