import mongoose from 'mongoose';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  { timestamps: true, collection: 'categories' },
);

categorySchema.index({ name: 1 }, { unique: true, name: 'category_name_unique' });
categorySchema.index({ isActive: 1, name: 1 }, { name: 'category_active_name' });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

export default Category;
