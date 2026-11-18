'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const GameSession = require('../features/games/models/GameSession');
const PrizeAward = require('../features/prizes/models/PrizeAward');

async function main() {
  await connectDB();
  // createIndexes creates only missing indexes; it does not drop collections.
  await GameSession.createIndexes();
  await PrizeAward.createIndexes();
  console.log('GameSession and PrizeAward indexes created/verified.');
  console.log('GameSession:', await GameSession.collection.indexes());
  console.log('PrizeAward:', await PrizeAward.collection.indexes());
}
main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
