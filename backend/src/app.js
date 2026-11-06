import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { corsOptions } from './config/cors.js';
import { openApiDocument, swaggerUiOptions } from './config/swagger.js';
import authRouter from './modules/auth/auth.routes.js';
import emailRouter from './modules/email/email.routes.js';
import healthRouter from './modules/health/health.routes.js';
import ticketRouter from './modules/ticket/ticket.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import agentRouter from './modules/agent/agent.routes.js';
import categoryRouter from './modules/category/category.routes.js';

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.get('/api-docs.json', (req, res) => res.json(openApiDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, swaggerUiOptions));
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/agents', agentRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/admin', adminRouter);
app.use('/emails', emailRouter);

export default app;
