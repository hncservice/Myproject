// server/scripts/seedAdmin.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD not set');
    }

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

    console.log('✅ Admin created with email:', email);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
