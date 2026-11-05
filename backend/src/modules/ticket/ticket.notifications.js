import {
  renderTicketAssignedEmail,
  renderTicketCreatedEmail,
  renderTicketReplyEmail,
  renderTicketStatusUpdateEmail,
} from '../../templates/email/index.js';

async function enqueueEmail(payload) {
  const { enqueueEmail: enqueue } = await import('../email/email.service.js');
  return enqueue(payload);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function queueTicketCreatedEmail(ticket, requester) {
  const rendered = renderTicketCreatedEmail({
    name: requester.name,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
  });
  return enqueueEmail({
    recipient: requester.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    emailType: 'ticket_created',
    ticketId: String(ticket._id),
  });
}

export function queueTicketReplyEmail(ticket, body) {
  const rendered = renderTicketReplyEmail({
    name: ticket.requesterId?.name || 'there',
    ticketNumber: ticket.ticketNumber,
    message: { body, type: 'public' },
  });
  return enqueueEmail({
    recipient: ticket.requesterEmail,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    emailType: 'ticket_reply',
    ticketId: String(ticket._id),
    ticketMessageType: 'public',
  });
}

export function queueAgentAssignmentEmail(agent, ticket, { reassigned = false } = {}) {
  const subject = `Ticket ${ticket.ticketNumber} ${reassigned ? 'reassigned' : 'assigned'}`;
  const action = reassigned ? 'has been reassigned from you' : 'has been assigned to you';
  const text = `Hello ${agent.name},\n\nTicket ${ticket.ticketNumber} ${action}: ${ticket.subject}`;
  const html = `<p>Hello ${escapeHtml(agent.name)},</p><p>Ticket <strong>${escapeHtml(ticket.ticketNumber)}</strong> ${action}.</p><p>${escapeHtml(ticket.subject)}</p>`;
  return enqueueEmail({
    recipient: agent.email,
    subject,
    text,
    html,
    emailType: 'ticket_assigned',
    ticketId: String(ticket._id),
  });
}

function customerTicketDetails(ticket, agentName) {
  return {
    name: ticket.requesterId?.name || 'there',
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    categoryName: ticket.category?.name,
    agentName: agentName || ticket.assignedTo?.name,
  };
}

export function queueCustomerAssignmentEmail(ticket, agent, enqueue = enqueueEmail) {
  const rendered = renderTicketAssignedEmail(customerTicketDetails(ticket, agent.name));
  return enqueue({
    recipient: ticket.requesterEmail,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    emailType: 'ticket_assigned',
    ticketId: String(ticket._id),
  });
}

export function queueCustomerStatusEmail(ticket, status, enqueue = enqueueEmail) {
  const rendered = renderTicketStatusUpdateEmail({
    ...customerTicketDetails(ticket),
    status,
  });
  return enqueue({
    recipient: ticket.requesterEmail,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    emailType: 'ticket_status_update',
    ticketId: String(ticket._id),
  });
}
