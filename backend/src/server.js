
import 'dotenv/config';
import app from './app.js';
import connectDatabase from './database/connect.js';
import { connectRedis, redisConnection } from './config/redis.js';
import emailQueue from './queues/email.queue.js';
import { createEmailWorker } from './queues/email.worker.js';
import mongoose from 'mongoose';
import { validateAuthConfig } from './config/auth.js';

const port = Number(process.env.PORT) || 3000;

let httpServer;
let emailWorker;
let isShuttingDown = false;

try {
  validateAuthConfig();
  await connectDatabase();
  await connectRedis();

  emailWorker = createEmailWorker();

  httpServer = app.listen(port, () => {
    console.log(`Ticketing system API listening on port ${port}`);
  });

  httpServer.on('error', (error) => {
    console.error('HTTP server error:', error);
  });

} catch (error) {
  console.error(`Failed to start backend (${error.name})`);

  await Promise.allSettled([
    emailWorker?.close(),
    emailQueue.close(),
    redisConnection.quit(),
    mongoose.disconnect(),
  ]);

  process.exitCode = 1;
}

async function shutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down`);

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) =>
          error ? reject(error) : resolve()
        );
      });
    }

    await emailWorker?.close();
    await emailQueue.close();
    await redisConnection.quit();
    await mongoose.disconnect();

    console.log('Backend shutdown completed');

  } catch (error) {
    console.error('Backend shutdown failed:', error);
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
