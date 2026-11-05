import { requireAdmin } from '../../utils/authorization.js';
import { httpError } from '../../utils/http.js';
import * as repository from './category.repository.js';
import { recordAdminAction } from '../auditLog/auditLog.service.js';
import {
  validateCategoryBody,
  validateCategoryId,
  validateCategoryQuery,
} from './category.validator.js';

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
  const categoryData = validateCategoryBody(input);
  try {
    const category = await repository.createCategory(categoryData);
    await writeAudit(context, 'category_created', category, { name: category.name });
    return category;
  } catch (cause) {
    if (cause.code === 11000) throw httpError('Category name already exists', 409);
    throw cause;
  }
}

export async function listCategories(query, actor) {
  requireAdmin(actor);
  return repository.listCategories(validateCategoryQuery(query));
}

export async function getCategory(id, actor) {
  requireAdmin(actor);
  const category = await repository.findCategoryById(validateCategoryId(id));
  if (!category) throw httpError('Category not found', 404);
  return category;
}

export async function updateCategory(id, input, context) {
  requireAdmin(context);
  const categoryId = validateCategoryId(id);
  const updates = validateCategoryBody(input, { partial: true });
  try {
    const category = await repository.updateCategory(categoryId, updates);
    if (!category) throw httpError('Category not found', 404);
    await writeAudit(context, 'category_updated', category, { changedFields: Object.keys(updates) });
    return category;
  } catch (cause) {
    if (cause.code === 11000) throw httpError('Category name already exists', 409);
    throw cause;
  }
}

export async function deleteCategory(id, context) {
  requireAdmin(context);
  const result = await repository.deactivateCategory(validateCategoryId(id));
  if (!result) throw httpError('Category not found', 404);
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
