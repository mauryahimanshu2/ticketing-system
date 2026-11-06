import express from 'express';
import { authenticate, authorizeRoles, requireAdmin } from '../../middleware/authenticate.js';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listAvailableCategories,
  listCategories,
  updateCategory,
} from './category.controller.js';

const router = express.Router();
router.get('/available', authenticate, authorizeRoles('user', 'agent', 'admin'), listAvailableCategories);
router.use(requireAdmin);
router.post('/', createCategory);
router.get('/', listCategories);
router.get('/:categoryId', getCategory);
router.patch('/:categoryId', updateCategory);
router.delete('/:categoryId', deleteCategory);

export default router;
