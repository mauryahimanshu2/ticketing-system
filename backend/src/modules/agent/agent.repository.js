import Ticket from '../ticket/ticket.model.js';
import * as userRepository from '../user/user.repository.js';

export async function create(agentData) {
  return userRepository.createManagedUser(agentData);
}

export async function list(options) {
  return userRepository.listManagedUsers({ ...options, role: 'agent' });
}

export async function findById(agentId) {
  return userRepository.findManagedUser(agentId, 'agent');
}

export async function getTicketStats(agentId) {
  const [total, open] = await Promise.all([
    Ticket.countDocuments({ assignedTo: agentId }),
    Ticket.countDocuments({
      assignedTo: agentId,
      status: { $in: ['open', 'in_progress', 'pending'] },
    }),
  ]);
  return { total, open };
}

export async function update(agentId, updates, revokeSessions) {
  return userRepository.updateManagedUser(agentId, 'agent', updates, revokeSessions);
}

export async function setBlocked(agentId, isBlocked, reason = null) {
  return userRepository.setUserBlocked(agentId, 'agent', isBlocked, reason);
}
