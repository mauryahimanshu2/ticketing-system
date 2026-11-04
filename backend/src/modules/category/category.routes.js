import express from 'express';
import { requireAdmin } from '../../middleware/authenticate.js';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from './category.controller.js';

const router = express.Router();
router.use(requireAdmin);
router.post('/', createCategory);
router.get('/', listCategories);
router.get('/:categoryId', getCategory);
router.patch('/:categoryId', updateCategory);
router.delete('/:categoryId', deleteCategory);

export default router;
