import mongoose from 'mongoose';
import * as repository from './sla.repository.js';
import { recordAdminAction } from '../auditLog/auditLog.service.js';

const priorities = new Set(['low', 'medium', 'high', 'urgent']);

function error(message, statusCode) {
  const result = new Error(message);
  result.statusCode = statusCode;
  return result;
}

function requireAdmin(actor) {
  if (actor?.actorRole !== 'admin') throw error('Admin access is required', 403);
}

function validateId(value) {
  if (!mongoose.isValidObjectId(value)) throw error('A valid slaId is required', 400);
  return value;
}

function validateBody(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('Request body must be an object', 400);
  const allowed = new Set(['name', 'priority', 'firstResponseMinutes', 'resolutionMinutes', 'isActive']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw error('Request contains unsupported fields', 400);
  const value = {};
  for (const field of ['name', 'priority', 'firstResponseMinutes', 'resolutionMinutes']) {
    if (partial && !Object.hasOwn(input, field)) continue;
    const item = input[field];
    if (field === 'name') {
      if (typeof item !== 'string' || !item.trim() || item.trim().length > 120) throw error('Name is required and must be at most 120 characters', 400);
      value.name = item.trim().toLowerCase();
    } else if (field === 'priority') {
      if (!priorities.has(item)) throw error('Priority must be low, medium, high, or urgent', 400);
      value.priority = item;
    } else {
      if (!Number.isSafeInteger(item) || item < 1 || item > 525600) throw error(`${field} must be an integer from 1 to 525600 minutes`, 400);
      value[field] = item;
    }
  }
  if (Object.hasOwn(input, 'isActive')) {
    if (typeof input.isActive !== 'boolean') throw error('isActive must be a boolean', 400);
    value.isActive = input.isActive;
  }
  if (partial && !Object.keys(value).length) throw error('At least one field is required', 400);
  return value;
}

function validateQuery(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw error('page must be positive and limit must be between 1 and 100', 400);
  }
  if (query.priority !== undefined && !priorities.has(query.priority)) throw error('priority is invalid', 400);
  let active;
  if (query.active !== undefined) {
    if (!['true', 'false'].includes(query.active)) throw error('active must be true or false', 400);
    active = query.active === 'true';
  }
  return { page, limit, ...(query.priority ? { priority: query.priority } : {}), active };
}

async function writeAudit(context, action, policy, details) {
  return recordAdminAction({
    ...context,
    action,
    targetType: 'sla_policy',
    targetId: policy._id,
    details,
  });
}

export async function createPolicy(input, context) {
  requireAdmin(context);
  const data = validateBody(input);
  try {
    const policy = await repository.createPolicy(data);
    await writeAudit(context, 'sla_created', policy, {
      priority: policy.priority,
      firstResponseMinutes: policy.firstResponseMinutes,
      resolutionMinutes: policy.resolutionMinutes,
    });
    return policy;
  } catch (cause) {
    if (cause.code === 11000) throw error('SLA policy name already exists', 409);
    throw cause;
  }
}

export async function listPolicies(query, actor) {
  requireAdmin(actor);
  return repository.listPolicies(validateQuery(query));
}

export async function getPolicy(id, actor) {
  requireAdmin(actor);
  const policy = await repository.findPolicyById(validateId(id));
  if (!policy) throw error('SLA policy not found', 404);
  return policy;
}

export async function updatePolicy(id, input, context) {
  requireAdmin(context);
  const policyId = validateId(id);
  const updates = validateBody(input, true);
  try {
    const policy = await repository.updatePolicy(policyId, updates);
    if (!policy) throw error('SLA policy not found', 404);
    await writeAudit(context, 'sla_updated', policy, { changedFields: Object.keys(updates) });
    return policy;
  } catch (cause) {
    if (cause.code === 11000) throw error('SLA policy name already exists', 409);
    throw cause;
  }
}

export async function deletePolicy(id, context) {
  requireAdmin(context);
  const result = await repository.deactivatePolicy(validateId(id));
  if (!result) throw error('SLA policy not found', 404);
  await writeAudit(context, result.deactivated ? 'sla_deactivated' : 'sla_deleted', result.policy, {
    deactivated: result.deactivated,
  });
  return { message: result.deactivated ? 'SLA policy deactivated because tickets reference it' : 'SLA policy deleted' };
}

export async function getSlaSnapshot(priority) {
  const policy = await repository.findActivePolicyForPriority(priority);
  if (!policy) return null;
  return {
    policyId: policy._id,
    policyName: policy.name,
    priority: policy.priority,
    firstResponseMinutes: policy.firstResponseMinutes,
    resolutionMinutes: policy.resolutionMinutes,
    appliedAt: new Date(),
  };
}
