const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const updateUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dms');
    console.log('MongoDB Connected...');

    // Change all admin users (except our new super admin) to role 'user'
    const result = await User.updateMany(
      {
        email: { $ne: 'khd.rishabh@gmail.com' },
        role: 'admin'
      },
      { $set: { role: 'user' } }
    );

    console.log(`Successfully updated ${result.modifiedCount} users from admin to user`);
    
    // Also check if our super admin exists, if not create them
    const superAdmin = await User.findOne({ email: 'khd.rishabh@gmail.com' });
    if (!superAdmin) {
      await User.create({
        name: 'Super Admin',
        email: 'khd.rishabh@gmail.com',
        password: 'khd@123',
        role: 'admin',
      });
      console.log('Created new super admin: khd.rishabh@gmail.com / khd@123');
    } else {
      console.log('Super admin already exists');
      // Make sure super admin is still admin
      if (superAdmin.role !== 'admin') {
        superAdmin.role = 'admin';
        await superAdmin.save();
        console.log('Restored super admin role');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

updateUsers();
