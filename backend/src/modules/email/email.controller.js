import { enqueueEmail } from './email.service.js';

export async function createEmail(req, res) {
  try {
    const result = await enqueueEmail(req.body);

    if (result.status === 'queued') {
      return res.status(202).json({
        status: 'queued',
        jobId: result.jobId,
        message: 'Email accepted for background delivery; delivery is not yet confirmed.',
      });
    }

    return res.status(200).json({
      status: result.status,
      jobId: result.jobId,
      message: 'This idempotent email request already exists; use a new key to request another delivery.',
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error(`Email enqueue failed (${error.name})`);
    return res.status(503).json({ error: 'Email could not be queued' });
  }
}
