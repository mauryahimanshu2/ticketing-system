import * as service from './ticket.service.js';
import { actorFromRequest, createHandler } from '../../utils/http.js';

const handler = (operation, status = 200) => createHandler(operation, {
  status,
  logLabel: 'Ticket operation failed',
  fallbackMessage: 'Ticket operation could not be completed',
});

export const createTicket = handler((req) => service.createTicket(req.body, actorFromRequest(req)), 201);
export const listTickets = handler((req) => service.listTickets(req.query, actorFromRequest(req)));
export const getTicket = handler((req) => service.getTicket(req.params.ticketId, actorFromRequest(req)));
export const replyToTicket = handler((req) => service.replyToTicket(req.params.ticketId, req.body, actorFromRequest(req)), 201);
export const changeTicketStatus = handler((req) => service.changeTicketStatus(req.params.ticketId, req.body, actorFromRequest(req)));
export const changeTicketPriority = handler((req) => service.changeTicketPriority(req.params.ticketId, req.body, actorFromRequest(req)));
export const changeTicketCategory = handler((req) => service.changeTicketCategory(req.params.ticketId, req.body, actorFromRequest(req)));
export const assignTicket = handler((req) => service.assignTicket(req.params.ticketId, req.body, actorFromRequest(req)));
export const reassignTicket = handler((req) => service.assignTicket(req.params.ticketId, req.body, actorFromRequest(req), { reassign: true }));
export const blockTicket = handler((req) => service.setTicketBlocked(req.params.ticketId, req.body, actorFromRequest(req), true));
export const unblockTicket = handler((req) => service.setTicketBlocked(req.params.ticketId, req.body, actorFromRequest(req), false));
export const listAdminTickets = handler((req) => service.listAdminTickets(req.query, actorFromRequest(req)));
export const getAdminTicket = handler((req) => service.getAdminTicket(req.params.ticketId, actorFromRequest(req)));
