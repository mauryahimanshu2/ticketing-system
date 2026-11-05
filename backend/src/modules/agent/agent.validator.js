import { httpError } from '../../utils/http.js';
import {
  parseBooleanQuery,
  parsePagination,
  rejectUnknownFields,
  validateObjectId,
} from '../../utils/validation.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedAgentFields = new Set(['name', 'email', 'phone', 'password']);

export function validateAgentInput(input, { partial = false } = {}) {
  rejectUnknownFields(input, allowedAgentFields);
  const result = {};
  if (!partial || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
      throw httpError('Name is required and must be at most 120 characters', 400);
    }
    result.name = input.name.trim();
  }
  if (!partial || Object.hasOwn(input, 'email')) {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (email.length > 254 || !emailPattern.test(email)) throw httpError('A valid email is required', 400);
    result.email = email;
  }
  if (!partial || Object.hasOwn(input, 'phone')) {
    if (input.phone !== undefined && typeof input.phone !== 'string') throw httpError('Phone must be a string', 400);
    const phone = typeof input.phone === 'string' ? input.phone.replace(/[\s().-]/g, '') : '';
    if (!partial && !phone) throw httpError('Phone is required', 400);
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw httpError('Phone must use E.164 format', 400);
    result.phone = phone || undefined;
  }
  if (Object.hasOwn(input, 'password') || !partial) {
    if (
      typeof input.password !== 'string' ||
      input.password.length < 8 ||
      Buffer.byteLength(input.password, 'utf8') > 72
    ) {
      throw httpError('Password must be at least 8 characters and at most 72 UTF-8 bytes', 400);
    }
    result.password = input.password;
  }
  if (partial && Object.keys(result).length === 0) throw httpError('At least one editable field is required', 400);
  return result;
}

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

export function validateAgentId(value) {
  return validateObjectId(value, 'agentId');
}

export function validateAgentListQuery(query) {
  const result = parsePagination(query);
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 120) {
      throw httpError('search must be at most 120 characters', 400);
    }
    result.search = query.search.trim();
  }
  if (query.blocked !== undefined) {
    result.blocked = parseBooleanQuery(query.blocked, 'blocked');
  }
  if (query.active !== undefined) {
    const blocked = !parseBooleanQuery(query.active, 'active');
    if (result.blocked !== undefined && result.blocked !== blocked) {
      throw httpError('active and blocked filters conflict', 400);
    }
    result.blocked = blocked;
  }
  return result;
}
