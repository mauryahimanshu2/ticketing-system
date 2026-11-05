import mongoose from 'mongoose';

const { Schema } = mongoose;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailEventSchema = new Schema(
  {
    providerMessageId: {
      type: String,
      trim: true,
    },
    messageId: {
      type: String,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      select: false,
    },
    payloadHash: {
      type: String,
      trim: true,
      select: false,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'received', 'processed', 'failed'],
      required: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: emailPattern,
    },
    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: emailPattern,
    },
    emailType: {
      type: String,
      enum: [
        'otp',
        'welcome',
        'ticket_created',
        'ticket_reply',
        'ticket_assigned',
        'ticket_status_update',
        'ticket_information_request',
        'ticket_notification',
        'password_reset',
      ],
      required: true,
    },
    error: {
      type: String,
      trim: true,
      maxlength: 4000,
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true, collection: 'email_events' },
);

emailEventSchema.index(
  { direction: 1, providerMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      direction: 'inbound',
      providerMessageId: { $type: 'string' },
    },
    name: 'email_event_inbound_provider_id_unique',
  },
);
emailEventSchema.index(
  { direction: 1, messageId: 1 },
  {
    unique: true,
    partialFilterExpression: { direction: 'inbound', messageId: { $type: 'string' } },
    name: 'email_event_inbound_message_id_unique',
  },
);
emailEventSchema.index({ direction: 1, status: 1, createdAt: 1 }, { name: 'email_event_queue_status' });
emailEventSchema.index({ ticketId: 1, createdAt: -1 }, { name: 'email_event_ticket_created' });
emailEventSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    name: 'email_event_idempotency_unique',
  },
);

const EmailEvent = mongoose.models.EmailEvent || mongoose.model('EmailEvent', emailEventSchema);

export default EmailEvent;
