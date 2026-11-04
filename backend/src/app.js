import express from 'express';
import authRouter from './modules/auth/auth.routes.js';
import emailRouter from './modules/email/email.routes.js';
import healthRouter from './modules/health/health.routes.js';
import ticketRouter from './modules/ticket/ticket.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import agentRouter from './modules/agent/agent.routes.js';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/agents', agentRouter);
app.use('/api/admin', adminRouter);
app.use('/emails', emailRouter);

export default app;
