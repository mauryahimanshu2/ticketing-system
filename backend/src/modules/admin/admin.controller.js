import * as adminService from './admin.service.js';
import { validateAuditQuery } from './admin.validator.js';
import { getAuditLog, listAuditLogs } from '../auditLog/auditLog.service.js';
import { adminContextFromRequest, createHandler } from '../../utils/http.js';

const handler = (operation, status = 200) => createHandler(operation, {
  status,
  logLabel: 'Admin request failed',
  fallbackMessage: 'Admin operation could not be completed',
});

export const listUsers = handler((req) => adminService.listUsers(req.query, adminContextFromRequest(req)));
export const getUser = handler((req) => adminService.getUser(req.params.userId, adminContextFromRequest(req)));
export const blockUser = handler((req) => adminService.setManagedUserBlocked(req.params.userId, true, req.body, adminContextFromRequest(req)));
export const unblockUser = handler((req) => adminService.setManagedUserBlocked(req.params.userId, false, req.body, adminContextFromRequest(req)));

export const listAdminAuditLogs = handler((req) => listAuditLogs({
  ...validateAuditQuery(req.query),
  actorRole: req.auth.role,
}));
export const getAdminAuditLog = handler((req) => getAuditLog(req.params.logId, adminContextFromRequest(req)));
