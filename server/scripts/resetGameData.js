/**
 * HNC Game Platform - explicit allowlist database reset.
 * Default: READ-ONLY preview. Does not drop collections or the database.
 * Run from server/: node scripts/resetGameData.js
 * Apply: node scripts/resetGameData.js --apply --confirm-db=YOUR_DB_NAME --confirm-delete=DELETE-HNC-GAME-DATA
 * In production, also supply --allow-production.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const COLLECTIONS_TO_CLEAR = Object.freeze([
  'users',
  'vendors',
  'spins',
  'wheelitems',
  'gamesessions',
  'prizeawards',
]);
const ADMIN_COLLECTION = 'adminusers';
const CONFIRM_DELETE = 'DELETE-HNC-GAME-DATA';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}
function abort(message) {
  console.error(`STOP: ${message}`);
  process.exitCode = 1;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) return abort('MONGO_URI is not configured in server/.env');

  const apply = process.argv.includes('--apply');
  const production = process.env.NODE_ENV === 'production';

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  try {
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    const available = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name));
    const adminCount = available.has(ADMIN_COLLECTION)
      ? await db.collection(ADMIN_COLLECTION).countDocuments()
      : 0;

    console.log(`Database: ${dbName}`);
    console.log(`Mode: ${apply ? 'APPLY REQUESTED' : 'DRY RUN (read-only)'}`);
    console.log(`Admin collection: ${ADMIN_COLLECTION} (${adminCount} records) - PRESERVE`);

    const counts = {};
    for (const name of COLLECTIONS_TO_CLEAR) {
      counts[name] = available.has(name) ? await db.collection(name).countDocuments() : null;
      console.log(`${name}: ${counts[name] === null ? 'not present' : counts[name] + ' records'} ${apply ? '(target)' : '(would delete)'}`);
    }

    if (!apply) {
      console.log('No writes made. Keep a verified backup and check database name before applying.');
      return;
    }

    if (argument('confirm-db') !== dbName) return abort(`Pass --confirm-db=${dbName} to approve the exact connected database`);
    if (argument('confirm-delete') !== CONFIRM_DELETE) return abort(`Pass --confirm-delete=${CONFIRM_DELETE}`);
    if (production && !process.argv.includes('--allow-production')) {
      return abort('Production reset requires --allow-production after verified backup and staging rehearsal');
    }
    if (!available.has(ADMIN_COLLECTION) || adminCount < 1) {
      return abort('No admin accounts found; refusing reset to prevent admin lockout');
    }

    console.log('Deleting documents from explicit allowlist only. No collection or database drops.');
    for (const name of COLLECTIONS_TO_CLEAR) {
      if (!available.has(name)) continue;
      const result = await db.collection(name).deleteMany({});
      console.log(`Cleared ${name}: ${result.deletedCount} deleted`);
    }
    const remainingAdmins = await db.collection(ADMIN_COLLECTION).countDocuments();
    console.log(`Complete. Preserved ${remainingAdmins} admin account(s).`);
    console.log('If any unused collections remain, inspect them manually before deciding whether to clear them.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exitCode = 1;
});
