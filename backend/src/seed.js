const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dms');
    console.log('MongoDB Connected for Seeding...');

    await User.deleteMany();
    console.log('Cleared existing users.');

    await User.create({
      name: 'Super Admin',
      email: 'khd.rishabh@gmail.com',
      password: 'khd@123',
      role: 'admin',
    });
    console.log('Seeded Super Admin: khd.rishabh@gmail.com / khd@123');

    await User.create({
      name: 'Admin User',
      email: 'admin@dms.com',
      password: 'adminpassword123',
      role: 'user',
    });
    console.log('Seeded Standard User: admin@dms.com / adminpassword123');

    await User.create({
      name: 'Standard User',
      email: 'user@dms.com',
      password: 'userpassword123',
      role: 'user',
    });
    console.log('Seeded Standard User: user@dms.com / userpassword123');

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`Error during seeding: ${error.message}`);
    process.exit(1);
  }
};

seedUsers();
