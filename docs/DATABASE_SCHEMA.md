# Database source review

No database, collections, indexes or records were inspected. These are schema declarations only; actual index installation, uniqueness, cleanup and transaction behavior are unverified. Do not apply schema changes until migration/rollback review.

## server/features/administration/models/AdminAuditLog.js

References: AdminUser.

| Field | Schema declaration | Line |
|---|---|---:|
| adminId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true, immutable: true, }` | 8 |
| action | `{ type: String, required: true, immutable: true, }` | 15 |
| targetType | `{ type: String, required: true, immutable: true, }` | 21 |
| targetId | `{ type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, }` | 27 |
| details | `{ type: mongoose.Schema.Types.Mixed, default: {}, immutable: true, }` | 33 |
| createdAt | `{ type: Date, default: Date.now, immutable: true, }` | 39 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

- Line 52: `adminAuditLogSchema.index({ adminId: 1, createdAt: -1, })`
- Line 57: `adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1, })`
## server/features/administration/models/AdminUser.js

References: None declared (or inactive/comment-only model).

| Field | Schema declaration | Line |
|---|---|---:|
| name | `{ type: String, required: true, trim: true, }` | 8 |
| email | `{ type: String, unique: true, required: true, lowercase: true, trim: true, }` | 14 |
| passwordHash | `{ type: String, required: true, }` | 22 |
| role | `{ type: String, enum: ['admin', 'superadmin'], default: 'admin', }` | 27 |
| isActive | `{ type: Boolean, default: true, }` | 34 |
| tokenVersion | `{ type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger, message: 'Invalid administrator token version', }, }` | 40 |
| disabledAt | `{ type: Date, default: null, }` | 50 |
| prizeReviewFence | `{ type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger, message: 'Invalid prize review fence', }, }` | 56 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

## server/features/authentication/models/User.js

References: None declared (or inactive/comment-only model).

| Field | Schema declaration | Line |
|---|---|---:|
| name | `{ type: String, required: true, trim: true, }` | 8 |
| email | `{ type: String, unique: true, required: true, lowercase: true, trim: true, index: true, }` | 14 |
| phone | `{ type: String, trim: true, unique: true, sparse: true, }` | 23 |
| passwordHash | `{ type: String, required: true, default: null, }` | 30 |
| emailVerified | `{ type: Boolean, default: false, }` | 36 |
| isActive | `{ type: Boolean, default: true }` | 41 |
| tokenVersion | `{ type: Number, default: 0, min: 0 }` | 42 |
| otpRequestedAt | `{ type: Date, default: null }` | 43 |
| otpWindowStartedAt | `{ type: Date, default: null }` | 44 |
| otpSendCount | `{ type: Number, default: 0, min: 0 }` | 45 |
| otpAttempts | `{ type: Number, default: 0, min: 0 }` | 46 |
| otpHash | `{ type: String, default: null, }` | 52 |
| otpExpiresAt | `{ type: Date, default: null, }` | 57 |
| otpPurpose | `{ type: String, enum: ['registration', 'login', null], default: null, }` | 62 |
| pendingRegistration | `{ name: { type: String, trim: true, }, phone: { type: String, trim: true, }, passwordHash: { type: String, }, }` | 70 |
| hasSpun | `{ type: Boolean, default: false, }` | 88 |
| monkeyAttempts | `{ type: Number, default: 0, }` | 97 |
| lastMonkeySessionId | `{ type: String, default: null, }` | 102 |
| monkeyChancesLeft | `{ type: Number, default: 3, }` | 107 |
| monkeyMaxChances | `{ type: Number, default: 3, }` | 112 |
| monkeyLocked | `{ type: Boolean, default: false, }` | 117 |
| monkeyActiveSession | `{ sessionId: { type: String, default: null, }, status: { type: String, enum: ['active', 'completed', 'expired'], default: 'expired', }, startedAt: { type: Date, default: null, }, expiresAt: { type: Date, default: null, }, }` | 122 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

## server/features/campaigns/models/CampaignDefinition.js

References: WheelItem.

| Field | Schema declaration | Line |
|---|---|---:|
| campaignId | `{ type: String, required: true, immutable: true, unique: true }` | 5 |
| name | `{ type: String, required: true, maxlength: 100 }` | 6 |
| enabled | `{ type: Boolean, default: false, required: true }` | 7 |
| gameIds | `{ type: [String], required: true }` | 8 |
| startsAt | `{ type: String, required: true }` | 9 |
| endsAt | `{ type: String, required: true }` | 9 |
| eligibility | `{ type: nested({ verifiedEmailRequired: { type: Boolean, enum: [true], required: true }, minAccountAgeHours: { type: Number, min: 0, max: 8760, required: true } }), required: true }` | 10 |
| participation | `{ type: nested({ maxSessionsPerUser: { type: Number, min: 1, max: 6, required: true }, maxConcurrentSessions: { type: Number, enum: [1], required: true }, allowPriorWinners: { type: Boolean, enum: [false], required: true } }), required: true }` | 11 |
| prizeItemIds | `[{ type: mongoose.Schema.Types.ObjectId, ref: 'WheelItem' }]` | 12 |
| revision | `{ type: Number, min: 1, required: true }` | 13 |
| lastRequestId | `{ type: String, required: true, select: false }` | 14 |
| lastFingerprint | `{ type: String, required: true, select: false }` | 15 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

## server/features/games/models/GameSession.js

References: User.

| Field | Schema declaration | Line |
|---|---|---:|
| userId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true, }` | 12 |
| campaignId | `{ type: String, required: true, immutable: true, trim: true }` | 19 |
| gameId | `{ type: String, required: true, immutable: true, enum: Object.keys(GAMES), }` | 20 |
| attemptNumber | `{ type: Number, required: true, immutable: true, min: 1, max: 3, }` | 26 |
| sessionTokenHash | `{ type: String, required: true, select: false }` | 33 |
| status | `{ type: String, enum: ['active', 'completed', 'expired', 'cancelled'], default: 'active', index: true, }` | 34 |
| outcome | `{ type: String, enum: ['qualified', 'not-qualified', null], default: null, }` | 40 |
| score | `{ type: Number, min: 0, default: 0 }` | 45 |
| startedAt | `{ type: Date, default: Date.now }` | 46 |
| expiresAt | `{ type: Date, required: true }` | 47 |
| completedAt | `{ type: Date, default: null }` | 48 |
| gameState | `{ type: mongoose.Schema.Types.Mixed, default: null }` | 50 |
| events | `{ type: [mongoose.Schema.Types.Mixed], default: [] }` | 52 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

- Line 56: `gameSessionSchema.index( { userId: 1, campaignId: 1, gameId: 1, attemptNumber: 1 }, { unique: true, name: 'unique_attempt_per_game' } )`
- Line 61: `gameSessionSchema.index( { userId: 1, campaignId: 1, gameId: 1 }, { unique: true, name: 'one_active_session_per_game', partialFilterExpression: { status: 'active' }, } )`
## server/features/games/models/MonkeySession.js

References: None declared (or inactive/comment-only model).

## server/features/games/models/Spin.js

References: User, WheelItem, Vendor.

| Field | Schema declaration | Line |
|---|---|---:|
| userId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }` | 6 |
| wheelItemId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'WheelItem' }` | 12 |
| spunAt | `{ type: Date, default: Date.now }` | 17 |
| status | `{ type: String, enum: ['won', 'lost'], required: true, index: true }` | 22 |
| qrToken | `{ type: String, index: true, unique: true, sparse: true // only enforce unique when qrToken exists }` | 29 |
| qrExpiry | `{ type: Date }` | 35 |
| redeemedByVendorId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true }` | 37 |
| redeemedAt | `{ type: Date }` | 42 |
| redemptionStatus | `{ type: String, enum: ['pending', 'redeemed'], default: 'pending', index: true }` | 43 |
| emailSent | `{ type: Boolean, default: false }` | 50 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

## server/features/prizes/models/PrizeAward.js

References: User, GameSession, Spin, WheelItem.

| Field | Schema declaration | Line |
|---|---|---:|
| userId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, }` | 7 |
| campaignId | `{ type: String, required: true, trim: true, immutable: true, }` | 14 |
| gameSessionId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', default: null, immutable: true, }` | 22 |
| spinId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'Spin', default: null, immutable: true, }` | 30 |
| wheelItemId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'WheelItem', required: true, immutable: true, }` | 37 |
| awardedAt | `{ type: Date, default: Date.now, immutable: true, }` | 44 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

- Line 56: `prizeAwardSchema.index( { userId: 1, campaignId: 1 }, { unique: true, name: 'one_prize_per_user_per_campaign', } )`
- Line 65: `prizeAwardSchema.index( { spinId: 1 }, { unique: true, name: 'unique_prize_spin', partialFilterExpression: { spinId: { $type: 'objectId' }, }, } )`
- Line 77: `prizeAwardSchema.index( { gameSessionId: 1 }, { unique: true, name: 'unique_game_session_award', partialFilterExpression: { gameSessionId: { $type: 'objectId' }, }, } )`
## server/features/prizes/models/PrizeDecision.js

References: User, GameSession, AdminUser, PrizeAward.

| Field | Schema declaration | Line |
|---|---|---:|
| userId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true, }` | 22 |
| campaignId | `{ type: String, required: true, trim: true, immutable: true, }` | 30 |
| gameSessionId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, immutable: true, }` | 37 |
| gameId | `{ type: String, enum: VALID_GAMES, required: true, immutable: true, }` | 44 |
| status | `{ type: String, enum: VALID_STATUSES, required: true, default: 'pending_review', index: true, }` | 51 |
| riskReasons | `{ type: [{ type: String, trim: true, maxlength: 100, }], default: [], }` | 59 |
| assessmentVersion | `{ type: Number, required: true, default: 2, min: 1, validate: { validator: Number.isSafeInteger, message: 'Invalid assessment version', }, }` | 68 |
| reviewedByAdminId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null, }` | 81 |
| reviewedAt | `{ type: Date, default: null, }` | 87 |
| decision | `{ type: String, enum: [ 'NO_PRIZE', 'PRIZE_AWARDED', null, ], default: null, }` | 92 |
| prizeAwardId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'PrizeAward', default: null, }` | 102 |
| decidedAt | `{ type: Date, default: null, }` | 108 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

- Line 125: `prizeDecisionSchema.index( { gameSessionId: 1 }, { unique: true, name: 'unique_prize_decision_per_session', } )`
- Line 134: `prizeDecisionSchema.index( { campaignId: 1, status: 1, createdAt: -1, }, { name: 'prize_decision_review_queue', } )`
- Line 146: `prizeDecisionSchema.index( { userId: 1, campaignId: 1, }, { name: 'prize_decision_customer_campaign', } )`
## server/features/prizes/models/PrizeDecisionRecovery.js

References: GameSession, User.

| Field | Schema declaration | Line |
|---|---|---:|
| gameSessionId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, immutable: true, }` | 12 |
| userId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, }` | 19 |
| campaignId | `{ type: String, required: true, trim: true, immutable: true, }` | 26 |
| status | `{ type: String, enum: [ 'pending', 'processing', 'retry_scheduled', 'held', 'completed', ], required: true, default: 'pending', }` | 37 |
| attempts | `{ type: Number, required: true, default: 0, min: 0, max: 5, validate: { validator: Number.isSafeInteger, message: 'Invalid recovery attempt count', }, }` | 54 |
| lastErrorCode | `{ type: String, trim: true, maxlength: 100, default: null, }` | 66 |
| lastAttemptAt | `{ type: Date, default: null, }` | 73 |
| nextRetryAt | `{ type: Date, default: null, }` | 78 |
| leaseUntil | `{ type: Date, default: null, }` | 88 |
| claimTokenHash | `{ type: String, default: null, select: false, }` | 95 |
| completedAt | `{ type: Date, default: null, }` | 105 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

- Line 122: `recoverySchema.index( { gameSessionId: 1, }, { unique: true, name: 'unique_recovery_per_game_session', } )`
- Line 133: `recoverySchema.index( { campaignId: 1, status: 1, nextRetryAt: 1, createdAt: 1, }, { name: 'recovery_due_queue', } )`
- Line 146: `recoverySchema.index( { status: 1, leaseUntil: 1, }, { name: 'recovery_expired_leases', } )`
## server/features/prizes/models/WheelItem.js

References: None declared (or inactive/comment-only model).

| Field | Schema declaration | Line |
|---|---|---:|
| title | `{ type: String, required: true, trim: true, index: true, }` | 7 |
| description | `{ type: String, trim: true, }` | 14 |
| imageUrl | `{ type: String, trim: true, }` | 19 |
| probabilityWeight | `{ type: Number, default: 1, min: 0, }` | 24 |
| quantityTotal | `{ type: Number, default: null, min: 0, }` | 31 |
| quantityAllocated | `{ type: Number, default: 0, min: 0, }` | 38 |
| quantityRedeemed | `{ type: Number, default: 0, min: 0, }` | 45 |
| isActive | `{ type: Boolean, default: true, index: true, }` | 51 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):

## server/features/vendors/models/Vendor.js

References: AdminUser.

| Field | Schema declaration | Line |
|---|---|---:|
| name | `{ type: String, required: true, trim: true, }` | 8 |
| email | `{ type: String, unique: true, required: true, lowercase: true, trim: true, index: true, }` | 14 |
| passwordHash | `{ type: String, required: true, }` | 23 |
| vendorKey | `{ type: String, unique: true, sparse: true, index: true, }` | 28 |
| createdByAdminId | `{ type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', }` | 35 |
| isActive | `{ type: Boolean, default: true, }` | 42 |
| tokenVersion | `{ type: Number, default: 0, min: 0, }` | 48 |
| redemptionFence | `{ type: Number, default: 0, min: 0, }` | 56 |
| disabledAt | `{ type: Date, default: null, }` | 62 |

Explicit schema.index declarations (field-level index/unique flags appear in the field table):


Review priorities: email/phone uniqueness normalization, per-campaign/game attempt uniqueness, partial active-session uniqueness, one award per campaign/session/spin, one decision/recovery per game, redemption compare-and-set, claim leases and audit retention. GameSession expiresAt is a business expiry field, not currently a declared TTL index; retaining evidence and deleting abandoned sessions need a deliberate retention policy. Customer/vendor/admin revocation use version comparisons and conditional updates; explicit null, unsafe counters and legacy defaults require data-rollout review. No installed index or database state is verified.
