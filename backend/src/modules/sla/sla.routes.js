import express from 'express';
import { requireAdmin } from '../../middleware/authenticate.js';
import {
  createPolicy,
  deletePolicy,
  getPolicy,
  listPolicies,
  updatePolicy,
} from './sla.controller.js';

const router = express.Router();
router.use(requireAdmin);
router.post('/', createPolicy);
router.get('/', listPolicies);
router.get('/:slaId', getPolicy);
router.patch('/:slaId', updatePolicy);
router.delete('/:slaId', deletePolicy);

export default router;
