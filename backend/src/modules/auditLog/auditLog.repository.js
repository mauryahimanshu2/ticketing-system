import AuditLog from './auditLog.model.js';

export async function createAuditLog(entry) {
  return AuditLog.create(entry);
}

export async function listAuditLogs({ page, limit, targetType, actorId, action }) {
  const filter = {};
  if (targetType) filter.targetType = targetType;
  if (actorId) filter.actorId = actorId;
  if (action) filter.action = action;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actorId', 'name email role')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function findAuditLogById(id) {
  return AuditLog.findById(id).populate('actorId', 'name email role').lean();
}
