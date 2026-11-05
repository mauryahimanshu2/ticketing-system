import Ticket from '../ticket/ticket.model.js';
import * as userRepository from '../user/user.repository.js';
import { recordAdminAction } from '../auditLog/auditLog.service.js';
import { publicUser } from '../user/user.presenter.js';
import { requireAdmin } from '../../utils/authorization.js';
import { httpError } from '../../utils/http.js';
import {
  validateEmptyBody,
  validateEntityId,
  validateListQuery,
  validateReason,
} from './admin.validator.js';

async function findManagedOr404(id, role) {
  const user = await userRepository.findManagedUser(id, role);
  if (!user) throw httpError(`${role === 'agent' ? 'Agent' : 'User'} not found`, 404);
  return user;
}

export async function listUsers(input, context) {
  requireAdmin(context);
  return userRepository.listManagedUsers({
    ...validateListQuery(input, { includeVerification: true }),
    role: 'user',
  });
}

export async function getUser(userId, context) {
  requireAdmin(context);
  const id = validateEntityId(userId, 'userId');
  const user = await findManagedOr404(id, 'user');
  const [totalTickets, openTickets] = await Promise.all([
    Ticket.countDocuments({ requesterId: id }),
    Ticket.countDocuments({ requesterId: id, status: { $in: ['open', 'in_progress', 'pending'] } }),
  ]);
  return { ...user, ticketStats: { total: totalTickets, open: openTickets } };
}

export async function setManagedUserBlocked(userId, blocked, input, context) {
  requireAdmin(context);
  const id = validateEntityId(userId, 'userId');
  const reason = blocked ? validateReason(input) : null;
  if (!blocked) validateEmptyBody(input);
  const updated = await userRepository.setUserBlocked(id, 'user', blocked, reason);
  if (!updated) throw httpError('User not found', 404);
  await recordAdminAction({
    ...context,
    action: blocked ? 'user_blocked' : 'user_unblocked',
    targetType: 'user',
    targetId: id,
    details: blocked ? { reason } : {},
  });
  return publicUser(updated);
}
