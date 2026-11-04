import Ticket from './ticket.model.js';
import User from '../user/user.model.js';
import TicketMessage from '../ticketMessage/ticketMessage.model.js';
import TicketActivity from '../ticketActivity/ticketActivity.model.js';

export async function findActor(userId) {
  return User.findById(userId).select('name email role isBlocked isVerified').lean();
}

export async function createTicket(data) {
  return Ticket.create(data);
}

export async function createActivity(data) {
  return TicketActivity.create(data);
}

export async function findTicket(ticketId, scope) {
  return Ticket.findOne({ _id: ticketId, ...scope })
    .populate('requesterId', 'name email')
    .populate('assignedTo', 'name email role isBlocked')
    .populate('assignedBy', 'name email role')
    .populate('category', 'name isActive')
    .lean();
}

export async function listTickets({ scope, filter, page, limit }) {
  const query = { ...scope, ...filter };
  const [items, total] = await Promise.all([
    Ticket.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('requesterId', 'name email')
      .populate('assignedTo', 'name email role')
      .populate('category', 'name')
      .lean(),
    Ticket.countDocuments(query),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function getTicketHistory(ticketId, { includeInternal = false } = {}) {
  const messageFilter = { ticketId, ...(includeInternal ? {} : { type: 'public' }) };
  const activityFilter = {
    ticketId,
    ...(includeInternal ? {} : { 'metadata.type': { $ne: 'internal' } }),
  };
  const [messages, activities] = await Promise.all([
    TicketMessage.find(messageFilter).sort({ createdAt: 1, _id: 1 })
      .populate('senderId', 'name email role').lean(),
    TicketActivity.find(activityFilter).sort({ createdAt: 1, _id: 1 })
      .populate('actorId', 'name email role').lean(),
  ]);
  return { messages, activities };
}

export async function updateTicket(ticketId, updates, scope = {}) {
  return Ticket.findOneAndUpdate(
    { _id: ticketId, ...scope },
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  );
}

export async function createMessage(data) {
  return TicketMessage.create(data);
}

export async function touchLastMessage(ticketId, date) {
  return Ticket.updateOne({ _id: ticketId }, { $set: { lastMessageAt: date } });
}

export async function listAllAdminTickets({ filter, page, limit }) {
  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('requesterId', 'name email')
      .populate('assignedTo', 'name email role isBlocked')
      .populate('category', 'name')
      .lean(),
    Ticket.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function findTicketWithHistory(ticketId) {
  const ticket = await findTicket(ticketId, {});
  if (!ticket) return null;
  const history = await getTicketHistory(ticketId, { includeInternal: true });
  return { ...ticket, ...history };
}
