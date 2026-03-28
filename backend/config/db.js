const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/techresque';
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB at:', MONGO_URI.includes('mongodb+srv') ? 'Atlas (Cloud)' : 'Localhost');
  } catch (err) {
    console.error('MongoDB connection error', err);
    process.exit(1);
  }
};

module.exports = connectDB;
