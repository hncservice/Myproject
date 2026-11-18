# Campaign administration and independent review — Phase E

## Scope and status

Implemented administrative campaign definitions and diagnostics, not live customer campaign admission. New feature folder server/features/campaigns contains a strict model, shared registry-backed validation/eligibility policy, transaction service and admin controller. Client campaign management is only in the unmounted authenticated application. The original mock dashboard and legacy source-managed campaign behavior remain unchanged.

CAMPAIGN_PARTICIPATION_ENABLED=false is hardcoded in campaignPolicy.js. Every public definition/activity response declares participationActive:false. Definition enabled means desired availability only. No current game start/status/shared-engine module imports campaign definitions. The existing campaignId from CAMPAIGN_POLICY is reserved against editing through this workflow. ALLOCATION_ENABLED=false is unchanged. Inventory associations neither allocate nor reserve inventory. No new customer game or experimental fraud-report route exists.

## Administrative contracts

All paths below follow the existing global authAdmin middleware under /api/admin. No new API mount or middleware ordering change.

| Method/path | Purpose |
|---|---|
| GET /campaigns | Bounded list and static registry discovery; page 1..100000, limit 1..50 (20 default), q <=100 escaped as literal, enabled all/true/false |
| POST /campaigns | Create definition with expectedRevision:0 and requestId |
| PUT /campaigns/:campaignId | Full validated replacement at expectedRevision >=1; URL/body ID must agree |
| GET /campaigns/:campaignId/activity | Campaign-scoped session/completion counts and latest 20 audit metadata records; no arbitrary query fields |

Mutation envelope: {definition,expectedRevision,requestId}. requestId is 16..64 ASCII alphanumeric/underscore/hyphen characters; UI uses secure UUIDs and retains a key for unchanged retries. Unknown envelope/definition/nested keys are rejected; getters/prototype keys/non-JSON/oversized input are rejected before policy validation. Server actor identity/version comes from middleware, never from the body.

Definition fields:

| Field | Rule |
|---|---|
| campaignId | 3..64 lower-case slug characters, begins with letter, immutable; current legacy ID reserved |
| name | 2..100 characters, trimmed input required |
| enabled | Strict boolean, default UI false; cannot open participation |
| gameIds | Unique nonempty supported registry IDs only, max 10; production registry currently Monkey and Perfect Shot only; no frontend-only/synthetic game registration |
| startsAt, endsAt | Real canonical UTC timestamps YYYY-MM-DDTHH:mm:ss[.SSS]Z, start < end; stored normalized ISO; start inclusive/end exclusive |
| eligibility | verifiedEmailRequired:true fixed; minAccountAgeHours integer 0..8760 |
| participation | maxSessionsPerUser integer 1..6 and <=sum assigned games' existing maxAttempts; maxConcurrentSessions:1 fixed; allowPriorWinners:false fixed |
| prizeItemIds | Unique lower-case ObjectId strings, max 50; each must identify existing active inventory in the transaction snapshot; empty allowed |

No scores, validator handlers, JWTs, prize switches, per-game attempt overrides or allocation capabilities are accepted. Static registry discovery omits server functions. Future games still require a code-reviewed registry entry and server validator; a campaign cannot register them.

## Mutation integrity and audit

The existing active/role/tokenVersion administrator write fence is reused inside the same transaction as definition creation/revision CAS and AdminAuditLog creation. Campaign ID uniqueness is declared on the new model. Update excludes the immutable campaignId path and conditionally matches original _id/revision. Invalid revision, missing definition, duplicate ID, unsupported assignment and unavailable inventory fail closed. Expected revision is a safe bounded integer.

The latest request ID and canonical payload fingerprint are stored privately. Immediate identical create/edit retries return the committed definition with repeated:true, without another domain audit record. Reusing the latest key with a different body conflicts. An old replay after another edit cannot overwrite because its original revision is stale (old create conflicts on existing ID). This is latest-write retry deduplication, not an unlimited historical idempotency receipt store; extended retry retention needs a separate design.

Audit records include administrator, action, target ID, request ID, before/after configuration snapshots and previous/new revision. Existing immutable audit model is reused; no history mutation/deletion endpoint is introduced. Activity returns whitelisted metadata, not raw Mixed snapshots or internal fingerprints. Models are only defined in source; no collection/index/backfill was created during this work. Mock transaction rollback tests are not evidence of real MongoDB atomicity.

## Eligibility diagnostic versus admission

evaluateDefinitionEligibility validates definitions and trusted server account/count facts. It checks availability, UTC window, assigned game, active/verified account, minimum account age, prior prize, total sessions and active sessions. Malformed/noninteger/negative/future account facts reject. It may return eligibleByDefinition:true as a diagnostic.

campaignAdmission additionally enforces the hardcoded release gate and currently always returns allowed:false. There is no HTTP diagnostic accepting browser facts, no new customer route, and no legacy lifecycle replacement. A separately reviewed integration must obtain trusted account/prize/session facts, atomically reserve cross-game participation, preserve original per-game attempt checks/session ownership/server verification, pin registry versions, and recheck availability when required. Browser counters/scores must never be used as admission evidence.

## Independent fraud-review evidence

No new review-data endpoint was added. The existing authAdmin-protected GET /prize-reviews/:id keeps all original fields and adds assessments. The originating game lookup remains scoped by session/user/campaign/game IDs. Relevant identifiers are selected for registered assessment normalization; private credentials/contact/raw gameState/events are not returned.

prizeReviewEvidenceService calls the existing registeredGameAssessments functions independently, validates versions/advisory boundary, bounds evidence before computation and returns immutable results: Integrity V2, Behavioral V1 with enforcementAllowed:false, source:server-recomputed and behaviorAffectsPrizeDecision:false. Missing/invalid/oversized/incompatible evidence returns availability:unavailable with null findings and generic reason. Neither assessor nor this read adapter writes a decision.

The UI shows original decision findings/version, separately labelled current server recomputation/version, behavioral advisory signals/version and whitelisted gameplay summary. Values remain ordinary React text. Missing assessments are explicit, not inferred. Existing manual approve/reject and transactional immutable decision audit remain the only review actions; behavioral findings never automatically approve/reject/allocate. Recomputed evidence is not a historical evidence snapshot or proof of fraud. Historical registry-version resolution and binding exact evidence versions to reviewer audit are future integration considerations.

## Usability changes and limits

Campaign form is structured, labelled, wrapping and keyboard-accessible; UTC timestamps are explicit. Tables scroll horizontally with column scopes/caption; list/activity loading/error/empty states are provided and late responses are discarded. Retry preserves input/key; secure-randomness failure is a safe UI error. Customer edit modal has labelled read-only fields/password, dialog semantics, focus/escape/trap/restoration. OTP resend has a cleanup-safe quiet 60-second countdown after successful resend, resets on identity change, and preserves digits after expired-code errors. Initial resend remains server-authoritative since the page has no reliable original send timestamp; countdown is not an enforcement control. Backend limits remain authoritative.

Existing registration/login/vendor/game CSS, game instructions, preview UI and API base/deployment configuration were not redesigned. Actual mobile devices, camera, screen readers, session-expiry navigation across live HTTP, complete game keyboard play and visual QA remain unverified; targeted DOM checks are not broad accessibility certification.

## Verification and rollout requirements

Current: 354 frontend tests across 41 files (331 prior +23 new), build passed; 256 isolated backend cases (204 prior +52 new); 129 assessment assertions; 174 backend syntax checks. Guard probes:28 standard,28 library-enabled,30 assessment. Source inventory:295 files/269 JS-family modules. No active unresolved imports; four historical backup references retained. Active preview graph:12 local files, unchanged build assets, no inspected auth/storage/fixture markers.

From client: npx vitest run src --environment jsdom; npm run build. Focus: npx vitest run src/features/administration/pages/CampaignCompletion.test.jsx src/features/administration/pages/CampaignRoutes.test.jsx src/features/authentication/pages/OtpResendExperience.test.jsx --environment jsdom. From root: node tools/run-offline-unit-tests.cjs and node tools/run-offline-assessments.cjs only. These fixed reviewed runners block networking/DB/email/processes/workers/writes, with actual hash-reviewed Joi/JWT and fake model/workbook/bcrypt ports. No real Mongoose import or connection ran.

Before any runtime rollout, separately authorize an explicit isolated environment and verify schema casting, unique index creation, transaction capability/retry/rollback, immutable audit persistence, authorization at HTTP boundaries, revocation/config edits under concurrency, real inventory association behavior, bounded query plans and load. Campaign participation remains off until a separate integration/activation review; do not simply flip the flag. No production customer/data/service access, operational script, deployment, secret modification or prize operation is authorized by this document. Not production-ready.
