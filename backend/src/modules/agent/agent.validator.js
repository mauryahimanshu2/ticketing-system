import mongoose from 'mongoose';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedAgentFields = new Set(['name', 'email', 'phone', 'password']);

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

export function validateAgentInput(input, { partial = false } = {}) {
  rejectUnknown(input, allowedAgentFields);
  const result = {};
  if (!partial || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
      throw invalid('Name is required and must be at most 120 characters');
    }
    result.name = input.name.trim();
  }
  if (!partial || Object.hasOwn(input, 'email')) {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (email.length > 254 || !emailPattern.test(email)) throw invalid('A valid email is required');
    result.email = email;
  }
  if (!partial || Object.hasOwn(input, 'phone')) {
    if (input.phone !== undefined && typeof input.phone !== 'string') throw invalid('Phone must be a string');
    const phone = typeof input.phone === 'string' ? input.phone.replace(/[\s().-]/g, '') : '';
    if (!partial && !phone) throw invalid('Phone is required');
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw invalid('Phone must use E.164 format');
    result.phone = phone || undefined;
  }
  if (Object.hasOwn(input, 'password') || !partial) {
    if (
      typeof input.password !== 'string' ||
      input.password.length < 8 ||
      Buffer.byteLength(input.password, 'utf8') > 72
    ) {
      throw invalid('Password must be at least 8 characters and at most 72 UTF-8 bytes');
    }
    result.password = input.password;
  }
  if (partial && Object.keys(result).length === 0) throw invalid('At least one editable field is required');
  return result;
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

export function validateAgentId(value) {
  if (!mongoose.isValidObjectId(value)) throw invalid('A valid agentId is required');
  return String(value);
}

export function validateAgentListQuery(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalid('page must be positive and limit must be between 1 and 100');
  }
  const result = { page, limit };
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 120) {
      throw invalid('search must be at most 120 characters');
    }
    result.search = query.search.trim();
  }
  if (query.blocked !== undefined) {
    if (!['true', 'false'].includes(query.blocked)) throw invalid('blocked must be true or false');
    result.blocked = query.blocked === 'true';
  }
  if (query.active !== undefined) {
    if (!['true', 'false'].includes(query.active)) throw invalid('active must be true or false');
    const blocked = query.active !== 'true';
    if (result.blocked !== undefined && result.blocked !== blocked) {
      throw invalid('active and blocked filters conflict');
    }
    result.blocked = blocked;
  }
  return result;
}
