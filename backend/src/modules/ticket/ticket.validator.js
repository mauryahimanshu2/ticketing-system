import mongoose from 'mongoose';
import { httpError } from '../../utils/http.js';
import {
  parsePagination,
  rejectUnknownFields,
  validateObjectId,
} from '../../utils/validation.js';

export const ticketStatuses = new Set(['open', 'in_progress', 'pending', 'resolved', 'closed']);
export const ticketPriorities = new Set(['low', 'medium', 'high', 'urgent']);

export function validateTicketId(value) {
  return validateObjectId(value, 'ticketId');
}

export function validateCreateTicket(input, role) {
  const allowedFields = role === 'admin'
    ? new Set(['subject', 'description', 'category', 'requesterId', 'priority'])
    : new Set(['subject', 'description', 'category']);
  rejectUnknownFields(input, allowedFields);

  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!subject || subject.length > 500) {
    throw httpError('Subject is required and must be at most 500 characters', 400);
  }
  if (!description || description.length > 20000) {
    throw httpError('Description is required and must be at most 20000 characters', 400);
  }

  const priority = input.priority === undefined ? 'medium' : input.priority;
  if (!ticketPriorities.has(priority)) throw httpError('A valid priority is required', 400);

  return {
    subject,
    description,
    priority,
    requesterId: role === 'admin' ? validateObjectId(input.requesterId, 'requesterId') : undefined,
    categoryId: input.category === undefined ? null : validateObjectId(input.category, 'category'),
  };
}

export function validateReply(input) {
  rejectUnknownFields(input, new Set(['body', 'type']));
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body || body.length > 20000) {
    throw httpError('Message body is required and must be at most 20000 characters', 400);
  }

  const type = input.type === undefined ? 'public' : input.type;
  if (!['public', 'internal'].includes(type)) {
    throw httpError('type must be public or internal', 400);
  }
  return { body, type };
}

export function validateInformationRequest(input) {
  rejectUnknownFields(input, new Set(['message']));
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message || message.length > 20000) {
    throw httpError('Message is required and must be at most 20000 characters', 400);
  }
  return message;
}

export function validateStatusChange(input) {
  rejectUnknownFields(input, new Set(['status']));
  if (!ticketStatuses.has(input.status)) throw httpError('A valid ticket status is required', 400);
  return input.status;
}

export function validatePriorityChange(input) {
  rejectUnknownFields(input, new Set(['priority']));
  if (!ticketPriorities.has(input.priority)) throw httpError('A valid priority is required', 400);
  return input.priority;
}

export function validateCategoryChange(input) {
  rejectUnknownFields(input, new Set(['category']));
  return input.category === null ? null : validateObjectId(input.category, 'category');
}

export function validateAssignment(input, { reassign = false } = {}) {
  rejectUnknownFields(input, reassign ? new Set(['agentId', 'reason']) : new Set(['agentId']));
  const agentId = validateObjectId(input.agentId, 'agentId');
  let reason;

  if (reassign) {
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) {
      throw httpError('A reassignment reason of at most 500 characters is required', 400);
    }
    reason = input.reason.trim();
  }
  return { agentId, reason };
}

export function validateBlockChange(input, blocked) {
  rejectUnknownFields(input, blocked ? new Set(['reason']) : new Set());
  if (!blocked) return undefined;

  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) {
    throw httpError('A blocking reason of at most 500 characters is required', 400);
  }
  return input.reason.trim();
}

export function validateTicketListQuery(query, { admin = false } = {}) {
  const { page, limit } = parsePagination(query);
  const filter = {};

  if (query.status !== undefined) {
    if (!ticketStatuses.has(query.status)) throw httpError('status is invalid', 400);
    filter.status = query.status;
  }
  if (query.priority !== undefined) {
    if (!ticketPriorities.has(query.priority)) throw httpError('priority is invalid', 400);
    filter.priority = query.priority;
  }

  if (admin) addAdminFilters(query, filter);
  return { page, limit, filter };
}

function addAdminFilters(query, filter) {
  if (query.category !== undefined) filter.category = validateObjectId(query.category, 'category');
  if (query.assignedTo !== undefined) filter.assignedTo = validateObjectId(query.assignedTo, 'assignedTo');

  if (query.from || query.to) {
    const createdAt = {};
    if (query.from) {
      const from = new Date(query.from);
      if (Number.isNaN(from.getTime())) throw httpError('from must be a valid date', 400);
      createdAt.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (Number.isNaN(to.getTime())) throw httpError('to must be a valid date', 400);
      createdAt.$lte = to;
    }
    if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
      throw httpError('from must be earlier than or equal to to', 400);
    }
    filter.createdAt = createdAt;
  }

  if (query.search !== undefined) addSearchFilter(query.search, filter);
}

function addSearchFilter(value, filter) {
  if (typeof value !== 'string' || value.length > 120) throw httpError('search is invalid', 400);

  const search = value.trim();
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  filter.$or = [
    ...(mongoose.isValidObjectId(search) ? [{ _id: search }] : []),
    { subject: { $regex: escapedSearch, $options: 'i' } },
    { ticketNumber: { $regex: escapedSearch, $options: 'i' } },
  ];
}
