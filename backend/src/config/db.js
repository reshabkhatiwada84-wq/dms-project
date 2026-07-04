const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars explicitly, ensuring we get the right .env file path
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
