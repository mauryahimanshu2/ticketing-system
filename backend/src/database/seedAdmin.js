import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDatabase from './connect.js';
import User from '../modules/user/user.model.js';

async function seedAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || name.length > 120 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_NAME and a valid ADMIN_EMAIL are required');
  }
  if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters and at most 72 UTF-8 bytes');
  }

  await connectDatabase();
  const existing = await User.findOne({ email }).select('_id role');
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('ADMIN_EMAIL already belongs to a non-admin account; refusing to promote it');
    }
    console.log('Admin account already exists; no changes made');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await User.create({
      name,
      email,
      passwordHash,
      role: 'admin',
      isVerified: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      const raced = await User.findOne({ email }).select('_id role');
      if (raced?.role === 'admin') {
        console.log('Admin account already exists; no changes made');
        return;
      }
    }
    throw error;
  }
  console.log('Admin account created');
}

try {
  await seedAdmin();
} catch (error) {
  console.error(`Admin seeding failed (${error.name})`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
