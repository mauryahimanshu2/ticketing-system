import mongoose from 'mongoose';
import { httpError } from './http.js';

export function rejectUnknownFields(input, allowedFields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw httpError('Request body must be an object', 400);
  }
  if (Object.keys(input).some((key) => !allowedFields.has(key))) {
    throw httpError('Request contains unsupported fields', 400);
  }
}

export function validateObjectId(value, label = 'id') {
  if (!mongoose.isValidObjectId(value)) {
    throw httpError(`A valid ${label} is required`, 400);
  }
  return String(value);
}

export function parsePagination(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw httpError('page must be positive and limit must be between 1 and 100', 400);
  }
  return { page, limit };
}

export function parseBooleanQuery(value, label) {
  if (!['true', 'false'].includes(value)) {
    throw httpError(`${label} must be true or false`, 400);
  }
  return value === 'true';
}
