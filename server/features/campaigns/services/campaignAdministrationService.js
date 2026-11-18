'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Campaign = require('../models/CampaignDefinition');
const WheelItem = require('../../prizes/models/WheelItem');
const Audit = require('../../administration/models/AdminAuditLog');
const { claimAdminReviewFence } = require('../../prizes/services/prizeReviewService');
const { validateDefinition } = require('./campaignPolicy');
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });
const fields = ['campaignId','name','enabled','gameIds','startsAt','endsAt','eligibility','participation','prizeItemIds'];
function publicDefinition(row) {
  if (typeof row.toObject === 'function') row = row.toObject();
  const definition = Object.fromEntries(fields.map(k => [k, k === 'prizeItemIds' ? row[k].map(String) : row[k]]));
  return { ...definition, revision: row.revision, participationActive: false };
}
async function saveCampaign({ adminId, adminTokenVersion, definition, expectedRevision, requestId, creating = false }) {
  if (!mongoose.isValidObjectId(adminId) || !Number.isSafeInteger(adminTokenVersion) || adminTokenVersion < 0) throw fail('ADMIN_SESSION_INVALID',403);
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(requestId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER || (creating && expectedRevision !== 0) || (!creating && expectedRevision === 0)) throw fail('INVALID_CAMPAIGN_REQUEST',400);
  const clean = validateDefinition(definition);
  const canonical = v => v && typeof v === 'object' ? (Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}') : JSON.stringify(v);
  const fingerprint = crypto.createHash('sha256').update(canonical({ definition: clean, expectedRevision, creating })).digest('hex');
  try {
    return await mongoose.connection.transaction(async session => {
      await claimAdminReviewFence({ adminId, adminTokenVersion, session });
      const previous = await Campaign.findOne({ campaignId: clean.campaignId }).select('+lastRequestId +lastFingerprint').session(session).lean();
      if (previous?.lastRequestId === requestId) {
        if (previous.lastFingerprint !== fingerprint) throw fail('CAMPAIGN_REQUEST_CONFLICT');
        return { campaign: publicDefinition(previous), repeated: true };
      }
      if (creating && previous) throw fail('CAMPAIGN_EXISTS');
      if (!creating && !previous) throw fail('CAMPAIGN_NOT_FOUND',404);
      if (!creating && previous.revision !== expectedRevision) throw fail('CAMPAIGN_REVISION_CONFLICT');
      if (clean.prizeItemIds.length) {
        const count = await WheelItem.countDocuments({ _id: { $in: clean.prizeItemIds }, isActive: { $ne: false } }).session(session);
        if (count !== clean.prizeItemIds.length) throw fail('INVALID_PRIZE_ASSOCIATION',400);
      }
      const data = { ...clean, revision: expectedRevision + 1, lastRequestId: requestId, lastFingerprint: fingerprint };
      const { campaignId: fixedId, ...changes } = data;
      const saved = creating ? (await Campaign.create([data], { session }))[0] : await Campaign.findOneAndUpdate({ _id: previous._id, revision: expectedRevision }, { $set: changes }, { session, new: true, runValidators: true });
      if (!saved) throw fail('CAMPAIGN_REVISION_CONFLICT');
      await Audit.create([{ adminId, action: creating ? 'CAMPAIGN_CREATED' : 'CAMPAIGN_UPDATED', targetType: 'CampaignDefinition', targetId: saved._id,
        details: { campaignId: clean.campaignId, previousRevision: expectedRevision, revision: data.revision, requestId, before: previous ? publicDefinition(previous) : null, after: publicDefinition(saved), participationActive: false } }], { session });
      return { campaign: publicDefinition(saved), repeated: false };
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } catch (error) {
    if (error.code === 11000 || error.code === 112 || error.hasErrorLabel?.('TransientTransactionError')) throw fail('CAMPAIGN_REVISION_CONFLICT');
    throw error;
  }
}
module.exports = { saveCampaign, publicDefinition };
