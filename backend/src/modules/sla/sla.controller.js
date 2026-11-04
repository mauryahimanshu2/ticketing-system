import * as service from './sla.service.js';

function handler(operation, status = 200) {
  return async (req, res) => {
    try {
      return res.status(status).json(await operation(req));
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error(`SLA operation failed (${error.name})`);
      return res.status(503).json({ error: 'SLA operation could not be completed' });
    }
  };
}

function context(req) {
  return { actorId: req.auth.userId, actorRole: req.auth.role, ipAddress: req.ip };
}

export const createPolicy = handler((req) => service.createPolicy(req.body, context(req)), 201);
export const listPolicies = handler((req) => service.listPolicies(req.query, context(req)));
export const getPolicy = handler((req) => service.getPolicy(req.params.slaId, context(req)));
export const updatePolicy = handler((req) => service.updatePolicy(req.params.slaId, req.body, context(req)));
export const deletePolicy = handler((req) => service.deletePolicy(req.params.slaId, context(req)));
