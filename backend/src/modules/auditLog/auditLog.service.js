import * as auditRepository from './auditLog.repository.js';
import mongoose from 'mongoose';

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
  if (query?.actorRole !== 'admin') {
    const error = new Error('Admin access is required');
    error.statusCode = 403;
    throw error;
  }
  const { actorRole, ...filters } = query;
  return auditRepository.listAuditLogs(filters);
}

export async function getAuditLog(id, actor) {
  if (actor?.actorRole !== 'admin') {
    const error = new Error('Admin access is required');
    error.statusCode = 403;
    throw error;
  }
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('A valid logId is required');
    error.statusCode = 400;
    throw error;
  }
  const log = await auditRepository.findAuditLogById(id);
  if (!log) {
    const error = new Error('Audit log not found');
    error.statusCode = 404;
    throw error;
  }
  return log;
}
