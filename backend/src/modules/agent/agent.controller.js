import * as service from './agent.service.js';
import { actorFromRequest, createHandler } from '../../utils/http.js';

const handler = (operation, status = 200) => createHandler(operation, {
  status,
  logLabel: 'Agent operation failed',
  fallbackMessage: 'Agent operation could not be completed',
});

export const createAgent = handler((req) => service.createAgent(req.body, actorFromRequest(req)), 201);
export const listAgents = handler((req) => service.listAgents(req.query, actorFromRequest(req)));
export const getAgent = handler((req) => service.getAgent(req.params.agentId, actorFromRequest(req)));
export const updateAgent = handler((req) => service.updateAgent(req.params.agentId, req.body, actorFromRequest(req)));
export const blockAgent = handler((req) => service.setAgentBlocked(req.params.agentId, true, req.body, actorFromRequest(req)));
export const unblockAgent = handler((req) => service.setAgentBlocked(req.params.agentId, false, req.body, actorFromRequest(req)));
