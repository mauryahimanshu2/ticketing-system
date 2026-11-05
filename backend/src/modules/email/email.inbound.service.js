import { httpError } from '../../utils/http.js';
import * as ticketRepository from '../ticket/ticket.repository.js';
import { queueAgentCustomerReplyEmail } from '../ticket/ticket.notifications.js';
import { validateInboundEmail } from './email.inbound.validator.js';

export function createInboundEmailService({
  repository = ticketRepository,
  notifyAgent = queueAgentCustomerReplyEmail,
} = {}) {
  return async function processInboundEmail(input) {
    const email = validateInboundEmail(input);
    const existing = await repository.findMessageByEmailId(email.messageId);
    if (existing) {
      return { status: 'duplicate', ticketId: String(existing.ticketId) };
    }

    const ticket = await repository.findTicketByReplyAddress(email.recipient);
    if (!ticket) throw httpError('Ticket reply address was not recognized', 404);
    if (ticket.isBlocked) throw httpError('Ticket is blocked', 423);
    if (email.sender !== ticket.requesterEmail.toLowerCase()) {
      throw httpError('Reply sender does not match the ticket requester', 403);
    }

    let message;
    try {
      message = await repository.createMessage({
        ticketId: ticket._id,
        senderId: ticket.requesterId?._id || ticket.requesterId,
        senderEmail: email.sender,
        senderRole: 'user',
        type: 'public',
        body: email.body,
        source: 'email',
        emailMessageId: email.messageId,
        ...(email.inReplyTo ? { emailInReplyTo: email.inReplyTo } : {}),
      });
    } catch (error) {
      if (error.code === 11000) {
        return { status: 'duplicate', ticketId: String(ticket._id) };
      }
      throw error;
    }

    const receivedAt = new Date();
    const nextStatus = ticket.status === 'pending' ? 'in_progress' : ticket.status;
    await repository.updateTicket(ticket._id, {
      status: nextStatus,
      lastMessageAt: receivedAt,
    });
    await repository.createActivity({
      ticketId: ticket._id,
      actorId: ticket.requesterId?._id || ticket.requesterId,
      action: 'customer_reply',
      metadata: { messageId: message._id, type: 'public', source: 'email' },
    });

    let agentNotification = 'not_applicable';
    if (ticket.assignedTo?.email && !ticket.assignedTo.isBlocked) {
      try {
        await notifyAgent(ticket, email.body);
        agentNotification = 'queued';
      } catch (error) {
        agentNotification = 'not_queued';
        console.error(`Inbound reply notification was not queued (${error.name})`);
      }
    }

    return {
      status: 'processed',
      ticketId: String(ticket._id),
      messageId: String(message._id),
      ticketStatus: nextStatus,
      agentNotification,
    };
  };
}

export const processInboundEmail = createInboundEmailService();
