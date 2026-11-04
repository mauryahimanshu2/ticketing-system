import mongoose from 'mongoose';

const { Schema } = mongoose;

const ticketActivitySchema = new Schema(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      enum: [
        'ticket_created',
        'status_changed',
        'assignment_changed',
        'priority_changed',
        'category_changed',
        'customer_reply',
        'agent_reply',
        'resolved',
        'closed',
        'reopened',
      ],
      required: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ticket_activities' },
);

ticketActivitySchema.index({ ticketId: 1, createdAt: -1 }, { name: 'ticket_activity_ticket_created' });
ticketActivitySchema.index({ actorId: 1, createdAt: -1 }, { name: 'ticket_activity_actor_created' });
ticketActivitySchema.index({ action: 1, createdAt: -1 }, { name: 'ticket_activity_action_created' });

const TicketActivity =
  mongoose.models.TicketActivity || mongoose.model('TicketActivity', ticketActivitySchema);

export default TicketActivity;
