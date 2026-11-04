import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ticketing_system';

export default async function connectDatabase() {
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB database "${mongoose.connection.name}"`);
}
