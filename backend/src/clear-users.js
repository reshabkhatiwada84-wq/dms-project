const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const clearUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const result = await User.deleteMany({});
    console.log(`Deleted ${result.deletedCount} users`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error clearing users:', err);
    process.exit(1);
  }
};

clearUsers();
