# Backend module guide

Express bootstrap remains server/server.js. Its original five mounts and middleware sequence match the historical checkpoint byte-for-byte. API_REFERENCE.md records declared routes and handlers; DATABASE_SCHEMA.md records source fields/refs/indexes. Neither document is an executed integration test.

| Folder | Responsibility / dependencies | Verification limit |
|---|---|---|
| config | Campaign/game configuration, JWT, DB adapter, mailer | Config lookup hardened; JWT role consumers tested with explicit fakes. No actual DB/JWT-signing/SMTP integration run. Automatic SMTP verify removed. |
| features/authentication | Atomic pending/challenge issuance, persistent OTP policy, reservation/consumption, active/verified/version guards, resend/logout and all role logins | Prior cases plus 30 new cases use actual Joi/JWT with fake models/email/bcrypt. Real persistence/provider and historical identity normalization remain unverified. |
| features/games | Sealed registry; compatibility adapter; verified-evidence lifecycle; reusable GameSession/composition factories; existing game services | Verified offline; only two legacy games registered. Future HTTP activation and real persistence/concurrency remain unverified. |
| features/fraud-monitoring | Integrity V2, separate advisory behavior V1, report shaping and experimental reporting controller | Pure assessments pass isolated tests. Reporting controller exists but is not registered; no dashboard HTTP connection. |
| features/prizes | Inventory/WheelItem, preliminary decisions/review, award/allocation, recovery/claims/reconciliation, redemption | Allocation hardcoded false. Transactional implementations exist but real inventory/redemption/DB behavior is unverified and not exercised. |
| features/vendors | Vendor model, login/scan/dashboard/history/export orchestration | Vendor token fences are covered with fakes; actual QR scanning/redemption/email is not a safe offline unit operation. |
| features/administration | AdminUser/AdminAuditLog, customer/vendor/inventory/report orchestration | Existing role checks/routes preserved; missing product interfaces and integration coverage tracked separately. |
| middleware | Shared errors and request handling | Raw error logging/response shaping require privacy hardening. No blanket rewrite performed. |
| infrastructure / utils | Existing email/receipt/QR and shared utilities | Explicit send methods remain external effects; substitute in offline tests. QR public path has no matching frontend redeem route. |
| scripts | 70 historical tests, simulations and operational tools | Classifications vary. Name does not establish safety. Never run directory-wide discovery; retain historical safety manifest and individual review. |
| tests/unit | New isolated service cases, explicit VM dependency substitutions and guard probes | Fixed allowlist only; actual Mongoose/email/server modules cannot load. |

## Overlap and legacy boundaries

- Generic game session completion is an abandon/finish-without-qualification operation. It must not replace game-specific server validation or trust browser totals.
- Existing services stay behind legacyGameEngine; future games use sharedGameEngine and the reusable GameSession adapter. Registration cannot silently activate the legacy start/abandon flow. See GAME_DEVELOPER_GUIDE.md for required handlers, limits and explicit composition.
- spinService.performSpinForUser contains legacy write/QR/email behavior; mounted legacy mutations remain disabled and do not import it. Do not treat it as a second safe allocation engine.
- Preliminary decision creation, recovery retry and administrative review are distinct operations with different authorization/transaction boundaries. Do not collapse them into award allocation.
- The old MonkeySession model is comment-only historical source; current gameplay uses GameSession. Do not revive it based on its filename.

No backend server or operational script was started. Exact safe repeat commands and fresh evidence locations are in TESTING.md and BATCH_LOG.md.

Registry configuration feeds gameConfig/model enums without changing current values. registeredGameAssessments dispatches Integrity V2/Behavior V1 separately for combined reports and preliminary decisions; recovery discovery derives from registered configuration. gameStartService additionally exports its existing eligibility helper. No schema/index/route/allocation/email/deployment configuration changed.

## Phase D additions
administration/controllers/adminOperationsController.js supplies bounded read-only configuration/session/redemption/audit views after existing global authAdmin. Explicit serializers omit contact/QR/credential/raw Mixed details. Configuration uses static registry discovery; no game/campaign mutation. adminController reuses the existing prizeReviewFence for all transaction mutations, audits vendor/prize creation and adds optional vendor activation/revocation. infrastructure/reporting/reportSafety.js shares formula/control sanitation across existing admin and vendor XLSX exports. Vendor report query/row bounds and buffer-before-header behavior are enforced. Existing prizeRedemptionService is unchanged and tested only with fake models; real invocation is operational and restricted. No backend bootstrap, five mounts, game logic, allocation flag, experimental registration or model changed.

## Phase E modules
features/campaigns/models/CampaignDefinition.js declares strict typed versioned definitions and campaignId uniqueness; no model/index execution or migration occurred. services/campaignPolicy.js reuses static registry and immutable input handling, validates definition/diagnostic facts and hardcodes participation false. services/campaignAdministrationService.js reuses existing admin fence/audit transaction with revision CAS and latest-request fingerprint; inventory associations never allocate. controllers/campaignAdministrationController.js exposes bounded admin list/create/update/activity only. Existing legacy game/config/eligibility code is untouched and does not load campaign definitions.

features/prizes/services/prizeReviewEvidenceService.js is read-only, bounds input and reuses registered independent V2/V1 assessors. Existing prizeReviewController detail adds assessments, retaining original scoped summary and response fields. No new review-data or experimental fraud-report endpoint; manual decision service remains unchanged. CAMPAIGN_MANAGEMENT.md explains contracts, deduplication/evidence limits and separately authorized rollout dependencies.
