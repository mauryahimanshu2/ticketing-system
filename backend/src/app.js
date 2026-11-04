import express from 'express';
import emailRouter from './modules/email/email.routes.js';
import healthRouter from './modules/health/health.routes.js';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/health', healthRouter);
app.use('/emails', emailRouter);

export default app;
