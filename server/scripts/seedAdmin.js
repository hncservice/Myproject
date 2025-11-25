// server/scripts/seedAdmin.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const email = 'hncservice.it@gmail.com';  // change to your email
    const password = 'Hnc@qa]1991>';       // change to a strong password

    let admin = await AdminUser.findOne({ email });
    if (admin) {
      console.log('Admin already exists:', admin.email);
      return process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    admin = await AdminUser.create({
      name: 'Super Admin',
      email,
      passwordHash,
      role: 'admin'
    });

    console.log('✅ Admin created:');
    console.log('   Email   :', email);
    console.log('   Password:', password);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
