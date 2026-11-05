import { enqueueEmail } from './email.service.js';
import { processInboundEmail } from './email.inbound.service.js';
import { createHandler } from '../../utils/http.js';

const handler = (operation, status = 200) => createHandler(operation, {
  status,
  logLabel: 'Email enqueue failed',
  fallbackMessage: 'Email could not be queued',
});

export const createEmail = handler(async (req) => {
  const result = await enqueueEmail(req.body);

  return {
    status: result.status,
    jobId: result.jobId,
    message: result.status === 'queued'
      ? 'Email accepted for background delivery; delivery is not yet confirmed.'
      : 'This idempotent email request already exists; use a new key to request another delivery.',
  };
}, (result) => result.status === 'queued' ? 202 : 200);

export const receiveInboundEmail = handler(
  (req) => processInboundEmail(req.body),
);
