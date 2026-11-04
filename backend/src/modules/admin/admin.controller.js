import * as adminService from './admin.service.js';
import { validateAuditQuery } from './admin.validator.js';
import { getAuditLog, listAuditLogs } from '../auditLog/auditLog.service.js';

function sendError(res, error) {
  if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
  console.error(`Admin request failed (${error.name})`);
  return res.status(503).json({ error: 'Admin operation could not be completed' });
}

function context(req) {
  return { actorId: req.auth.userId, actorRole: req.auth.role, ipAddress: req.ip };
}

function handler(operation, status = 200) {
  return async (req, res) => {
    try {
      return res.status(status).json(await operation(req));
    } catch (error) {
      return sendError(res, error);
    }
  };
}

export const listUsers = handler((req) => adminService.listUsers(req.query, context(req)));
export const getUser = handler((req) => adminService.getUser(req.params.userId, context(req)));
export const blockUser = handler((req) => adminService.setManagedUserBlocked(req.params.userId, true, req.body, context(req)));
export const unblockUser = handler((req) => adminService.setManagedUserBlocked(req.params.userId, false, req.body, context(req)));

export const listAdminAuditLogs = handler((req) => listAuditLogs({
  ...validateAuditQuery(req.query),
  actorRole: req.auth.role,
}));
export const getAdminAuditLog = handler((req) => getAuditLog(req.params.logId, context(req)));
