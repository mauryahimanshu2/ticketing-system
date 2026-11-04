# Outbound email setup

The API enqueues jobs; it does not send mail synchronously. Configure the values in
`.env.example` in a local `backend/.env` file or the deployment environment. Do not
commit `.env`.

- `REDIS_URL` points to the Redis instance used by BullMQ and OTP throttling.
- `APPS_SCRIPT_URL` is the deployed Google Apps Script Web App URL.
- `APPS_SCRIPT_SECRET` is a long random shared secret used only between the worker
  and Apps Script.
- `EMAIL_API_KEY` protects `POST /emails` because this backend has no authentication
  middleware yet. Keep it server-side; never expose it to a browser.
- `EMAIL_PAYLOAD_ENCRYPTION_KEY` is a base64-encoded 32-byte AES key used to encrypt
  OTP message payloads stored in Redis. Generate one with
  `node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64'))"`.

## Deploy the Apps Script

1. Create a Google Apps Script project and copy `google-apps-script.gs` into it.
2. In **Project Settings → Script properties**, add `APPS_SCRIPT_SECRET` with the
   same value configured in the backend.
3. Deploy as a Web App, execute as the account that should send mail, and allow
   access to anyone. The endpoint is protected by the shared secret; use HTTPS.
4. Put the deployed `/exec` URL in `APPS_SCRIPT_URL`. The Apps Script account must
   have Gmail sending permission and sufficient quota.

The Apps Script uses a script lock and a six-hour `CacheService` entry to suppress
retries with the same idempotency key. This is best-effort: Google may evict cache
entries, and no Gmail API provides exactly-once sending if execution stops after
Gmail accepts a message but before the deduplication marker is stored.

## Enqueue a message

Send a server-to-server request with the API key. Use a stable idempotency key for
retries of the same logical email.

```http
POST /emails
Authorization: Bearer <EMAIL_API_KEY>
Content-Type: application/json
```

```json
{
  "recipient": "customer@example.com",
  "subject": "Ticket received",
  "text": "We received your request.",
  "html": "<p>We received your request.</p>",
  "emailType": "ticket_created",
  "ticketId": "64f000000000000000000001",
  "idempotencyKey": "ticket-123-created-v1"
}
```

A new job returns HTTP 202 and a job ID; this confirms queue acceptance, not email
delivery. `EmailEvent` is the durable audit record. BullMQ retries worker failures
with exponential backoff; the event becomes `sent` only after Apps Script responds
with JSON containing `success: true`, or `failed` after the final attempt.

For OTP messages, provide the `otp` email type; for password resets, use
`password_reset`. Configure the encryption key: both payloads are encrypted before
they enter BullMQ so OTPs and reset tokens are not stored in Redis in plaintext.
The worker limits general outbound delivery to 100 jobs per minute; OTP enqueue
requests have a separate limit of three per recipient per 15 minutes. Internal
ticket messages are rejected by the reply template and enqueue service; ticket
reply requests must explicitly set `ticketMessageType` to `public`.
