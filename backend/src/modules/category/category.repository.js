import Category from './category.model.js';
import Ticket from '../ticket/ticket.model.js';

export async function createCategory(data) {
  return Category.create(data);
}

export async function listCategories({ page, limit, search, active }) {
  const filter = {};
  if (active !== undefined) filter.isActive = active;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escaped, $options: 'i' };
  }
  const [items, total] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function findCategoryById(id) {
  return Category.findById(id);
}

export async function updateCategory(id, updates) {
  return Category.findByIdAndUpdate(id, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true,
  });
}

export async function deactivateCategory(id) {
  const category = await Category.findById(id);
  if (!category) return null;
  const referenced = await Ticket.exists({ category: id });
  if (referenced) {
    category.isActive = false;
    await category.save();
    return { category, deactivated: true };
  }
  await Category.deleteOne({ _id: id });
  return { category, deactivated: false };
}
