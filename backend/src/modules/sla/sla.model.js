import mongoose from 'mongoose';

const { Schema } = mongoose;

const slaPolicySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], required: true },
    firstResponseMinutes: { type: Number, min: 1, required: true },
    resolutionMinutes: { type: Number, min: 1, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, collection: 'sla_policies' },
);

slaPolicySchema.index({ name: 1 }, { unique: true, name: 'sla_policy_name_unique' });
slaPolicySchema.index({ priority: 1, isActive: 1 }, { name: 'sla_policy_priority_active' });

const SlaPolicy = mongoose.models.SlaPolicy || mongoose.model('SlaPolicy', slaPolicySchema);

export default SlaPolicy;
