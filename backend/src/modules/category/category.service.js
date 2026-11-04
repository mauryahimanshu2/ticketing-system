import mongoose from 'mongoose';
import * as repository from './category.repository.js';
import { recordAdminAction } from '../auditLog/auditLog.service.js';

function error(message, statusCode) {
  const result = new Error(message);
  result.statusCode = statusCode;
  return result;
}

function requireAdmin(actor) {
  if (actor?.actorRole !== 'admin') throw error('Admin access is required', 403);
}

function validateId(value) {
  if (!mongoose.isValidObjectId(value)) throw error('A valid categoryId is required', 400);
  return value;
}

function validateBody(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('Request body must be an object', 400);
  const allowed = new Set(['name', 'description', 'isActive']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw error('Request contains unsupported fields', 400);
  const updates = {};
  if (!partial || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
      throw error('Name is required and must be at most 120 characters', 400);
    }
    updates.name = input.name.trim().toLowerCase();
  }
  if (Object.hasOwn(input, 'description')) {
    if (typeof input.description !== 'string' || input.description.length > 2000) {
      throw error('Description must be a string of at most 2000 characters', 400);
    }
    updates.description = input.description.trim();
  }
  if (Object.hasOwn(input, 'isActive')) {
    if (typeof input.isActive !== 'boolean') throw error('isActive must be a boolean', 400);
    updates.isActive = input.isActive;
  }
  if (partial && !Object.keys(updates).length) throw error('At least one field is required', 400);
  return updates;
}

function validateQuery(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw error('page must be positive and limit must be between 1 and 100', 400);
  }
  let active;
  if (query.active !== undefined) {
    if (!['true', 'false'].includes(query.active)) throw error('active must be true or false', 400);
    active = query.active === 'true';
  }
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 120)) {
    throw error('search must be at most 120 characters', 400);
  }
  return { page, limit, ...(query.search ? { search: query.search.trim() } : {}), active };
}

async function writeAudit(context, action, category, details) {
  return recordAdminAction({
    ...context,
    action,
    targetType: 'category',
    targetId: category._id,
    details,
  });
}

export async function createCategory(input, context) {
  requireAdmin(context);
  const categoryData = validateBody(input);
  try {
    const category = await repository.createCategory(categoryData);
    await writeAudit(context, 'category_created', category, { name: category.name });
    return category;
  } catch (cause) {
    if (cause.code === 11000) throw error('Category name already exists', 409);
    throw cause;
  }
}

export async function listCategories(query, actor) {
  requireAdmin(actor);
  return repository.listCategories(validateQuery(query));
}

export async function getCategory(id, actor) {
  requireAdmin(actor);
  const category = await repository.findCategoryById(validateId(id));
  if (!category) throw error('Category not found', 404);
  return category;
}

export async function updateCategory(id, input, context) {
  requireAdmin(context);
  const categoryId = validateId(id);
  const updates = validateBody(input, true);
  try {
    const category = await repository.updateCategory(categoryId, updates);
    if (!category) throw error('Category not found', 404);
    await writeAudit(context, 'category_updated', category, { changedFields: Object.keys(updates) });
    return category;
  } catch (cause) {
    if (cause.code === 11000) throw error('Category name already exists', 409);
    throw cause;
  }
}

export async function deleteCategory(id, context) {
  requireAdmin(context);
  const result = await repository.deactivateCategory(validateId(id));
  if (!result) throw error('Category not found', 404);
  await writeAudit(
    context,
    result.deactivated ? 'category_deactivated' : 'category_deleted',
    result.category,
    { deactivated: result.deactivated },
  );
  return {
    message: result.deactivated ? 'Category deactivated because tickets reference it' : 'Category deleted',
  };
}
