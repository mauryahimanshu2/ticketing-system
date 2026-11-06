import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDatabase from './connect.js';
import Category from '../modules/category/category.model.js';
import User from '../modules/user/user.model.js';

const defaultCategories = [
  { name: 'account access', description: 'Sign-in, verification, and account access.' },
  { name: 'billing', description: 'Payments, invoices, and billing questions.' },
  { name: 'bug report', description: 'Report unexpected behavior or software defects.' },
  { name: 'feature request', description: 'Suggest product improvements or new features.' },
  { name: 'general', description: 'General questions and support requests.' },
  { name: 'orders', description: 'Questions about orders and fulfillment.' },
  { name: 'privacy and security', description: 'Privacy concerns and account security issues.' },
  { name: 'returns and refunds', description: 'Return, refund, and exchange requests.' },
  { name: 'technical support', description: 'Technical issues and troubleshooting.' },
  { name: 'website feedback', description: 'Feedback about the website or user experience.' },
];

const defaultAgents = [
  { name: 'Aarav Sharma', email: 'aarav.sharma@example.com' },
  { name: 'Priya Verma', email: 'priya.verma@example.com' },
  { name: 'Rahul Singh', email: 'rahul.singh@example.com' },
  { name: 'Ananya Gupta', email: 'ananya.gupta@example.com' },
  { name: 'Aditya Mishra', email: 'aditya.mishra@example.com' },
  { name: 'Sneha Patel', email: 'sneha.patel@example.com' },
  { name: 'Rohan Kumar', email: 'rohan.kumar@example.com' },
  { name: 'Neha Yadav', email: 'neha.yadav@example.com' },
  { name: 'Vikram Joshi', email: 'vikram.joshi@example.com' },
  { name: 'Pooja Maurya', email: 'pooja.maurya@example.com' },
];

function getAgentPassword() {
  const password = process.env.AGENT_PASSWORD || "Agent@12345";
  if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('AGENT_PASSWORD must be at least 8 characters and at most 72 UTF-8 bytes');
  }
  return password;
}

async function seedAgent() {
  const password = getAgentPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  let created = 0;

  for (const agent of defaultAgents) {
    const existing = await User.findOne({ email: agent.email }).select('_id role');
    if (existing) {
      if (existing.role !== 'agent') {
        throw new Error(`${agent.email} already belongs to a non-agent account; refusing to change its role`);
      }
      continue;
    }

    try {
      await User.create({
        ...agent,
        passwordHash,
        role: 'agent',
        isVerified: true,
      });
      created += 1;
    } catch (error) {
      if (error.code === 11000) {
        const raced = await User.findOne({ email: agent.email }).select('_id role');
        if (raced?.role === 'agent') continue;
      }
      throw error;
    }
  }

  console.log(`Agents seeded; ${created} created, ${defaultAgents.length - created} already existed`);
}

async function seedCategories() {
  let created = 0;
  for (const category of defaultCategories) {
    try {
      const result = await Category.updateOne(
        { name: category.name },
        { $setOnInsert: { ...category, isActive: true } },
        { upsert: true, runValidators: true },
      );
      if (result.upsertedCount) created += 1;
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Another seeder may have inserted this unique category concurrently.
    }
  }
  console.log(`Categories seeded; ${created} created, ${defaultCategories.length - created} already existed`);
}

try {
  getAgentPassword();
  await connectDatabase();
  await seedAgent();
  await seedCategories();
} catch (error) {
  console.error(`Support data seeding failed (${error.name}): ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
