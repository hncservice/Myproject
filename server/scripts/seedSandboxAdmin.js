'use strict';

require('dotenv').config();

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const AdminUser = require('../features/administration/models/AdminUser');

const SANDBOX_DB = 'hnc_step15q_sandbox';

async function main() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;
  const email = process.env.HNC_SANDBOX_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.HNC_SANDBOX_ADMIN_PASSWORD;

  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Set NODE_ENV to development before running this script.');
  }

  if (!uri || !email || !password) {
    throw new Error('Sandbox MongoDB URI, admin email, and password are required.');
  }

  const target = new URL(uri);
  const databaseName = decodeURIComponent(target.pathname.slice(1));

  if (
    !['mongodb:', 'mongodb+srv:'].includes(target.protocol) ||
    databaseName !== SANDBOX_DB ||
    target.searchParams.getAll('dbName').some(name => name !== SANDBOX_DB)
  ) {
    throw new Error(`The sandbox connection must target ${SANDBOX_DB}.`);
  }

  await mongoose.connect(uri, {
    dbName: SANDBOX_DB,
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
  });

  if (mongoose.connection.name !== SANDBOX_DB) {
    throw new Error('Connected to an unexpected database.');
  }

  const existingAdmin = await AdminUser.findOne({ email }).select('_id').lean();

  if (existingAdmin) {
    console.log(`Sandbox admin already exists: ${email}. Use its existing password.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await AdminUser.create({
    name: 'Sandbox Admin',
    email,
    passwordHash,
    role: 'admin',
  });

  console.log(`Sandbox admin created in ${SANDBOX_DB}: ${email}`);
}

main()
  .catch(error => {
    const message = error.name === 'MongoServerSelectionError'
      ? 'Unable to connect to the sandbox database.'
      : error.message;

    console.error(
      error.name === 'TypeError' && error.code === 'ERR_INVALID_URL'
        ? 'The sandbox MongoDB URI is invalid.'
        : message
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());