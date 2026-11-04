import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { createEmail } from './email.controller.js';

const router = express.Router();

function requireEmailApiKey(req, res, next) {
  const configuredKey = process.env.EMAIL_API_KEY;
  const authorization = req.get('authorization') || '';
  const providedKey = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!configuredKey) {
    return res.status(503).json({ error: 'Email enqueue API is not configured' });
  }

  const expected = Buffer.from(configuredKey);
  const provided = Buffer.from(providedKey);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

router.post('/', requireEmailApiKey, createEmail);

export default router;
