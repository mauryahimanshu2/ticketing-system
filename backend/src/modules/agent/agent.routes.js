import express from 'express';
import { requireAdmin } from '../../middleware/authenticate.js';
import {
  blockAgent,
  createAgent,
  getAgent,
  listAgents,
  unblockAgent,
  updateAgent,
} from './agent.controller.js';

const router = express.Router();
router.use(requireAdmin);
router.post('/', createAgent);
router.get('/', listAgents);
router.get('/:agentId', getAgent);
router.patch('/:agentId', updateAgent);
router.patch('/:agentId/block', blockAgent);
router.patch('/:agentId/unblock', unblockAgent);

export default router;
