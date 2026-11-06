import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;

export default async function connectDatabase() {
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB database "${mongoose.connection.name}"`);
}
