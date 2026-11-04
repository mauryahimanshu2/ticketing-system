import SlaPolicy from './sla.model.js';
import Ticket from '../ticket/ticket.model.js';

export async function createPolicy(data) {
  return SlaPolicy.create(data);
}

export async function listPolicies({ page, limit, priority, active }) {
  const filter = {};
  if (priority) filter.priority = priority;
  if (active !== undefined) filter.isActive = active;
  const [items, total] = await Promise.all([
    SlaPolicy.find(filter).sort({ priority: 1, name: 1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    SlaPolicy.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function findPolicyById(id) {
  return SlaPolicy.findById(id);
}

export async function updatePolicy(id, updates) {
  return SlaPolicy.findByIdAndUpdate(id, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true,
  });
}

export async function deactivatePolicy(id) {
  const policy = await SlaPolicy.findById(id);
  if (!policy) return null;
  const referenced = await Ticket.exists({ 'slaSnapshot.policyId': id });
  if (referenced) {
    policy.isActive = false;
    await policy.save();
    return { policy, deactivated: true };
  }
  await SlaPolicy.deleteOne({ _id: id });
  return { policy, deactivated: false };
}

export async function findActivePolicyForPriority(priority) {
  return SlaPolicy.findOne({ priority, isActive: true }).sort({ updatedAt: -1, _id: 1 }).lean();
}
