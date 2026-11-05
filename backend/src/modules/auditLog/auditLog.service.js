import * as auditRepository from './auditLog.repository.js';
import { requireAdmin } from '../../utils/authorization.js';
import { httpError } from '../../utils/http.js';
import { validateObjectId } from '../../utils/validation.js';

const secretKeys = /password|otp|token|secret|credential/i;

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !secretKeys.test(key))
      .map(([key, nested]) => [key, stripSecrets(nested)]),
  );
}

export async function recordAdminAction({
  actorId,
  action,
  targetType,
  targetId,
  details = {},
  ipAddress,
}) {
  return auditRepository.createAuditLog({
    actorId,
    actorRole: 'admin',
    action,
    targetType,
    targetId,
    details: stripSecrets(details),
    ...(ipAddress ? { ipAddress: String(ipAddress).slice(0, 64) } : {}),
  });
}

export async function listAuditLogs(query) {
  requireAdmin(query);
  const { actorRole, ...filters } = query;
  return auditRepository.listAuditLogs(filters);
}

export async function getAuditLog(id, actor) {
  requireAdmin(actor);
  const log = await auditRepository.findAuditLogById(validateObjectId(id, 'logId'));
  if (!log) throw httpError('Audit log not found', 404);
  return log;
}
