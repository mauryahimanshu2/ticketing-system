import * as service from './sla.service.js';
import { adminContextFromRequest, createHandler } from '../../utils/http.js';

const handler = (operation, status = 200) => createHandler(operation, {
  status,
  logLabel: 'SLA operation failed',
  fallbackMessage: 'SLA operation could not be completed',
});

export const createPolicy = handler((req) => service.createPolicy(req.body, adminContextFromRequest(req)), 201);
export const listPolicies = handler((req) => service.listPolicies(req.query, adminContextFromRequest(req)));
export const getPolicy = handler((req) => service.getPolicy(req.params.slaId, adminContextFromRequest(req)));
export const updatePolicy = handler((req) => service.updatePolicy(req.params.slaId, req.body, adminContextFromRequest(req)));
export const deletePolicy = handler((req) => service.deletePolicy(req.params.slaId, adminContextFromRequest(req)));
