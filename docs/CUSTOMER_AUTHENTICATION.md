# Phase C customer/authentication inventory and verification

Status: implemented and tested offline; real API/DB/mail integration and production readiness remain unverified. Active application still renders the four-session mock fraud dashboard. AuthenticatedApp remains unmounted.

## Module inventory

| Module | Responsibility / completion evidence |
|---|---|
| server/features/authentication/controllers/authController.js | Existing registration/password/OTP/vendor/admin contracts; real Joi validation; additive resend; safe error output and bounded auth logging. |
| services/authPolicy.js | Shared ten-minute expiry/window, one-minute cooldown, five sends/window, five attempts/challenge; legacy-version predicate. |
| services/otpChallengeService.js | Atomic pending-registration/challenge update, version/hash/time CAS, persistent send budget, fakeable delivery and recoverable provider failure. |
| services/otpVerificationService.js | Reserve attempt before comparison; hash/purpose/expiry/version/pending-data conditional consumption; one-use ownership confirmation. |
| services/otpService.js | Existing crypto six-digit generation and bcrypt hashing/comparison. Crypto range/padding/rounds tested; actual native bcrypt is mocked, not reverified. |
| services/sessionRevocationService.js / controllers/sessionController.js | Verify bearer JWT; self-account version-CAS logout for all three roles; clear customer challenge; no body-selected target account. |
| models/User.js | Additive metadata defaults only; existing indexes retained. No record migration/backfill/index operation performed. |
| middleware/authMiddleware.js | Actual signed-token verification boundary, customer verified/active/version checks and existing vendor/admin version fences; legacy customer compatibility at version zero. |
| routes/authRoutes.js | Five existing endpoint contracts unchanged; two reviewed additions for resend/logout, existing IP limiters retained. |
| games/services/gameStartService.js / gameStatusService.js | Shared verified/active customer eligibility, PrizeAward plus legacy hasSpun lock; repeated start resumes without another attempt. |
| client authentication pages | Registration, password-to-OTP, real resend UI, accessible error/loading fields, in-flight/stale response protection and game-selection destination. Existing vendor/admin screens preserved/tested. |
| client AuthContext / Layout / authApi | Existing storage keys retained; safe unavailable storage; explicit prior-token remote logout and local clearing; warning if server revocation cannot be confirmed. Logout 401 is handled outside global forced redirect. |
| client AppRoutes | Existing paths/order retained; both game pages now require customer context. Routes remain inactive from the default preview. Client guards are navigation aids, not JWT verification. |
| games/components/GameSelectionPanel / UserHomePage | Fetch eligibility only; offer the two existing games, disable locked/exhausted choices, bounded response validation and retry. Mount/refresh never starts a session. |

Paths under services/models/middleware/routes above are relative to server/features/authentication. Full imports/exports/schema fields are in MODULE_INVENTORY.json and DATABASE_SCHEMA.md. No duplicated OTP issue routine remains in the controller; policy constants are shared.

## Customer journey evidence

1. Registration validates name/email/Qatar phone/password, checks duplicate email/common phone aliases, stages credentials and issues a purpose-bound challenge. New passwords exceeding bcrypt's 72 UTF-8-byte input boundary are rejected; older password login inputs remain compatible.
2. Interrupted registration can resend without committing new credentials prematurely. Cooldown/send counters remain consumed even when delivery fails. No plaintext OTP is persisted.
3. Verification reserves at most five comparisons per challenge. Only the original live purpose/hash/pending data/account version can be consumed. Concurrent attempts produce one successful token; replacement/revocation cannot authorize stale evidence.
4. Actual jsonwebtoken signing/verification with a synthetic key rejects forged signatures, expiry, unsigned tokens and HS384 under the existing HS256-only policy. Role guards deny wrong roles and revoked/disabled accounts. Legacy untyped/unversioned customer JWTs remain valid only against version-zero verified/active accounts.
5. New registration/login UI passes a whitelisted /user/home destination after verification, showing eligibility and game choice. VerifyOtpPage without that optional route state preserves its earlier /monkey-game fallback; all six prior OTP tests remain unchanged.
6. Isolated backend composition runs registration → OTP → actual JWT → shared eligibility → original Monkey start/resume. Frontend composition uses actual provider/router/screens with mocked APIs/storage. These are separate offline integration boundaries, not a live end-to-end test.
7. Logout clears local credentials immediately and requests account-wide version revocation using the captured old token. Failed/expired-token revocation is reported; stale tokens cannot revoke a newer version. Vendor/admin login and redirects remain intact.

## Executed results

- 301 frontend tests / 35 files: original 267 retained, 34 added; production build passed with unchanged active-preview asset hashes.
- 152 isolated backend cases: all 122 prior cases retained, 30 added. Permission/capability probes: 28 in standard mode and 28 with reviewed libraries enabled.
- Six reviewed assessment scripts: 129 assertions passed, all six exit 0; 30 assessment guard probes pass.
- 165 backend JS/CJS syntax checks pass without application execution. Static active preview remains 12 local modules with no auth/API/storage imports and no backend fixture/transport/auth markers in the production output.

Backend evidence: local-checkpoints/master-offline-unit-evidence-2026-10-28T13-56-52-538Z/results.json. Assessment evidence: local-checkpoints/master-offline-assessments-2026-10-28T13-51-20-911Z/results.json. BATCH_LOG.md lists exact files and backup locations.

## Limits and rollout dependencies

AUTH_SCHEMA_ROLLOUT.md records compatibility/rollout/rollback requirements. Actual MongoDB uniqueness, casting, atomic updates, multi-instance concurrency, index installation and persisted revocation are unverified. Models/email/password hashes are synthetic stubs; Joi and jsonwebtoken are actual installed libraries under an exact hash-checked 166-file/metadata dependency graph (no new dependency installed).

Do not mistake the in-process IP limiter for a distributed abuse store. Database-backed per-account limits require coordinated updated instances and real sandbox verification. SMTP ordering/exactly-once delivery/provider failure recovery are unverified. Rate/duplicate responses preserve existing account-discovery tradeoffs; email/phone fields are not a physical identity or phone ownership proof. Historical phone aliases/admin writes need a reviewed conflict/migration policy. Native bcrypt, responsive device/browser behavior, cross-tab cached UI invalidation and full HTTP status/interceptor integration need further verification. Customer profile/password-reset product APIs are not added by this phase.

No Git/GitHub, DB connection, live HTTP/email, backend startup, backfill, production data, deployment/env change, allocation activation, experimental endpoint or active-auth application switch occurred.
