import { httpError } from '../../utils/http.js';
import {
  parseBooleanQuery,
  parsePagination,
  rejectUnknownFields,
  validateObjectId,
} from '../../utils/validation.js';

const categoryFields = new Set(['name', 'description', 'isActive']);

export function validateCategoryId(value) {
  return validateObjectId(value, 'categoryId');
}

export function validateCategoryBody(input, { partial = false } = {}) {
  rejectUnknownFields(input, categoryFields);
  const result = {};

  if (!partial || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
      throw httpError('Name is required and must be at most 120 characters', 400);
    }
    result.name = input.name.trim().toLowerCase();
  }

  if (Object.hasOwn(input, 'description')) {
    if (typeof input.description !== 'string' || input.description.length > 2000) {
      throw httpError('Description must be a string of at most 2000 characters', 400);
    }
    result.description = input.description.trim();
  }

  if (Object.hasOwn(input, 'isActive')) {
    if (typeof input.isActive !== 'boolean') throw httpError('isActive must be a boolean', 400);
    result.isActive = input.isActive;
  }

  if (partial && Object.keys(result).length === 0) {
    throw httpError('At least one field is required', 400);
  }
  return result;
}

export function validateCategoryQuery(query) {
  const result = parsePagination(query);

  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 120) {
      throw httpError('search must be at most 120 characters', 400);
    }
    if (query.search) result.search = query.search.trim();
  }
  if (query.active !== undefined) result.active = parseBooleanQuery(query.active, 'active');

  return result;
}
