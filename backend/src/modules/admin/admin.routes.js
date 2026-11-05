import express from 'express';
import { requireAdmin } from '../../middleware/authenticate.js';
import {
  blockUser,
  getAdminAuditLog,
  getUser,
  listAdminAuditLogs,
  listUsers,
  unblockUser,
} from './admin.controller.js';
import {
  assignTicket,
  blockTicket,
  changeTicketCategory,
  changeTicketPriority,
  changeTicketStatus,
  createTicket,
  getAdminTicket,
  listAdminTickets,
  reassignTicket,
  requestTicketInformation,
  unblockTicket,
} from '../ticket/ticket.controller.js';
import categoryRouter from '../category/category.routes.js';
import slaRouter from '../sla/sla.routes.js';

const router = express.Router();
router.use(requireAdmin);

router.get('/users', listUsers);
router.get('/users/:userId', getUser);
router.patch('/users/:userId/block', blockUser);
router.patch('/users/:userId/unblock', unblockUser);

router.get('/audit-logs', listAdminAuditLogs);
router.get('/audit-logs/:logId', getAdminAuditLog);

router.get('/tickets', listAdminTickets);
router.post('/tickets', createTicket);
router.get('/tickets/:ticketId', getAdminTicket);
router.patch('/tickets/:ticketId/assign', assignTicket);
router.patch('/tickets/:ticketId/reassign', reassignTicket);
router.patch('/tickets/:ticketId/status', changeTicketStatus);
router.patch('/tickets/:ticketId/priority', changeTicketPriority);
router.patch('/tickets/:ticketId/category', changeTicketCategory);
router.patch('/tickets/:ticketId/block', blockTicket);
router.patch('/tickets/:ticketId/unblock', unblockTicket);
router.post('/tickets/:ticketId/request-information', requestTicketInformation);

router.use('/categories', categoryRouter);
router.use('/sla', slaRouter);

export default router;
