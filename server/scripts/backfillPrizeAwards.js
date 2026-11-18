'use strict';
/**
 * SAFE LEGACY WINNER BACKFILL
 * Dry-run (default): node scripts/backfillPrizeAwards.js
 * Apply (after reviewed backup/staging):
 *   node scripts/backfillPrizeAwards.js --apply --confirm-campaign=legacy-hnc-campaign
 *
 * Does NOT mutate Spin/User/WheelItem and never removes an existing award.
 * Assumption: all pre-migration winning Spins belong to CAMPAIGN_ID.
 * If that is not true, STOP and implement a dated/manual campaign mapping.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Spin = require('../features/games/models/Spin');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const campaignId = CAMPAIGN_POLICY.campaignId;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const confirmation = `--confirm-campaign=${campaignId}`;

function fail(message) {
  throw new Error(message);
}
function str(id) { return String(id); }
function awardMatches(award, win) {
  return str(award.userId) === str(win.userId) &&
    str(award.spinId) === str(win._id) &&
    str(award.wheelItemId) === str(win.wheelItemId) &&
    award.campaignId === campaignId;
}

async function main() {
  if (!process.env.MONGO_URI) fail('MONGO_URI is missing');
  if (!campaignId || campaignId === 'undefined') fail('Invalid campaign ID');
  if (apply && !args.includes(confirmation)) {
    fail(`Apply requires explicit ${confirmation}`);
  }
  if (apply && process.env.NODE_ENV === 'production' && !args.includes('--allow-production')) {
    fail('Production apply requires --allow-production after backup and staging rehearsal');
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`[Phase 2] mode=${apply ? 'APPLY' : 'DRY RUN'} campaign=${campaignId}`);
  // Intentionally include every historical won spin because Spin has no campaignId.
  const wins = await Spin.find({ status: 'won' })
    .select('_id userId wheelItemId spunAt createdAt')
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const awards = await PrizeAward.find({})
    .select('userId campaignId spinId wheelItemId')
    .lean();

  const byUser = new Map();
  const bySpin = new Map();
  for (const win of wins) {
    if (!win.userId || !win.wheelItemId) fail(`Winning Spin ${win._id} missing userId/wheelItemId. Resolve manually.`);
    const key = str(win.userId);
    if (byUser.has(key)) fail(`Multiple historic wins for userId ${key}: ${byUser.get(key)} and ${win._id}. Manual reconciliation required.`);
    byUser.set(key, str(win._id));
    bySpin.set(str(win._id), win);
  }
  // Compare the entire existing ledger, including awards for OTHER campaigns, to catch spin collisions.
  const awardForSpin = new Map();
  const awardForUserInCampaign = new Map();
  for (const award of awards) {
    const spinKey = str(award.spinId);
    if (awardForSpin.has(spinKey)) fail(`Duplicate ledger spinId ${spinKey}`);
    awardForSpin.set(spinKey, award);
    if (award.campaignId === campaignId) {
      const userKey = str(award.userId);
      if (awardForUserInCampaign.has(userKey)) fail(`Duplicate ledger award for user ${userKey}`);
      awardForUserInCampaign.set(userKey, award);
      if (!bySpin.has(spinKey)) fail(`Existing campaign award ${award._id} has no matching historic winning Spin; reconcile before migration.`);
    }
  }

  const toCreate = [];
  for (const win of wins) {
    const existingSpin = awardForSpin.get(str(win._id));
    const existingUser = awardForUserInCampaign.get(str(win.userId));
    if (existingSpin || existingUser) {
      if (!existingSpin || !existingUser || str(existingSpin._id) !== str(existingUser._id) || !awardMatches(existingSpin, win)) {
        fail(`Ledger conflict for winning Spin ${win._id}; no writes performed.`);
      }
      continue;
    }
    toCreate.push({
      userId: win.userId,
      campaignId,
      spinId: win._id,
      wheelItemId: win.wheelItemId,
      awardedAt: win.spunAt || win.createdAt || new Date(),
    });
  }

  console.log(JSON.stringify({ historicWins: wins.length, existingLedgerRows: awards.length, alreadyMigrated: wins.length - toCreate.length, missingAwards: toCreate.length }, null, 2));
  if (!apply) {
    console.log('DRY RUN ONLY. No writes made. Take a backup, reconcile campaign membership, and rehearse on staging before --apply.');
    return;
  }

  // Production autoIndex is often off. Explicitly create unique indexes before writes.
  await PrizeAward.createIndexes();
  for (const doc of toCreate) {
    // $setOnInsert ensures reruns never replace existing prize ownership.
    // A newly occurring win/ledger conflict is rejected by unique indexes and aborts.
    const result = await PrizeAward.updateOne(
      { campaignId, userId: doc.userId },
      { $setOnInsert: doc },
      { upsert: true, runValidators: true }
    );
    if (result.upsertedCount !== 1) {
      const existing = await PrizeAward.findOne({ campaignId, userId: doc.userId }).lean();
      if (!existing || !awardMatches(existing, { _id: doc.spinId, userId: doc.userId, wheelItemId: doc.wheelItemId })) {
        fail(`Concurrent award conflict for user ${doc.userId}`);
      }
    }
  }

  const resultingAwards = await PrizeAward.find({ campaignId }).select('userId spinId wheelItemId campaignId').lean();
  if (resultingAwards.length !== wins.length) {
    fail(`Post-check failed: awards=${resultingAwards.length}, historicWins=${wins.length}`);
  }
  const verifying = new Map(resultingAwards.map(a => [str(a.spinId), a]));
  for (const win of wins) {
    const row = verifying.get(str(win._id));
    if (!row || !awardMatches(row, win)) fail(`Post-check mismatch for ${win._id}`);
  }
  console.log(`PASS: ${resultingAwards.length}/${wins.length} historical wins represented, original Spins untouched.`);
}

main().catch(err => {
  console.error('[Phase 2] STOP:', err.message);
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect().catch(() => {}); });
