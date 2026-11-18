
'use strict';

const mongoose = require('mongoose');

const AdminUser = require('../../administration/models/AdminUser');
const AdminAuditLog = require('../../administration/models/AdminAuditLog');
const PrizeDecision = require('../models/PrizeDecision');
const GameSession = require('../../games/models/GameSession');

const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');

// =====================================================
// ERROR HELPER
// =====================================================

function fail(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function validTokenVersion(version) {
  return (
    Number.isSafeInteger(version) &&
    version >= 0
  );
}

// =====================================================
// ADMINISTRATOR TRANSACTIONAL WRITE FENCE
// =====================================================

/**
 * Verify the exact administrator JWT version and
 * perform a real write on the administrator document.
 *
 * This protects review authorization against concurrent
 * administrator-account changes that write the same
 * document.
 *
 * Legacy administrator accounts without tokenVersion
 * are treated as version 0.
 *
 * The write occurs inside the review transaction.
 * Failed transactions roll back the fence increment.
 */
async function claimAdminReviewFence({
  adminId,
  adminTokenVersion,
  session,
}) {
  if (!validId(adminId) || !validTokenVersion(adminTokenVersion)) throw fail(403, 'ADMIN_SESSION_INVALID', 'Invalid administrator session');
  const versionCondition =
    adminTokenVersion === 0
      ? {
          $or: [
            { tokenVersion: 0 },
            { tokenVersion: { $exists: false } },
          ],
        }
      : {
          tokenVersion: adminTokenVersion,
        };

  const admin = await AdminUser.findOneAndUpdate(
    {
      _id: adminId,
      isActive: { $ne: false },
      disabledAt: null,
      role: { $in: ['admin', 'superadmin'] },
      ...versionCondition,
    },
    {
      $inc: {
        prizeReviewFence: 1,
      },
    },
    {
      session,
      new: true,
      runValidators: true,
    }
  );

  if (!admin) {
    throw fail(
      403,
      'ADMIN_SESSION_INVALID',
      'Administrator is disabled or session was revoked'
    );
  }

  if (
    !Number.isSafeInteger(admin.prizeReviewFence) ||
    admin.prizeReviewFence < 1
  ) {
    throw fail(
      409,
      'ADMIN_FENCE_INVALID',
      'Administrator review fence is invalid'
    );
  }

  return admin;
}

// =====================================================
// ADMINISTRATOR PRIZE REVIEW
// =====================================================

/**
 * Approve or reject a suspicious game attempt.
 *
 * Authorization requirements:
 *
 * - Caller must provide the authenticated admin ID.
 * - Caller must provide the exact verified JWT version.
 * - Admin account must remain active.
 * - JWT version must still match the database.
 * - Decision must be pending review.
 * - Decision must belong to the current campaign.
 * - Related game session must be completed/qualified.
 *
 * Transaction guarantees:
 *
 * - Administrator write fence
 * - Conditional prize decision update
 * - Administrative audit record
 *
 * All three changes commit or roll back together.
 *
 * IMPORTANT:
 * Approval does NOT allocate a prize.
 * Approval does NOT generate a QR token.
 */
async function reviewPrizeDecision({
  decisionId,
  adminId,
  adminTokenVersion,
  action,
}) {
  // ---------------------------------------------------
  // 1. Validate inputs
  // ---------------------------------------------------

  if (!validId(decisionId) || !validId(adminId)) {
    throw fail(
      400,
      'INVALID_IDENTIFIERS',
      'Invalid prize decision or administrator ID'
    );
  }

  if (!validTokenVersion(adminTokenVersion)) {
    throw fail(
      403,
      'ADMIN_SESSION_INVALID',
      'Invalid administrator session'
    );
  }

  if (!['approve', 'reject'].includes(action)) {
    throw fail(
      400,
      'INVALID_REVIEW_ACTION',
      'Unsupported review action'
    );
  }

  const nextStatus =
    action === 'approve'
      ? 'approved'
      : 'rejected';

  const auditAction =
    action === 'approve'
      ? 'PRIZE_REVIEW_APPROVED'
      : 'PRIZE_REVIEW_REJECTED';

  let result = null;

  // ---------------------------------------------------
  // 2. Begin MongoDB transaction
  // ---------------------------------------------------

  try {
    await mongoose.connection.transaction(
      async (session) => {
        // -----------------------------------------------
        // 2A. Verify administrator and claim write fence
        // -----------------------------------------------

        const admin = await claimAdminReviewFence({
          adminId,
          adminTokenVersion,
          session,
        });

        // -----------------------------------------------
        // 2B. Load pending prize decision
        // -----------------------------------------------

        const decision = await PrizeDecision.findOne({
          _id: decisionId,
          campaignId: CAMPAIGN_POLICY.campaignId,
          status: 'pending_review',
          decision: null,
          prizeAwardId: null,
        })
          .session(session)
          .lean();

        if (!decision) {
          throw fail(
            409,
            'REVIEW_NOT_PENDING',
            'Prize review is not pending'
          );
        }

        // -----------------------------------------------
        // 2C. Verify originating game session
        // -----------------------------------------------

        const game = await GameSession.findOne({
          _id: decision.gameSessionId,
          userId: decision.userId,
          campaignId: decision.campaignId,
          gameId: decision.gameId,
          status: 'completed',
          outcome: 'qualified',
        })
          .session(session)
          .lean();

        if (!game) {
          throw fail(
            409,
            'GAME_NOT_QUALIFIED',
            'Related game session is not qualified'
          );
        }

        // -----------------------------------------------
        // 2D. Conditionally update prize review
        // -----------------------------------------------

        const reviewedAt = new Date();

        const updated = await PrizeDecision.findOneAndUpdate(
          {
            _id: decision._id,
            campaignId: CAMPAIGN_POLICY.campaignId,
            status: 'pending_review',
            decision: null,
            prizeAwardId: null,
          },
          {
            $set: {
              status: nextStatus,
              reviewedByAdminId: admin._id,
              reviewedAt,
            },
          },
          {
            session,
            new: true,
            runValidators: true,
          }
        );

        if (!updated) {
          throw fail(
            409,
            'REVIEW_CONFLICT',
            'Prize review was already processed'
          );
        }

        // -----------------------------------------------
        // 2E. Write administrative audit record
        // -----------------------------------------------

        await AdminAuditLog.create(
          [
            {
              adminId: admin._id,
              action: auditAction,
              targetType: 'PrizeDecision',
              targetId: updated._id,
              details: {
                campaignId: updated.campaignId,
                gameId: updated.gameId,
                gameSessionId: String(
                  updated.gameSessionId
                ),
                previousStatus: 'pending_review',
                newStatus: nextStatus,
                riskReasons: updated.riskReasons,
              },
            },
          ],
          {
            session,
          }
        );

        // -----------------------------------------------
        // 2F. Prepare response
        // -----------------------------------------------

        result = {
          decisionId: String(updated._id),
          status: nextStatus,
          reviewedAt,
          reviewedByAdminId: String(admin._id),

          // No real prize activity in this service.
          prizeAllocated: false,
          drawExecuted: false,
        };
      },
      {
        readPreference: 'primary',
        readConcern: {
          level: 'snapshot',
        },
        writeConcern: {
          w: 'majority',
        },
      }
    );
  } catch (error) {
    // -------------------------------------------------
    // 3. Handle concurrent transaction conflicts
    // -------------------------------------------------

    if (
      error.code === 112 ||
      error.codeName === 'WriteConflict' ||
      (
        typeof error.hasErrorLabel === 'function' &&
        error.hasErrorLabel('TransientTransactionError')
      )
    ) {
      throw fail(
        409,
        'REVIEW_CONFLICT',
        'Prize review or administrator account changed concurrently'
      );
    }

    throw error;
  }

  // ---------------------------------------------------
  // 4. Return committed result
  // ---------------------------------------------------

  return result;
}

module.exports = {
  reviewPrizeDecision,
  claimAdminReviewFence,
};
