import mongoose from 'mongoose';

const { Schema } = mongoose;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ticketSchema = new Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requesterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: emailPattern,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
      default: 'open',
      required: true,
    },
    emailReplyAddress: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
      validate: {
        validator: (value) => value === undefined || emailPattern.test(value),
        message: 'emailReplyAddress must be a valid email address',
      },
    },
    lastMessageAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      required: true,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    blockReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    slaSnapshot: {
      policyId: { type: Schema.Types.ObjectId, ref: 'SlaPolicy', default: null },
      policyName: { type: String, trim: true, default: null },
      priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'] },
      firstResponseMinutes: { type: Number, min: 0 },
      resolutionMinutes: { type: Number, min: 0 },
      appliedAt: { type: Date },
    },
  },
  { timestamps: true, collection: 'tickets' },
);

ticketSchema.index({ ticketNumber: 1 }, { unique: true, name: 'ticket_number_unique' });
ticketSchema.index(
  { emailReplyAddress: 1 },
  {
    unique: true,
    partialFilterExpression: { emailReplyAddress: { $type: 'string' } },
    name: 'ticket_reply_address_unique',
  },
);
ticketSchema.index({ requesterId: 1, createdAt: -1 }, { name: 'ticket_requester_created' });
ticketSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 }, { name: 'ticket_assignee_status_updated' });
ticketSchema.index({ status: 1, createdAt: -1 }, { name: 'ticket_status_created' });
ticketSchema.index({ priority: 1, createdAt: -1 }, { name: 'ticket_priority_created' });
ticketSchema.index({ createdAt: -1 }, { name: 'ticket_created' });

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);

export default Ticket;
