import * as service from './ticket.service.js';

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
      console.error(`Ticket operation failed (${error.name})`);
      return res.status(503).json({ error: 'Ticket operation could not be completed' });
    }
  };
}

export const createTicket = handler((req) => service.createTicket(req.body, actor(req)), 201);
export const listTickets = handler((req) => service.listTickets(req.query, actor(req)));
export const getTicket = handler((req) => service.getTicket(req.params.ticketId, actor(req)));
export const replyToTicket = handler((req) => service.replyToTicket(req.params.ticketId, req.body, actor(req)), 201);
export const changeTicketStatus = handler((req) => service.changeTicketStatus(req.params.ticketId, req.body, actor(req)));
export const changeTicketPriority = handler((req) => service.changeTicketPriority(req.params.ticketId, req.body, actor(req)));
export const changeTicketCategory = handler((req) => service.changeTicketCategory(req.params.ticketId, req.body, actor(req)));
export const assignTicket = handler((req) => service.assignTicket(req.params.ticketId, req.body, actor(req)));
export const reassignTicket = handler((req) => service.assignTicket(req.params.ticketId, req.body, actor(req), { reassign: true }));
export const blockTicket = handler((req) => service.setTicketBlocked(req.params.ticketId, req.body, actor(req), true));
export const unblockTicket = handler((req) => service.setTicketBlocked(req.params.ticketId, req.body, actor(req), false));
export const listAdminTickets = handler((req) => service.listAdminTickets(req.query, actor(req)));
export const getAdminTicket = handler((req) => service.getAdminTicket(req.params.ticketId, actor(req)));
