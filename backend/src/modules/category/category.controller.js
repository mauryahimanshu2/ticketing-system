import * as service from './category.service.js';
import { adminContextFromRequest, createHandler } from '../../utils/http.js';

const handler = (operation, status = 200) => createHandler(operation, {
  status,
  logLabel: 'Category operation failed',
  fallbackMessage: 'Category operation could not be completed',
});

export const createCategory = handler((req) => service.createCategory(req.body, adminContextFromRequest(req)), 201);
export const listCategories = handler((req) => service.listCategories(req.query, adminContextFromRequest(req)));
export const getCategory = handler((req) => service.getCategory(req.params.categoryId, adminContextFromRequest(req)));
export const updateCategory = handler((req) => service.updateCategory(req.params.categoryId, req.body, adminContextFromRequest(req)));
export const deleteCategory = handler((req) => service.deleteCategory(req.params.categoryId, adminContextFromRequest(req)));
