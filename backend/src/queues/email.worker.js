import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { markEventFailed, markEventSent } from '../modules/email/email.repository.js';
import { decryptEmailPayload } from '../modules/email/emailPayloadCipher.js';
import { EMAIL_QUEUE_NAME } from './email.queue.js';

const requestTimeoutMs = 30000;

class EmailDeliveryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function sendToAppsScript(job) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const appsScriptSecret = process.env.APPS_SCRIPT_SECRET;

  if (!appsScriptUrl || !appsScriptSecret) {
    throw new EmailDeliveryError('apps_script_not_configured');
  }

  const payload = job.data.encryptedPayload
    ? decryptEmailPayload(job.data.encryptedPayload)
    : job.data.payload;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    let response;
    try {
      response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          idempotencyKey: job.data.idempotencyKey,
          secret: appsScriptSecret,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new EmailDeliveryError(controller.signal.aborted ? 'apps_script_timeout' : 'apps_script_network_error');
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new EmailDeliveryError('apps_script_invalid_response');
    }

    if (!response.ok) {
      throw new EmailDeliveryError('apps_script_http_error');
    }
    if (result?.success !== true) {
      const safeCodes = new Set([
        'unauthorized',
        'invalid_email_payload',
        'invalid_reply_to',
        'delivery_failed',
      ]);
      const reason = safeCodes.has(result?.code) ? result.code : 'unknown';
      throw new EmailDeliveryError(`apps_script_rejected_${reason}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function createEmailWorker() {
  const appsScriptSecret = process.env.APPS_SCRIPT_SECRET;
  let appsScriptUrl;
  try {
    appsScriptUrl = new URL(process.env.APPS_SCRIPT_URL);
  } catch (error) {
    throw new Error('APPS_SCRIPT_URL must be a valid HTTPS URL');
  }
  if (appsScriptUrl.protocol !== 'https:' || !appsScriptSecret || appsScriptSecret.length < 32) {
    throw new Error('An HTTPS Apps Script URL and a 32-character APPS_SCRIPT_SECRET are required');
  }

  return new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await sendToAppsScript(job);
      await markEventSent(job.data.eventId);
      return { eventId: job.data.eventId, status: 'sent' };
    },
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 60_000,
      },
    },
  )
    .on('completed', (job) => {
      console.log(`Email job ${job.id} completed`);
    })
    .on('failed', (job, error) => {
      if (!job) {
        console.error('Email worker failed before a job was available');
        return;
      }

      const attempts = job.opts.attempts || 1;
      if (job.attemptsMade >= attempts) {
        const errorCode = error instanceof EmailDeliveryError ? error.code : 'email_delivery_failed';
        markEventFailed(job.data.eventId, errorCode).catch(() => {
          console.error(`Unable to persist failure for email job ${job.id}`);
        });
      }

      console.error(`Email job ${job.id} failed (${error.name})`);
    })
    .on('error', (error) => {
      console.error(`Email worker error (${error.name})`);
    });
}
