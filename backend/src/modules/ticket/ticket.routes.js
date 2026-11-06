import express from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import {
  changeTicketPriority,
  changeTicketStatus,
  createTicket,
  getTicket,
  getTicketSummary,
  listTickets,
  replyToTicket,
  requestTicketInformation,
} from './ticket.controller.js';

const router = express.Router();
router.use(authenticate, authorizeRoles('user', 'agent', 'admin'));
router.post('/', authorizeRoles('user'), createTicket);
router.get('/', listTickets);
router.get('/summary', getTicketSummary);
router.get('/:ticketId', getTicket);
router.post('/:ticketId/messages', replyToTicket);
router.post('/:ticketId/request-information', authorizeRoles('agent', 'admin'), requestTicketInformation);
router.patch('/:ticketId/status', changeTicketStatus);
router.patch('/:ticketId/priority', changeTicketPriority);

export default router;
