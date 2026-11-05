import { httpError } from '../../utils/http.js';
import {
  parseBooleanQuery,
  parsePagination,
  rejectUnknownFields,
  validateObjectId,
} from '../../utils/validation.js';

const priorities = new Set(['low', 'medium', 'high', 'urgent']);
const policyFields = new Set([
  'name',
  'priority',
  'firstResponseMinutes',
  'resolutionMinutes',
  'isActive',
]);

export function validatePolicyId(value) {
  return validateObjectId(value, 'slaId');
}

export function validatePolicyBody(input, { partial = false } = {}) {
  rejectUnknownFields(input, policyFields);
  const result = {};

  for (const field of ['name', 'priority', 'firstResponseMinutes', 'resolutionMinutes']) {
    if (partial && !Object.hasOwn(input, field)) continue;

    const value = input[field];
    if (field === 'name') {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
        throw httpError('Name is required and must be at most 120 characters', 400);
      }
      result.name = value.trim().toLowerCase();
    } else if (field === 'priority') {
      if (!priorities.has(value)) {
        throw httpError('Priority must be low, medium, high, or urgent', 400);
      }
      result.priority = value;
    } else {
      if (!Number.isSafeInteger(value) || value < 1 || value > 525600) {
        throw httpError(`${field} must be an integer from 1 to 525600 minutes`, 400);
      }
      result[field] = value;
    }
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

export function validatePolicyQuery(query) {
  const result = parsePagination(query);

  if (query.priority !== undefined) {
    if (!priorities.has(query.priority)) throw httpError('priority is invalid', 400);
    result.priority = query.priority;
  }
  if (query.active !== undefined) result.active = parseBooleanQuery(query.active, 'active');

  return result;
}
