import { httpError } from '../../utils/http.js';
import {
  parseBooleanQuery,
  parsePagination,
  rejectUnknownFields,
  validateObjectId,
} from '../../utils/validation.js';

export function validateReason(input) {
  rejectUnknownFields(input, new Set(['reason']));
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) {
    throw httpError('A reason of at most 500 characters is required', 400);
  }
  return input.reason.trim();
}

export function validateEmptyBody(input) {
  rejectUnknownFields(input, new Set());
}

export function validateEntityId(value, label = 'id') {
  return validateObjectId(value, label);
}

export function validateListQuery(query, { includeVerification = false } = {}) {
  const result = parsePagination(query);
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 120) throw httpError('search must be at most 120 characters', 400);
    result.search = query.search.trim();
  }
  if (query.blocked !== undefined) {
    result.blocked = parseBooleanQuery(query.blocked, 'blocked');
  }
  if (query.active !== undefined) {
    const activeBlocked = !parseBooleanQuery(query.active, 'active');
    if (result.blocked !== undefined && result.blocked !== activeBlocked) {
      throw httpError('active and blocked filters conflict', 400);
    }
    result.blocked = activeBlocked;
  }
  if (includeVerification && query.verified !== undefined) {
    result.verified = parseBooleanQuery(query.verified, 'verified');
  }
  return result;
}

export function validateAuditQuery(query) {
  const options = validateListQuery(query);
  for (const key of ['targetType', 'actorId', 'action']) {
    if (query[key] !== undefined) {
      if (typeof query[key] !== 'string' || query[key].length > 120) throw httpError(`${key} is invalid`, 400);
      options[key] = query[key].trim();
    }
  }
  if (options.actorId) options.actorId = validateEntityId(options.actorId, 'actorId');
  return options;
}
