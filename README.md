# Ticketing System

A full-stack customer-support ticketing application with separate workspaces for customers, support agents, and administrators. The project contains a React frontend and an Express/MongoDB backend, with Redis-backed OTP/rate limiting, BullMQ email delivery, role-based access control, audit logs, and interactive Swagger documentation.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Roles and permissions](#roles-and-permissions)
- [Ticket workflow](#ticket-workflow)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database seeding](#database-seeding)
- [Application routes](#application-routes)
- [API documentation](#api-documentation)
- [Email architecture](#email-architecture)
- [Authentication and security](#authentication-and-security)
- [Testing and build](#testing-and-build)
- [Deployment checklist](#deployment-checklist)
- [Additional documentation](#additional-documentation)

## Features

### Customer workspace

- Email/password registration with six-digit email verification.
- Password login and customer-only email OTP login.
- Password reset through an emailed OTP.
- Dashboard with ticket status summaries.
- Ticket creation with category selection.
- Ticket listing, filtering, detail view, and conversation history.
- Public replies to support agents.
- Ticket status changes allowed by the customer workflow.
- Blocked-ticket and closed-ticket restrictions enforced by the backend.

### Agent workspace

- Password-protected agent login.
- Dashboard and queue containing only directly assigned tickets.
- Public customer replies and internal notes.
- Staged ticket status/priority updates applied only after confirmation.
- Ticket information request flow through email.
- Automatic queue refresh when a ticket is reassigned.
- Blocked tickets remain visible but cannot be modified.

### Administrator workspace

- Dashboard overview and complete ticket list.
- Create tickets on behalf of customers.
- Assign and reassign tickets to active agents.
- Change status, priority, and category through a confirmed update action.
- Block/unblock tickets with an administrative reason.
- Create, update, block, and unblock agents.
- View and manage customer accounts.
- Category management.
- Read-only administrative audit logs.
- Backend SLA policy APIs.
- Full internal/public ticket history.

### Platform capabilities

- JWT access tokens and rotating refresh tokens.
- Refresh-session revocation on logout, password changes, and account blocking.
- MongoDB-backed users, tickets, messages, activities, policies, and audits.
- Redis-backed OTP storage, throttling, and distributed locks.
- BullMQ email queue with retries and exponential backoff.
- AES-256-GCM encryption for sensitive queued email payloads.
- Gmail/Google Apps Script outbound and inbound email integration.
- OpenAPI 3.1 specification and Swagger UI.
- Responsive role-specific frontend layouts.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React, React Router, Redux Toolkit, React Redux, Axios, Lucide React, Vite, Tailwind Vite plugin |
| Backend | Node.js ES modules, Express, Mongoose, JSON Web Tokens, bcryptjs |
| Database | MongoDB |
| Cache and jobs | Redis, ioredis, BullMQ |
| Email | Google Apps Script and Gmail |
| API documentation | OpenAPI 3.1, Swagger UI, YAML |
| Quality | Node test runner, oxlint, Vite production build |

The project has been verified locally with Node.js 24. Use a current Node.js release compatible with the versions in both lockfiles.

## Architecture

```text
Browser / React frontend
        |
        | HTTPS JSON + Bearer access token
        v
Express REST API
        |
        +---- MongoDB
        |       Users, sessions, tickets, messages, activities,
        |       categories, SLA policies, audit logs, email events
        |
        +---- Redis
        |       OTPs, rate limits, locks, BullMQ job data
        |
        +---- BullMQ email worker
                |
                v
          Google Apps Script ----> Gmail
                ^                    |
                | inbound webhook    | customer text reply
                +--------------------+
```

The frontend never connects directly to MongoDB, Redis, or Google Apps Script. It communicates only with the backend REST API. Email delivery is asynchronous: an API response confirming that an email was queued does not guarantee that Gmail has delivered it.

## Project structure

```text
ticketing-system/
├── .gitignore                     # Shared ignore rules for frontend and backend
├── README.md                      # Unified project documentation
│
├── frontend/                      # React single-page application
│   ├── .env.example               # Frontend environment variable template
│   ├── index.html                 # Vite HTML entry point and favicon metadata
│   ├── package.json               # Frontend scripts and dependencies
│   ├── package-lock.json          # Reproducible frontend dependency versions
│   ├── vite.config.js             # React/Tailwind plugins and local API proxy
│   ├── public/
│   │   ├── favicon.svg            # Application browser icon
│   │   └── icons.svg              # Shared static SVG icons
│   └── src/
│       ├── main.jsx               # React, router, and Redux bootstrap
│       ├── App.jsx                # Role guards and all frontend routes
│       ├── index.css              # Global typography and base styling
│       ├── assets/                # Images and bundled visual assets
│       ├── components/
│       │   ├── auth/              # Login, signup, OTP, reset-password forms
│       │   ├── dashboard/         # Customer layout, tables, ticket modal
│       │   ├── agent/             # Agent navigation/layout and controls
│       │   └── admin/             # Admin navigation/layout and styling
│       ├── pages/
│       │   ├── AuthPage.jsx       # Shared authentication entry page
│       │   ├── DashboardPage.jsx  # Customer dashboard
│       │   ├── TicketsPage.jsx    # Customer ticket list
│       │   ├── TicketDetailPage.jsx
│       │   ├── agent/             # Agent overview/list/detail pages
│       │   └── admin/             # Admin overview, people, tickets, audit, settings
│       ├── features/
│       │   ├── auth/              # Authentication Redux state and async actions
│       │   ├── tickets/           # Ticket state, loading, polling, and errors
│       │   └── admin/             # Admin data state and actions
│       ├── services/
│       │   ├── api.js             # Axios client, timeout, bearer interceptor
│       │   ├── auth.service.js    # Authentication API calls
│       │   ├── ticket.service.js  # Customer/agent ticket API calls
│       │   ├── admin.service.js   # Admin API calls
│       │   └── token.service.js   # In-memory access token/session refresh token
│       ├── hooks/
│       │   ├── useAutoDismiss.js  # Three-second feedback dismissal
│       │   └── useDismissOnOutside.js # Profile-menu outside click/Escape handling
│       ├── store/store.js         # Redux store configuration
│       ├── config/api.js          # API base URL and request timeout
│       └── utils/                 # Date and person-name formatting helpers
│
└── backend/                       # Express REST API and background email worker
    ├── .env.example               # Backend environment variable template
    ├── package.json               # Backend scripts and runtime dependencies
    ├── package-lock.json          # Reproducible backend dependency versions
    ├── docs/
    │   ├── openapi.yaml           # Complete OpenAPI 3.1 contract
    │   └── README.md              # Swagger-specific usage notes
    ├── postman/                   # Postman collection, environment, and guide
    └── src/
        ├── app.js                 # Express middleware and top-level route mounts
        ├── server.js              # Startup, dependency connections, worker, shutdown
        ├── config/
        │   ├── auth.js            # JWT secret and token-duration validation
        │   ├── cors.js            # Allowed frontend origins and headers
        │   ├── redis.js           # Shared Redis connection and startup check
        │   └── swagger.js         # OpenAPI loader and Swagger UI configuration
        ├── database/
        │   ├── connect.js         # MongoDB/Mongoose connection
        │   ├── seedAdmin.js       # Idempotent initial administrator seeder
        │   └── seedSupportData.js # Demo agents and default category seeder
        ├── middleware/
        │   └── authenticate.js    # JWT, active-session, current-role authorization
        ├── modules/
        │   ├── auth/              # Registration, OTP, login, refresh, logout, reset
        │   ├── user/              # User model, repository, safe presenter
        │   ├── agent/             # Admin-controlled agent management
        │   ├── admin/             # Customer management and admin route composition
        │   ├── ticket/            # Ticket routes, service, repository, validation
        │   ├── ticketMessage/     # Public/internal conversation message model
        │   ├── ticketActivity/    # Ticket history/activity model
        │   ├── category/          # Category model and CRUD operations
        │   ├── sla/               # SLA policy model and CRUD operations
        │   ├── auditLog/          # Administrative audit model and queries
        │   ├── email/             # Outbound queue and inbound reply processing
        │   └── health/            # Health endpoint
        ├── queues/
        │   ├── email.queue.js     # BullMQ queue and retry policy
        │   └── email.worker.js    # Apps Script delivery worker
        ├── templates/email/
        │   └── index.js           # Escaped HTML and plain-text email templates
        ├── docs/                  # Authentication, RBAC, and email integration guides
        ├── tests/                 # Auth, RBAC, email, contract, Swagger tests
        └── utils/                 # HTTP, validation, and authorization helpers
```

### Backend module convention

Most backend feature modules follow this structure:

| File type | Responsibility |
|---|---|
| `*.routes.js` | Defines HTTP method/path and attaches authentication/role middleware. |
| `*.controller.js` | Converts Express requests into service calls and HTTP responses. |
| `*.service.js` | Contains business rules, permissions, workflow checks, and side effects. |
| `*.repository.js` | Performs MongoDB queries and persistence operations. |
| `*.validator.js` | Normalizes inputs, rejects unknown fields, and validates IDs/enums. |
| `*.model.js` | Defines Mongoose schema, indexes, defaults, and constraints. |

## Roles and permissions

| Capability | Customer | Agent | Admin |
|---|:---:|:---:|:---:|
| Self-register | Yes | No | No |
| Password login | Yes | Yes | Yes |
| Login using email OTP | Yes | No | No |
| Create own ticket | Yes | No | No |
| View tickets | Own | Assigned | All |
| Public ticket reply | Own | Assigned | All |
| Internal note | No | Assigned | All |
| Change priority | No | Assigned | All |
| Change category | No | No | Yes |
| Assign/reassign agent | No | No | Yes |
| Block/unblock ticket | No | No | Yes |
| Manage users/agents/categories | No | No | Yes |
| View admin audit logs | No | No | Yes |

The backend is the authorization authority. Frontend route guards improve navigation but must not be treated as a security boundary. Protected requests validate the access token, load the current account from MongoDB, verify its active session, and use the current database role/block state.

## Ticket workflow

Ticket statuses:

```text
open -> in_progress -> pending -> resolved -> closed
```

The backend enforces role-specific transitions and permissions rather than trusting UI values.

- New tickets start as `open` with `medium` priority unless an allowed priority is provided.
- Customers can access only tickets they requested.
- Agents can access only tickets currently assigned to them.
- Admins can access every ticket and its internal history.
- Assignment/reassignment requires an active agent.
- Closed tickets must be moved to an allowed state before reassignment.
- Blocked tickets cannot be changed or replied to by customers or agents.
- A blocked ticket cannot be assigned/reassigned until it is unblocked.
- Admin blocking requires a reason; unblocking uses an empty request body.
- Reassignment replaces `assignedTo`, so the ticket disappears from the former agent's queue and appears for the new agent.
- Agent/admin field selections are staged in the frontend and saved only after the user confirms the change.
- Public messages may generate customer notifications; internal messages are never sent to customers.
- Ticket activities record status, priority, assignment, category, reply, block, and reopen events.

Supported priorities are `low`, `medium`, `high`, and `urgent`.

## Local setup

### Prerequisites

- Node.js and npm.
- MongoDB, either local or Atlas.
- Redis, either local or a TLS cloud service.
- Google Apps Script/Gmail configuration if email delivery is required.

### 1. Clone and enter the repository

```bash
git clone <repository-url>
cd ticketing-system
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure the backend

Create `backend/.env` from the template:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Fill all required values described in [Environment variables](#environment-variables).

### 4. Start the backend

```bash
npm start
```

Default local backend URL: `http://localhost:3000`.

### 5. Install and configure the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` from `frontend/.env.example` and set:

```env
VITE_API_URL=http://localhost:3000/api
```

### 6. Start the frontend

```bash
npm run dev
```

Default Vite URL: `http://localhost:5173`.

The Vite development server also proxies `/api` to `http://localhost:3000`. An explicit `VITE_API_URL` is recommended so local and deployed behavior is clear.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|---|:---:|---|
| `MONGODB_URI` | Yes | MongoDB connection URI. Never commit credentials. |
| `REDIS_URL` | Yes | Redis connection used by OTP flows, throttling, locks, and BullMQ. Use `rediss://` for TLS cloud Redis. |
| `CORS_ORIGINS` | Yes | Comma-separated allowed frontend origins without paths. Example: `http://localhost:5173`. |
| `OTP_LIMITS_ENABLED` | Yes | Keep `true` outside isolated tests/development troubleshooting. |
| `JWT_ACCESS_SECRET` | Yes | Access-token signing secret with at least 32 UTF-8 bytes. |
| `JWT_ACCESS_EXPIRES_IN` | No | Access-token duration such as `15m`; defaults to `15m`. |
| `REFRESH_TOKEN_EXPIRES_IN` | No | Refresh-session duration such as `7d`; defaults to `7d`. |
| `APPS_SCRIPT_URL` | Email | HTTPS `/exec` URL of the deployed Google Apps Script web app. |
| `APPS_SCRIPT_SECRET` | Email | Shared backend-to-Apps-Script secret, at least 32 characters. |
| `EMAIL_API_KEY` | Email | Bearer key protecting the server-to-server `POST /emails` endpoint. |
| `EMAIL_PAYLOAD_ENCRYPTION_KEY` | Email | Base64-encoded 32-byte AES key for sensitive queued payloads. |
| `SUPPORT_EMAIL` | Inbound email | Gmail address used to construct ticket-specific plus-addresses. |
| `INBOUND_EMAIL_SECRET` | Inbound email | Secret protecting `POST /emails/inbound`, at least 32 characters. |
| `ADMIN_NAME` | Seeder | Initial administrator display name. |
| `ADMIN_EMAIL` | Seeder | Initial administrator email. |
| `ADMIN_PASSWORD` | Seeder | Initial administrator password, 8–72 UTF-8 bytes. |
| `AGENT_PASSWORD` | Demo seeder | Password used only for the sample-agent seed command. Do not use a shared password in production. |
| `PORT` | No | Backend HTTP port; defaults to `3000`. Hosting providers commonly inject it. |

Generate secure values rather than reusing passwords. Example Node command for a random base64 key:

```bash
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64'))"
```

### Frontend (`frontend/.env`)

| Variable | Required | Purpose |
|---|:---:|---|
| `VITE_API_URL` | Recommended | Backend API base ending in `/api`, for example `http://localhost:3000/api` locally or `https://api.example.com/api` in production. |

Only variables prefixed with `VITE_` are included in the browser bundle. Never place secrets, database URIs, Redis credentials, JWT secrets, or server API keys in frontend environment variables.

Both real `.env` files are ignored by the shared root `.gitignore`. The `.env.example` templates are intentionally trackable and must contain placeholders only.

## Database seeding

Run these commands from `backend/` after configuring `backend/.env`.

### Create the initial administrator

```bash
npm run seed:admin
```

The admin seeder:

- requires `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`;
- bcrypt-hashes the password;
- creates a verified `admin` account;
- is safe to rerun;
- refuses to promote an existing non-admin account.

### Create demo agents and categories

```bash
npm run seed:support-data
```

This creates sample agents and default categories. It is intended for local/demo data. Replace sample addresses and shared credentials before production use.

## Application routes

### Frontend routes

| Route | Access | Purpose |
|---|---|---|
| `/auth` | Public | Signup, email verification, login, login OTP, password reset |
| `/app` | Customer | Customer dashboard |
| `/app/tickets` | Customer | Customer ticket list |
| `/app/tickets/:ticketId` | Customer | Customer ticket details and public conversation |
| `/agent` | Agent | Agent overview |
| `/agent/tickets` | Agent | Assigned ticket queue |
| `/agent/tickets/:ticketId` | Agent | Agent ticket workspace |
| `/admin` | Admin | Admin overview |
| `/admin/tickets` | Admin | Complete ticket list |
| `/admin/tickets/:ticketId` | Admin | Full ticket administration |
| `/admin/users` | Admin | Customer management |
| `/admin/agents` | Admin | Agent management |
| `/admin/settings` | Admin | Category/settings interface |
| `/admin/audit` | Admin | Administrative audit history |

Configure the production static host to rewrite unknown frontend paths to `index.html`; otherwise refreshing a React Router URL may return 404.

### Backend route groups

| Base path | Purpose |
|---|---|
| `/health` | Process health response |
| `/api/auth` | Registration, verification, login, refresh, logout, password reset |
| `/api/tickets` | Role-scoped ticket operations |
| `/api/agents` | Admin-only agent management |
| `/api/categories` | Available categories and admin category CRUD |
| `/api/admin` | Admin users, tickets, categories, SLA, audit logs |
| `/emails` | Outbound queue endpoint and inbound email webhook |
| `/api-docs` | Interactive Swagger UI |
| `/api-docs.json` | Machine-readable OpenAPI document |

## API documentation

With the backend running, open:

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`
- Source specification: `backend/docs/openapi.yaml`

The OpenAPI document contains 61 operations with request bodies, path/query parameters, response schemas, authentication mechanisms, examples, and role notes. Use Swagger's **Authorize** button with an access token returned by login.

Common API behavior:

- JSON request/response bodies.
- Errors use `{ "error": "Human-readable message" }`.
- Pagination defaults to page `1`, limit `20`, with maximum limit `100`.
- MongoDB resource IDs are 24-character hexadecimal ObjectIds.
- Request validators reject unsupported body fields.
- Protected application routes use `Authorization: Bearer <accessToken>`.
- Email endpoints use their dedicated server-side secrets rather than user JWTs.

## Email architecture

### Outbound delivery

1. An auth/ticket operation renders escaped HTML and plain text.
2. The backend creates an `EmailEvent` audit record.
3. BullMQ stores the email job in Redis.
4. OTP/reset payloads are encrypted before entering the queue.
5. The worker posts the payload to Google Apps Script over HTTPS.
6. Apps Script sends through Gmail and returns a JSON delivery result.
7. The backend marks the email event `sent` or `failed`.

The queue retries failures up to five times with exponential backoff. Queue acceptance is not the same as final delivery.

### Inbound customer replies

1. An information-request email uses a ticket-specific Gmail plus-address.
2. A scheduled Apps Script trigger reads unread text replies.
3. Apps Script sends the normalized reply to `/emails/inbound` with the inbound secret.
4. The backend verifies the reply address, message ID, and customer sender.
5. The reply becomes a public ticket message with source `email`.
6. A pending ticket can move back to `in_progress`, and the assigned agent is notified.

Internal notes are explicitly prevented from being rendered or emailed to customers.

## Authentication and security

- Passwords are bcrypt hashes and are never returned.
- Access tokens are signed with HS256 and have short configurable expiry.
- Refresh tokens are random values; only hashes are stored in MongoDB.
- Refresh tokens rotate, and reuse detection revokes the affected session.
- Access-token validation checks the current MongoDB user and active session.
- Blocking a user/agent revokes active sessions.
- Login attempts can temporarily lock password authentication.
- OTP values are stored as hashes with expiration.
- OTP request/verification limits are Redis-backed.
- Registration and OTP operations use short Redis locks to control concurrency.
- Sensitive email queue payloads use AES-256-GCM encryption.
- CORS accepts only configured origins.
- Dynamic email content is HTML-escaped.
- Admin actions are recorded in audit logs with sensitive keys filtered.

Login OTP checks MongoDB before storing or sending a code. It is available only to verified, active customer accounts. Unknown, blocked, unverified, agent, or admin emails are rejected.

## Testing and build

### Backend

From `backend/`:

```bash
npm test
```

The suite covers registration, OTP flows, password login, token rotation, account blocking, email encryption/templates, inbound email, role permissions, endpoint contracts, ticket workflow, notifications, and OpenAPI integrity.

### Frontend

From `frontend/`:

```bash
npm run lint
npm run build
```

Preview the production frontend locally:

```bash
npm run preview
```

### Script reference

| Directory | Script | Description |
|---|---|---|
| `backend` | `npm start` | Starts API, MongoDB/Redis connections, and email worker |
| `backend` | `npm test` | Runs backend tests with Node's test runner |
| `backend` | `npm run seed:admin` | Creates the initial admin account |
| `backend` | `npm run seed:support-data` | Creates demo agents and categories |
| `frontend` | `npm run dev` | Starts Vite development server |
| `frontend` | `npm run lint` | Runs oxlint |
| `frontend` | `npm run build` | Builds production assets into `frontend/dist` |
| `frontend` | `npm run preview` | Serves the built frontend locally |

## Deployment checklist

### Backend

- Use HTTPS at the public load balancer/reverse proxy.
- Set `NODE_ENV=production` in the hosting environment.
- Configure production MongoDB and TLS Redis URLs.
- Rotate any credential that was exposed outside the deployment secret store.
- Use unique long secrets for JWT, Apps Script, email API, inbound email, and encryption.
- Set `OTP_LIMITS_ENABLED=true`.
- Set `CORS_ORIGINS` to the exact deployed frontend origin.
- Configure all email variables or intentionally disable the email-dependent workflows.
- Run the admin seeder once with strong temporary credentials.
- Do not run demo support-data seeding with its fallback/shared password in production.
- Use the platform-provided `PORT`.
- Configure a health check against `/health`.
- Decide whether `/api-docs` should remain public in production.

### Frontend

- Build with `VITE_API_URL=https://<backend-domain>/api`.
- Serve `frontend/dist` through a static host/CDN.
- Configure SPA fallback/rewrite to `index.html`.
- Confirm the frontend domain exists in backend `CORS_ORIGINS`.
- Never put server secrets in `VITE_*` variables.

### Data and operations

- Use backups and monitoring for MongoDB and Redis.
- Monitor failed BullMQ jobs and `EmailEvent` failures.
- Review Gmail/Apps Script quotas.
- Use production-specific agents instead of `example.com` demo accounts.
- Verify `/health`, Swagger JSON, authentication, ticket creation, assignment, and email delivery after deployment.

## Additional documentation

| Document | Description |
|---|---|
| `backend/docs/openapi.yaml` | Full machine-readable API contract |
| `backend/docs/README.md` | Swagger usage instructions |
| `backend/src/docs/authentication.md` | Authentication flows and endpoint behavior |
| `backend/src/docs/rbac.md` | Role permissions, management APIs, and operational rules |
| `backend/src/docs/outbound-email.md` | BullMQ and Apps Script outbound email setup |
| `backend/src/docs/inbound-email.md` | Text-only Gmail reply processing |
| `backend/src/docs/code.gs` | Google Apps Script integration source |
| `backend/postman/README.md` | Postman collection instructions |

## Important notes

- Never commit `backend/.env` or `frontend/.env`.
- Do not treat a queued email response as proof of delivery.
- Do not expose internal ticket notes to customers.
- Do not rely on frontend role guards for authorization.
- Do not use demo agent accounts or shared seed passwords in production.
- Run tests, lint, and the production build before merging or deploying changes.
