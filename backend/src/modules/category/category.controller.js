import * as service from './category.service.js';

function context(req) {
  return { actorId: req.auth.userId, actorRole: req.auth.role, ipAddress: req.ip };
}

function handler(operation, status = 200) {
  return async (req, res) => {
    try {
      return res.status(status).json(await operation(req));
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error(`Category operation failed (${error.name})`);
      return res.status(503).json({ error: 'Category operation could not be completed' });
    }
  };
}

export const createCategory = handler((req) => service.createCategory(req.body, context(req)), 201);
export const listCategories = handler((req) => service.listCategories(req.query, context(req)));
export const getCategory = handler((req) => service.getCategory(req.params.categoryId, context(req)));
export const updateCategory = handler((req) => service.updateCategory(req.params.categoryId, req.body, context(req)));
export const deleteCategory = handler((req) => service.deleteCategory(req.params.categoryId, context(req)));
