# RBAC, Admin, and Support Agent API

All protected routes require `Authorization: Bearer <accessToken>`. Authorization
uses the account's current MongoDB role and block state, not the role embedded in
an older JWT. Blocked accounts lose active sessions. Agents have no team concept
in this backend, so they can access only tickets assigned directly to them.

## Initial admin

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the backend environment,
then run from `backend/`:

```powershell
npm run seed:admin
```

The seeder hashes the password and creates a verified admin only if the email is
unused. It is safe to rerun. If that email already belongs to a non-admin, it
refuses to promote the account. There is no public admin-registration endpoint.

## Initial agent and categories

Set `AGENT_PASSWORD` in the backend environment, then run from `backend/`:

```powershell
npm run seed:support-data
```

The script at `src/database/seedSupportData.js` creates ten verified sample
agents and adds ten default categories. Each agent receives the same password
from `AGENT_PASSWORD`, stored as a bcrypt hash. This shared password is intended
only for local/demo seeding; use unique credentials for production agents.
Agent emails use the reserved `example.com` domain and should be replaced before
using this data in a deployed environment. It is safe to rerun: existing
categories and agents are left unchanged, and an email already assigned to a
non-agent account causes the seeder to fail rather than changing that account's
role.

Customers, agents, and admins sign in through the shared
`POST /api/auth/login-password` endpoint using
`{"email":"name@example.com","password":"StrongPassword123"}`. Successful
responses include the current account role. Login OTP and password recovery are
customer-only; admin/agent recovery must be handled through the administrator
account-management process.

## Agent management — admin only

Base path: `/api/agents` (admin access required)

| Method and path | Request body | Success |
|---|---|---|
| `POST /api/agents` | `{"name":"Rahul Sharma","email":"rahul@example.com","phone":"+919876543210","password":"AgentPassword123"}` | `201`, verified `agent` profile |
| `GET /api/agents?page=1&limit=20&search=rahul&active=true` | — | `200`, paginated agents and ticket counts |
| `GET /api/agents/:agentId` | — | `200`, agent and assigned/open ticket counts |
| `PATCH /api/agents/:agentId` | Any subset of `name`, `email`, `phone`, `password` | `200`; password/email changes revoke sessions |
| `PATCH /api/agents/:agentId/block` | `{"reason":"Policy violation"}` | `200`; sessions revoked; assigned tickets retained |
| `PATCH /api/agents/:agentId/unblock` | `{}` | `200` |

Unknown fields such as `role` and `isVerified` are rejected. Duplicate email
addresses return `409`.

## User management — admin only

Base path: `/api/admin/users`

| Method and path | Request body | Success |
|---|---|---|
| `GET /api/admin/users?page=1&limit=20&search=rahul&verified=true&blocked=false` | — | `200`, customers only, ticket statistics |
| `GET /api/admin/users/:userId` | — | `200`, customer profile and ticket counts |
| `PATCH /api/admin/users/:userId/block` | `{"reason":"Violation of platform policies"}` | `200`; sessions revoked, ticket history retained |
| `PATCH /api/admin/users/:userId/unblock` | `{}` | `200` |

Password, OTP, and session hashes are never returned.

## Tickets

Customer routes use `/api/tickets`. Customers can create tickets with
`POST /api/tickets`:

```json
{
  "subject": "Cannot access my account",
  "description": "The password reset link is not working.",
  "category": "<categoryId>"
}
```

Customers can list/read only their own tickets, send public messages, and close
or reopen their tickets. Internal messages are never returned to customers or
sent by email.

Agents can list/read tickets assigned directly to them, reply publicly or add
internal notes, resolve/close/reopen tickets, and change priority. Agent status
transitions are constrained; agents cannot assign tickets or change categories.

Authenticated ticket endpoints:

| Method and path | Request body | Permission |
|---|---|---|
| `GET /api/tickets?page=1&limit=20&status=open&priority=high` | — | Own / assigned / all, by role |
| `GET /api/tickets/:ticketId` | — | Own / assigned / all, by role; customer view excludes internal messages |
| `POST /api/tickets/:ticketId/messages` | `{"body":"I have more information."}` | Authorized ticket; agents/admins may use `{"body":"Internal note","type":"internal"}` |
| `PATCH /api/tickets/:ticketId/status` | `{"status":"closed"}` | Customer limited to close/reopen; agent/admin according to role |
| `PATCH /api/tickets/:ticketId/priority` | `{"priority":"urgent"}` | Assigned agent or admin |

Admins can also create a ticket for a customer using `POST /api/admin/tickets`
with `requesterId`, `subject`, and `description`, optionally `category` and
`priority`.

Admin ticket routes:

| Method and path | Request body |
|---|---|
| `GET /api/admin/tickets?page=1&limit=20&search=login&status=open&priority=high&category=<id>&assignedTo=<agentId>&from=2026-01-01&to=2026-12-31` | — |
| `GET /api/admin/tickets/:ticketId` | — |
| `PATCH /api/admin/tickets/:ticketId/assign` | `{"agentId":"<agentId>"}` |
| `PATCH /api/admin/tickets/:ticketId/reassign` | `{"agentId":"<newAgentId>","reason":"Workload redistribution"}` |
| `PATCH /api/admin/tickets/:ticketId/status` | `{"status":"resolved"}` |
| `PATCH /api/admin/tickets/:ticketId/priority` | `{"priority":"urgent"}` |
| `PATCH /api/admin/tickets/:ticketId/category` | `{"category":"<categoryId>"}` (use `null` to clear) |
| `PATCH /api/admin/tickets/:ticketId/block` | `{"reason":"Administrative review"}` |
| `PATCH /api/admin/tickets/:ticketId/unblock` | `{}` |

Assignment requires an active agent. Assignment/reassignment changes are
recorded in ticket activity and audit logs, then agent notification emails are
queued using the existing email queue. The response counts queued notifications;
queued does not mean delivered. A notification queue failure is logged and the
assignment remains committed.

Blocked tickets remain visible and manageable by admins, but customers and
agents cannot modify or reply to them.

## Categories, SLA, and audit logs — admin only

Category endpoints are under `/api/admin/categories`:

- `POST /api/admin/categories` — `{"name":"Billing","description":"Billing help"}`
- `GET /api/admin/categories?page=1&limit=20&active=true&search=bill`
- `GET /api/admin/categories/:categoryId`
- `PATCH /api/admin/categories/:categoryId` — e.g. `{"isActive":false}`
- `DELETE /api/admin/categories/:categoryId` — permanently removes only unused categories; referenced categories are deactivated.

SLA endpoints are under `/api/admin/sla`:

- `POST /api/admin/sla` — `{"name":"Urgent","priority":"urgent","firstResponseMinutes":15,"resolutionMinutes":240}`
- `GET /api/admin/sla?page=1&limit=20&priority=urgent&active=true`
- `GET /api/admin/sla/:slaId`
- `PATCH /api/admin/sla/:slaId` — any subset of name, priority, durations, `isActive`
- `DELETE /api/admin/sla/:slaId` — removes only unused policies; referenced policies are deactivated.

Durations are simple minutes; working-hours calendars and SLA countdowns are not
implemented. Tickets keep a snapshot of the applied policy and durations, so
editing a policy does not alter existing ticket history.

Audit log endpoints are `GET /api/admin/audit-logs?page=1&limit=20` and
`GET /api/admin/audit-logs/:logId`. They are read-only through the API and
capture administrative management, assignment, blocking, category, SLA, and
ticket status/priority changes. Audit details filter keys that could contain
passwords, OTPs, tokens, secrets, or credentials.

## Operational notes

Critical user/session and ticket assignment updates use conditional atomic
MongoDB writes. Ticket activities and audit events are separate MongoDB writes;
the default local MongoDB URI is standalone, so it cannot provide multi-document
transactions. Deploy a replica set and add transaction handling if those
multi-document writes must be all-or-nothing.

Unauthenticated requests return `401`; authenticated users/agents attempting
admin-only operations receive `403`. Other validation and conflict responses
use `400`, `404`, `409`, or `423` depending on the operation.
