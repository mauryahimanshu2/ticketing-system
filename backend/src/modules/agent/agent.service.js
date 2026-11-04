import bcrypt from 'bcryptjs';
import { recordAdminAction } from '../auditLog/auditLog.service.js';
import * as repository from './agent.repository.js';
import {
  validateAgentId,
  validateAgentInput,
  validateAgentListQuery,
  validateEmptyBody,
  validateReason,
} from './agent.validator.js';

const BCRYPT_ROUNDS = 12;

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireAdmin(actor) {
  if (actor?.role !== 'admin') throw requestError('Admin access is required', 403);
}

function publicAgent(agent) {
  if (!agent) return null;
  const value = typeof agent.toObject === 'function' ? agent.toObject() : agent;
  const allowedFields = [
    '_id',
    'name',
    'email',
    'phone',
    'role',
    'isVerified',
    'isBlocked',
    'blockedAt',
    'blockReason',
    'createdAt',
    'updatedAt',
  ];
  return Object.fromEntries(allowedFields
    .filter((field) => value[field] !== undefined)
    .map((field) => [field, value[field]]));
}

async function findAgentOr404(agentId) {
  const agent = await repository.findById(agentId);
  if (!agent) throw requestError('Agent not found', 404);
  return agent;
}

export async function createAgent(input, actor) {
  requireAdmin(actor);
  const data = validateAgentInput(input);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  try {
    const agent = await repository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: 'agent',
      isVerified: true,
    });
    await recordAdminAction({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'agent_created',
      targetType: 'user',
      targetId: agent._id,
      details: { email: agent.email },
    });
    return publicAgent(agent);
  } catch (error) {
    if (error.code === 11000) throw requestError('An account with this email already exists', 409);
    throw error;
  }
}

export async function listAgents(query, actor) {
  requireAdmin(actor);
  return repository.list(validateAgentListQuery(query));
}

export async function getAgent(agentId, actor) {
  requireAdmin(actor);
  const id = validateAgentId(agentId);
  const agent = await findAgentOr404(id);
  return { ...agent, ticketStats: await repository.getTicketStats(id) };
}

export async function updateAgent(agentId, input, actor) {
  requireAdmin(actor);
  const id = validateAgentId(agentId);
  const updates = validateAgentInput(input, { partial: true });
  const existing = await findAgentOr404(id);
  const { password, ...userUpdates } = updates;
  if (password) userUpdates.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const revokeSessions = Boolean(password || (userUpdates.email && userUpdates.email !== existing.email));

  try {
    const agent = await repository.update(id, userUpdates, revokeSessions);
    if (!agent) throw requestError('Agent not found', 404);
    await recordAdminAction({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'agent_updated',
      targetType: 'user',
      targetId: id,
      details: { changedFields: Object.keys(updates) },
    });
    return publicAgent(agent);
  } catch (error) {
    if (error.code === 11000) throw requestError('An account with this email already exists', 409);
    throw error;
  }
}

export async function setAgentBlocked(agentId, blocked, input, actor) {
  requireAdmin(actor);
  const id = validateAgentId(agentId);
  const reason = blocked ? validateReason(input) : null;
  if (!blocked) validateEmptyBody(input);
  const agent = await repository.setBlocked(id, blocked, reason);
  if (!agent) throw requestError('Agent not found', 404);
  await recordAdminAction({
    actorId: actor.userId,
    ipAddress: actor.ipAddress,
    action: blocked ? 'agent_blocked' : 'agent_unblocked',
    targetType: 'user',
    targetId: id,
    details: blocked ? { reason } : {},
  });
  return publicAgent(agent);
}
