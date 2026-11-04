import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      enum: ['admin'],
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 64,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' },
);

auditLogSchema.index({ createdAt: -1, _id: -1 }, { name: 'audit_log_created' });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 }, { name: 'audit_log_target' });
auditLogSchema.index({ actorId: 1, createdAt: -1 }, { name: 'audit_log_actor' });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
