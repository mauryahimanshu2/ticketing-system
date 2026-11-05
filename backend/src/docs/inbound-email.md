# Text-only email replies

Agents and admins can ask a customer for more information with:

```http
POST /api/tickets/:ticketId/request-information
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "message": "Please reply with the transaction reference and the error text."
}
```

The endpoint adds a public ticket message, moves the ticket to `pending`, and sends
an email with a unique reply address. This workflow accepts plain text replies only.

## Backend configuration

Add these values to `backend/.env` or the deployment environment:

```env
SUPPORT_EMAIL=your-support-account@gmail.com
INBOUND_EMAIL_SECRET=generate-a-long-random-secret
```

`SUPPORT_EMAIL` must be the Gmail account used by the Apps Script. The backend
creates plus-addresses such as `support+ticket-<random-token>@gmail.com` so a reply
can be mapped to one ticket. The sender address must match the ticket requester.

## Apps Script configuration

Copy the latest `google-apps-script.gs` into the existing Apps Script project. Add
these Script properties:

- `SUPPORT_EMAIL`: same value as the backend.
- `INBOUND_EMAIL_SECRET`: same value as the backend.
- `INBOUND_EMAIL_URL`: public HTTPS URL ending in `/emails/inbound`.

Create a time-driven trigger for `processInboundReplies` and run it every one to
five minutes. The script reads unread text replies, removes commonly quoted email
content, and sends the reply to the backend. Successful requests and permanent
4xx rejections are marked read; 5xx/network failures remain unread for retry.

## Processing rules

- The reply address contains an unguessable random token.
- The sender must equal the ticket requester's email address.
- Gmail message IDs prevent duplicate ticket messages.
- Reply text is required and limited to 20,000 characters.
- A valid customer reply is stored as a public message with `source: email`.
- A `pending` ticket moves to `in_progress` after the reply.
- The assigned agent receives a notification email.
