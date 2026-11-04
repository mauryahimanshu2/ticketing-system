import mongoose from 'mongoose';

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function rejectUnknown(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Request body must be an object');
  }
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw invalid('Request contains unsupported fields');
  }
}

export function validateReason(input) {
  rejectUnknown(input, new Set(['reason']));
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) {
    throw invalid('A reason of at most 500 characters is required');
  }
  return input.reason.trim();
}

export function validateEmptyBody(input) {
  rejectUnknown(input, new Set());
}

export function validateEntityId(value, label = 'id') {
  if (!mongoose.isValidObjectId(value)) throw invalid(`A valid ${label} is required`);
  return String(value);
}

export function validateListQuery(query, { includeVerification = false } = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalid('page must be positive and limit must be between 1 and 100');
  }
  const result = { page, limit };
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 120) throw invalid('search must be at most 120 characters');
    result.search = query.search.trim();
  }
  if (query.blocked !== undefined) {
    if (!['true', 'false'].includes(query.blocked)) throw invalid('blocked must be true or false');
    result.blocked = query.blocked === 'true';
  }
  if (query.active !== undefined) {
    if (!['true', 'false'].includes(query.active)) throw invalid('active must be true or false');
    const activeBlocked = query.active !== 'true';
    if (result.blocked !== undefined && result.blocked !== activeBlocked) {
      throw invalid('active and blocked filters conflict');
    }
    result.blocked = activeBlocked;
  }
  if (includeVerification && query.verified !== undefined) {
    if (!['true', 'false'].includes(query.verified)) throw invalid('verified must be true or false');
    result.verified = query.verified === 'true';
  }
  return result;
}

export function validateAuditQuery(query) {
  const options = validateListQuery(query);
  for (const key of ['targetType', 'actorId', 'action']) {
    if (query[key] !== undefined) {
      if (typeof query[key] !== 'string' || query[key].length > 120) throw invalid(`${key} is invalid`);
      options[key] = query[key].trim();
    }
  }
  if (options.actorId) options.actorId = validateEntityId(options.actorId, 'actorId');
  return options;
}
