import * as service from './agent.service.js';

function actor(req) {
  return {
    userId: req.auth.userId,
    role: req.auth.role,
    ipAddress: req.ip,
  };
}

function handler(operation, status = 200) {
  return async (req, res) => {
    try {
      return res.status(status).json(await operation(req));
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error(`Agent operation failed (${error.name})`);
      return res.status(503).json({ error: 'Agent operation could not be completed' });
    }
  };
}

export const createAgent = handler((req) => service.createAgent(req.body, actor(req)), 201);
export const listAgents = handler((req) => service.listAgents(req.query, actor(req)));
export const getAgent = handler((req) => service.getAgent(req.params.agentId, actor(req)));
export const updateAgent = handler((req) => service.updateAgent(req.params.agentId, req.body, actor(req)));
export const blockAgent = handler((req) => service.setAgentBlocked(req.params.agentId, true, req.body, actor(req)));
export const unblockAgent = handler((req) => service.setAgentBlocked(req.params.agentId, false, req.body, actor(req)));
