import { requireAdmin } from '../../utils/authorization.js';
import { httpError } from '../../utils/http.js';
import * as repository from './sla.repository.js';
import { recordAdminAction } from '../auditLog/auditLog.service.js';
import {
  validatePolicyBody,
  validatePolicyId,
  validatePolicyQuery,
} from './sla.validator.js';

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
  const data = validatePolicyBody(input);
  try {
    const policy = await repository.createPolicy(data);
    await writeAudit(context, 'sla_created', policy, {
      priority: policy.priority,
      firstResponseMinutes: policy.firstResponseMinutes,
      resolutionMinutes: policy.resolutionMinutes,
    });
    return policy;
  } catch (cause) {
    if (cause.code === 11000) throw httpError('SLA policy name already exists', 409);
    throw cause;
  }
}

export async function listPolicies(query, actor) {
  requireAdmin(actor);
  return repository.listPolicies(validatePolicyQuery(query));
}

export async function getPolicy(id, actor) {
  requireAdmin(actor);
  const policy = await repository.findPolicyById(validatePolicyId(id));
  if (!policy) throw httpError('SLA policy not found', 404);
  return policy;
}

export async function updatePolicy(id, input, context) {
  requireAdmin(context);
  const policyId = validatePolicyId(id);
  const updates = validatePolicyBody(input, { partial: true });
  try {
    const policy = await repository.updatePolicy(policyId, updates);
    if (!policy) throw httpError('SLA policy not found', 404);
    await writeAudit(context, 'sla_updated', policy, { changedFields: Object.keys(updates) });
    return policy;
  } catch (cause) {
    if (cause.code === 11000) throw httpError('SLA policy name already exists', 409);
    throw cause;
  }
}

export async function deletePolicy(id, context) {
  requireAdmin(context);
  const result = await repository.deactivatePolicy(validatePolicyId(id));
  if (!result) throw httpError('SLA policy not found', 404);
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
