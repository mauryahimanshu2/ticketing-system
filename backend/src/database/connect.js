import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;
const mongoDatabaseName = process.env.MONGODB_DB_NAME;

export default async function connectDatabase() {
  await mongoose.connect(mongoUri, { dbName: mongoDatabaseName });
  console.log(`Connected to MongoDB database "${mongoose.connection.name}"`);
}
