import mongoose from 'mongoose';

const { Schema } = mongoose;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const attachmentSchema = new Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const ticketMessageSchema = new Schema(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: emailPattern,
    },
    senderRole: {
      type: String,
      enum: ['user', 'agent', 'admin', 'external', 'system'],
      required: true,
    },
    type: {
      type: String,
      enum: ['public', 'internal'],
      default: 'public',
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    source: {
      type: String,
      enum: ['web', 'email'],
      default: 'web',
      required: true,
    },
    emailMessageId: {
      type: String,
      trim: true,
    },
    emailInReplyTo: {
      type: String,
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ticket_messages' },
);

ticketMessageSchema.index({ ticketId: 1, createdAt: -1 }, { name: 'ticket_message_ticket_created' });
ticketMessageSchema.index(
  { emailMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { emailMessageId: { $type: 'string' } },
    name: 'ticket_message_email_id_unique',
  },
);

const TicketMessage =
  mongoose.models.TicketMessage || mongoose.model('TicketMessage', ticketMessageSchema);

export default TicketMessage;
