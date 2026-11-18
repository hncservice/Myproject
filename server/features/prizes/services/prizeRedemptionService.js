
'use strict';

const mongoose = require('mongoose');

const Spin = require('../../games/models/Spin');
const WheelItem = require('../models/WheelItem');
const User = require('../../authentication/models/User');
const PrizeAward = require('../models/PrizeAward');
const Vendor = require('../../vendors/models/Vendor');

function redemptionError(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

function isTransactionConflict(error) {
  return (
    error?.code === 112 ||
    error?.codeName === 'WriteConflict' ||
    error?.hasErrorLabel?.('TransientTransactionError')
  );
}

/**
 * The vendor fence:
 *
 * - Requires active vendor account
 * - Requires the exact JWT tokenVersion
 * - Handles legacy missing tokenVersion as version 0
 * - Writes to the Vendor document in the transaction
 *
 * Concurrent vendor revocation modifies the same
 * document and must serialize/conflict with redemption.
 */
async function claimVendorFence({
  vendorId,
  tokenVersion,
  session,
}) {
  const versionCondition =
    tokenVersion === 0
      ? {
          $or: [
            { tokenVersion: 0 },
            { tokenVersion: { $exists: false } },
          ],
        }
      : {
          tokenVersion,
        };

  const vendor = await Vendor.findOneAndUpdate(
    {
      _id: vendorId,
      isActive: { $ne: false },
      ...versionCondition,
    },
    {
      $inc: {
        redemptionFence: 1,
      },
    },
    {
      session,
      new: true,
      runValidators: true,
    }
  );

  if (!vendor) {
    throw redemptionError(
      403,
      'VENDOR_SESSION_INVALID',
      'Vendor account disabled or session revoked'
    );
  }

  if (!Number.isSafeInteger(vendor.redemptionFence) || vendor.redemptionFence < 1) {
    throw redemptionError(409, 'VENDOR_FENCE_INVALID', 'Vendor account requires administrator review');
  }
  return vendor;
}

/**
 * Secure QR redemption.
 *
 * Requires tokenVersion from verified vendor JWT.
 *
 * Vendor authorization, Spin state transition and
 * inventory increment are coordinated in one
 * MongoDB transaction.
 */
async function redeemPrize({
  qrToken,
  vendorId,
  tokenVersion,
}) {
  if (
    typeof qrToken !== 'string' ||
    !/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(qrToken)
  ) {
    throw redemptionError(
      400,
      'INVALID_QR',
      'Invalid QR code'
    );
  }

  if (!mongoose.isValidObjectId(vendorId)) {
    throw redemptionError(
      401,
      'UNAUTHORIZED_VENDOR',
      'Vendor authorization required'
    );
  }

  if (
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 0
  ) {
    throw redemptionError(
      401,
      'INVALID_VENDOR_SESSION',
      'Vendor session invalid'
    );
  }

  // For safety, the transaction must be run only with
  // an established MongoDB connection.
  if (mongoose.connection.readyState !== 1) {
    throw redemptionError(
      503,
      'DATABASE_UNAVAILABLE',
      'Database unavailable'
    );
  }

  // Return directly from transaction callback.
  // Avoid retaining a result from an aborted retry.
  try {
    return await mongoose.connection.transaction(
      async session => {
        const vendor = await claimVendorFence({
          vendorId,
          tokenVersion,
          session,
        });

        const now = new Date();

        const spin = await Spin.findOne({
          qrToken,
        })
          .session(session)
          .lean();

        if (!spin) {
          throw redemptionError(
            404,
            'INVALID_QR',
            'Invalid QR code'
          );
        }

        if (spin.status !== 'won') {
          throw redemptionError(
            403,
            'INVALID_PRIZE',
            'This QR does not represent a winning prize'
          );
        }

        if (spin.redemptionStatus === 'redeemed') {
          throw redemptionError(
            409,
            'ALREADY_REDEEMED',
            'Prize already redeemed'
          );
        }

        if (spin.redemptionStatus !== 'pending') {
          throw redemptionError(
            409,
            'INVALID_REDEMPTION_STATE',
            'Prize cannot be redeemed'
          );
        }

        if (spin.qrExpiry && spin.qrExpiry <= now) {
          throw redemptionError(
            410,
            'QR_EXPIRED',
            'QR code expired'
          );
        }

        if (!spin.userId || !spin.wheelItemId) {
          throw redemptionError(
            409,
            'INCOMPLETE_PRIZE',
            'Prize record is incomplete'
          );
        }

        const user = await User.findById(spin.userId)
          .select('name email')
          .session(session)
          .lean();

        const prize = await WheelItem.findById(
          spin.wheelItemId
        )
          .session(session)
          .lean();

        if (!user || !prize) {
          throw redemptionError(
            409,
            'MISSING_PRIZE_DATA',
            'Customer or prize record is missing'
          );
        }

        const matchingAwards = await PrizeAward.find({
          $or: [
            { spinId: spin._id },
            { redemptionSpinId: spin._id },
          ],
        })
          .limit(2)
          .session(session)
          .lean();

        if (matchingAwards.length > 1) {
          throw redemptionError(
            409,
            'AWARD_MISMATCH',
            'Multiple awards reference this redemption record'
          );
        }

        const award = matchingAwards[0] || null;

        if (award) {
          const legacySource =
            award.spinId != null &&
            award.gameSessionId == null &&
            award.redemptionSpinId == null &&
            String(award.spinId) === String(spin._id);

          const gameSource =
            award.gameSessionId != null &&
            award.spinId == null &&
            award.redemptionSpinId != null &&
            String(award.redemptionSpinId) === String(spin._id);

          if (!legacySource && !gameSource) {
            throw redemptionError(
              409,
              'AWARD_MISMATCH',
              'Invalid award source or redemption link'
            );
          }
        }

        if (
          award &&
          (
            String(award.userId) !== String(spin.userId) ||
            String(award.wheelItemId) !==
              String(spin.wheelItemId)
          )
        ) {
          throw redemptionError(
            409,
            'AWARD_MISMATCH',
            'Prize ownership verification failed'
          );
        }

        const claimed = await Spin.updateOne(
          {
            _id: spin._id,
            status: 'won',
            redemptionStatus: 'pending',
            $or: [
              { qrExpiry: null },
              { qrExpiry: { $gt: now } },
            ],
          },
          {
            $set: {
              redemptionStatus: 'redeemed',
              redeemedByVendorId: vendor._id,
              redeemedAt: now,
            },
          },
          { session }
        );

        if (claimed.modifiedCount !== 1) {
          throw redemptionError(
            409,
            'REDEMPTION_CONFLICT',
            'Prize has already been processed'
          );
        }

        const inventoryUpdate =
          await WheelItem.updateOne(
            {
              _id: prize._id,
              $expr: {
                $gt: [
                  {
                    $ifNull: [
                      '$quantityAllocated',
                      0,
                    ],
                  },
                  {
                    $ifNull: [
                      '$quantityRedeemed',
                      0,
                    ],
                  },
                ],
              },
            },
            {
              $inc: {
                quantityRedeemed: 1,
              },
            },
            { session }
          );

        if (inventoryUpdate.modifiedCount !== 1) {
          throw redemptionError(
            409,
            'INVENTORY_RECONCILIATION_REQUIRED',
            'Prize inventory needs administrator review'
          );
        }

        return {
          spinId: String(spin._id),
          prize: prize.title,
          user: {
            name: user.name,
            email: user.email,
          },
          vendorName: vendor.name,
          redeemedAt: now,
        };
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );
  } catch (error) {
    if (isTransactionConflict(error)) {
      throw redemptionError(
        409,
        'REDEMPTION_CONFLICT',
        'Redemption conflict. Please verify prize status.'
      );
    }

    throw error;
  }
}

module.exports = {
  redeemPrize,
};

