const express = require('express');
const healthRouter = require('./modules/health/health.routes');

const app = express();

app.use(express.json());
app.use('/health', healthRouter);

module.exports = app;
