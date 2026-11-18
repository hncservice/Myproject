# HNC project status

Audit date: 28 October 2026 (Asia/Qatar). This is a development assessment, not production-launch approval. No Git operations, database connections, backend server startup, delivery, or deployment actions are part of this audit.

## Evidence levels

- **Verified offline**: assertions/build actually executed with synthetic data and permitted isolation.
- **Implemented, integration unverified**: source contains the workflow, but persistence, HTTP, concurrency or external services have not been exercised.
- **Partial / missing**: a required interface, workflow or test is absent or a concrete mismatch exists.
- **Intentionally disabled**: a safety gate, not an accidentally missing feature.

The Step 15R.23P checkpoint was compared with current files before development: all 237 checkpoint source/configuration files were unchanged. The initial scan inventoried 236 client/server files (the checkpoint also contains root .gitignore), including 210 JavaScript/JSX modules and 70 backend scripts. `MODULE_INVENTORY.json` is the current complete per-file import/export/route/environment-name/schema/index inventory; regenerate it after changes.

## Feature completion matrix

| Domain | Implemented evidence | Status / missing verification |
|---|---|---|
| Active preview | `main.jsx → App → FraudDashboardPreview → FraudMonitoringDashboard`; four original mocks, renderer, data modes, lifecycle hook | Verified offline. Default stays mock. No authentication storage in preview graph. |
| Validated fraud data | Validator → provider → presentation adapter → filters/view model → controller → hook → renderer | Verified offline; explicit synthetic opt-in only; no live report route/transport. |
| Customer registration/login | Joi schemas, bcrypt password hashing, purpose-specific hashed OTP, pending registration, atomic OTP consumption, user JWT after verification | Implemented; real email/DB workflow unverified. Customer password login correctly leads to OTP; lack of direct context login on that page is intentional. |
| OTP expiry/throttling | Ten-minute purpose-bound challenge; one-minute cooldown, five sends/window and five reserved attempts/challenge; existing IP limiters | Verified offline with actual Joi/JWT and synthetic models/mail/password hashes. Real DB/distributed/provider behavior unverified. |
| Customer identity/profile | Unique email/phone declarations; administrator CRUD, context profile | Partial. No customer self-service profile route. Raw phone variants can represent the same number; do not change existing uniqueness without migration review. One-person identity cannot be inferred from email/phone uniqueness. |
| User session revocation | HS256 JWT; verified/active account and version lookup; bearer version-CAS logout for all roles | Implemented/verified offline; legacy version zero preserved. Persisted revocation/rollout require separately authorized verification. |
| Vendor/admin authentication | Typed JWT, active-account checks, tokenVersion, transactional authorization fences | Implemented; isolated composition tests use mocks. Real account revocation transactions unverified. |
| Authenticated application | Separate unmounted AuthenticatedApp; protected game routes; signup/login → OTP → eligibility/selection, remote/local logout | Intentionally inactive. Frontend composition/journey mocked; no live frontend/API/DB end-to-end test. |
| Shared game lifecycle | Configuration, attempts, campaign scoping, tokenized sessions, expiry, history, abandonment, CAS updates | Completion token-name collision repaired with 8 isolated synthetic service cases. DB integration remains unverified. |
| Extensible engine | Sealed registry/versioned configuration, compatibility facade, shared verified-evidence lifecycle and reusable GameSession adapter | Implemented/verified offline. Only two legacy games registered; synthetic example test-only. Future HTTP activation, real persistence/concurrency and historical-version resolution remain unverified. |
| Monkey | Server-authored rounds/taps/events, revision guards, completion and preliminary decision | Implemented; pure integrity/behavior checks verified. Refresh, retries, competing updates and real persistence unverified. |
| Perfect Shot | Position/scoring validator, shot evidence, timeouts, CAS, integrity V2 | Implemented; broader gameplay coverage remains incomplete. Latency simulation is mathematical only; repaired older fraud fixture passes 12 original cases / 25 assertions. |
| Spin wheel | Read-only wheel catalogue and prior-win lookup; legacy mutation routes reject | Intentionally disabled. Older `spinService.performSpinForUser` still exists with writes/QR/email, but is not imported by the mounted spin controller. Never reconnect it casually. |
| Preliminary prize decisions | Qualification/eligibility assessment, unique session decision, pending/ready states | Implemented; creation/recovery DB races unverified. A decision is not an award. |
| Prize allocation | Transaction design, per-user fence, inventory checks, No Prize branch | Intentionally hard-disabled. Do not execute private transaction loaders or actual allocation. |
| Review/recovery | Administrator fencing/audit transaction; bounded worker claims, lease/hash, retry classification/reconciliation | Implemented, integration unverified. Recovery is explicitly restricted to `hnc_step15q_sandbox` with allocation disabled. |
| Redemption/vendor operations | Vendor-scoped QR scan, conditional redemption transaction, history/dashboard/Excel exports | Implemented, integration unverified. Scan path can mutate redemption and send email; use synthetic mocks only. |
| Administration | Customer/vendor/wheel inventory CRUD, report stats/export, prize review routes | Partial product completion. Frontend prize review/campaign/game configuration/audit browsing interfaces are absent. Customer list is paginated; vendor lists and some reporting remain unbounded/need profiling. |
| Notifications/QR | SMTP email service, QR utility, receipt/prize templates | Import-time SMTP verify removed; two synthetic initialization cases pass. Real delivery remains unauthorized; offline tests still substitute email dependencies. QR utility creates `/redeem/:token` URLs; no corresponding frontend route is declared. |
| Environment/setup | Source-based variable names can be inventoried without secret files | Partial before this effort. Examples/setup guide must use blank placeholders; no environment secrets may be opened or copied. |
| Database integrity | Eleven model files, refs and declared indexes, transactional assumptions | Static-only. Actual collections/indexes/permissions, retention, replica-set transactions and rollback remain unverified. `MonkeySession.js` is an inactive commented model. |
| Performance/security | Rate limits, CORS/Helmet, CAS/idempotency mechanisms, synthetic timing simulation | Partial. No measured application capacity, dependency advisory assessment or authorized HTTP/DB load results. |

## Confirmed risks and incomplete workflows

1. Repaired: `completeSession` had a request parameter shadowing its token helper. The public field remains `sessionToken`; all eight isolated completion cases pass after a two-line local alias fix.
2. Repaired: old Perfect Shot test fixture now supplies events/coordinates, and its synchronous main is correctly caught. All 12 original cases pass; assessor unchanged.
3. Repaired: removed import-time `transporter.verify()` from `config/mailer.js`. Explicit send methods remain real external operations and must still be substituted in offline tests; server bootstrap is not a harmless import.
4. General MongoDB URI fallbacks and alternative sandbox names remain in old scripts. Existing source checks do not establish least-privilege database permissions. Production database `test` is always prohibited.
5. Account/phone normalization, user JWT revocation, logging privacy and endpoint response shaping need focused threat review. Schema changes require migration/rollback review before implementation.
6. `AuthContext` stores tokens in localStorage in the unmounted authenticated tree. This is unchanged; it requires XSS/session-lifetime consideration before production activation.
7. The four unresolved imports in historical `App.backup.jsx` and `client/security-checkpoints/Step15R22O` are not active graph failures. Preserve backups rather than silently rewriting history.
8. Model comments, legacy service names and test filenames are not reliable feature-status evidence. Do not run a blanket backend suite.
9. Repaired: OTP page conditional hooks failed when location state changed. Hooks are now unconditional; the prize-holder redirect uses existing /user/home rather than undeclared /profile, and digit fields have accessible labels. Six mocked UI regressions pass; real authentication is still inactive.
10. Repaired: getGameConfig returned inherited properties and coerced arrays as game identifiers. It now accepts only string own keys; six isolated cases preserve existing configurations and reject malformed identifiers.

## Verified baseline and boundaries

- Frontend before new implementation: 261 passing tests / 29 files; production build passed in Step 15R.23O. Repeat evidence is tracked in TESTING.md.
- Backend historical isolated baseline: 18 checks (allocation safety 6; recovery classification 12).
- Step 15R.23R: five individually isolated scripts exit 0; 45 named assessment cases plus one randomized simulation, 104 actual assertion calls passed. Raw results: `local-checkpoints/Step15R.23R-2026-10-28/execution-results.json`. Do not add named cases, scripts and individual assertion counts into a misleading single total.
- Initial master frontend: 267 passing tests / 30 files; production build passed. Original 261 tests retained, six OTP cases added.
- Master initial batches: 33 new service cases (authorization 9, OTP 8, session completion 8, mailer initialization 2, configuration 6) and 28 isolation probes pass. Repaired Perfect Shot script: 12 original cases / 25 assertions pass. These are offline simulations, not real storage/SMTP checks. See BATCH_LOG.md.
- Phase B static verification at completion: 263 client/server files, 237 JavaScript/JSX/CommonJS modules, 158 backend syntax checks passed, no active unresolved relative imports. Four historical unresolved references remain. Five API mounts/middleware ordering remain unchanged.
- Shared-engine Phase B: 89 added cases (registry 18, lifecycle 38, compatibility 13, assessment dispatch 7, model-store contract 13) plus all 33 prior cases = 122 passed, with 28 probes. Six scripts retain 129 assertions; frontend remains 267/267 across 30 files and build passes with unchanged output hashes.
- Initial deterministic pure-assessor microbenchmark: 10,000 serial iterations, zero mismatches; p50 0.0276 ms, p95 0.0363 ms, p99 0.0621 ms on this Windows/Node machine. This is not end-to-end throughput or simultaneous-user capacity. See PERFORMANCE_TESTING.md.
- No live DB/authentication/email/HTTP API/transaction/concurrency behavior was verified by those results.
- No production database access, prize activation, experimental report endpoint, authenticated entry activation or deployment change is authorized.

## Release position

The dashboard is a working, well-tested offline preview. The full game/prize platform is **not development-complete or production-ready**. Missing product interfaces, verified defects, offline coverage gaps and separately authorized integration/performance work remain. See IMPLEMENTATION_PLAN.md for ordered batches and explicit blockers.

## Phase C current evidence

301 frontend tests across 35 files (267 retained + 34 new), production build passed with unchanged preview assets. 152 backend cases (122 retained + 30 new); two guard modes each pass 28 probes. Six reviewed assessment scripts retain 129 passing assertions. 165 backend syntax checks; current inventory is 276 client/server files / 250 JS/JSX/CJS modules. All five API mounts and old authentication endpoint order are preserved; only resend/logout auth handlers are added, with reviewed customer game-route guards. No gameplay or experimental route added.

Customer registration recovery, OTP limits/races, actual JWT cryptographic rejection, role revocation, eligibility/legacy prize lock and session resume are verified with synthetic dependencies. CUSTOMER_AUTHENTICATION.md and AUTH_SCHEMA_ROLLOUT.md distinguish those results from unverified DB/SMTP/native-bcrypt/live HTTP behavior. No backfill or production activation occurred.

## Latest baseline — Phase D
331/331 frontend tests across 38 files; build passed with unchanged mock-preview assets. 204/204 isolated backend cases (52 new), 129 assessment assertions, 168 syntax checks. Vendor access/revocation, admin fencing/audits, QR validation, bounded private reports, safe exports, supported customer edits and inactive admin operations/review views delivered offline. VENDOR_ADMIN_COMPLETION.md is the final matrix; BATCH_LOG.md lists files/evidence. Campaign editing, independent V1 review evidence, controlled customer deletion, device QA and separately authorized DB/HTTP/concurrency/load integration remain open. Not production-ready.

## Latest — Phase E safe functional completion
Current verified baseline: 354/354 frontend tests across 41 files (331 retained +23), production build passed with unchanged mock-preview assets; 256/256 isolated backend cases (204 retained +52); 129 assessment assertions; 174/174 syntax checks. Versioned campaign definition create/edit/desired availability/game assignment/dates/eligibility/inventory associations/activity/audit now have an admin-only source workflow. Hardcoded campaign participation remains disabled and definitions are not wired into legacy gameplay. Existing review detail now returns independent V2/V1 assessments; no new review-data endpoint. Targeted modal/OTP accessibility feedback improved. CAMPAIGN_MANAGEMENT.md describes contracts, limits and rollout; BATCH_LOG.md records files/evidence. Not production-ready; real DB/HTTP/concurrency/load, device/accessibility and future atomic campaign admission remain separately authorized work.

## Latest — Phase F reverified 29 October 2026

354 frontend tests /41 files,294 isolated backend cases (256+38 readiness),129 assessment assertions,177 backend syntax checks and production build pass. Prior Phase F source fixes remain intact: email HTML escaping, safe returned redemption fence, overflow-safe logout version, redacted errors/logging and pure fail-closed future integration target policy. Source/model/runtime behavior was not rewritten on resume;286 prior backend hash entries matched. Missing handover summaries and final manifests were completed.

INTEGRATION_READINESS.md provides the current module matrix and Phase G approval plan. DATABASE_SCHEMA_AUDIT.md, HTTP_TEST_MATRIX.md, CONCURRENCY_RISK_REGISTER.md and PERFORMANCE_TESTING.md document unexecuted schema/HTTP/race/load acceptance work. Phase F offline verification is complete; Phase G execution BLOCKED pending explicit isolated target/harness/stage approval. Active four-session mock preview, allocation/campaign-off gates, unregistered experimental report and five API groups preserved. No DB/server/live HTTP/email/secret/deployment/prize action; not production-ready.

## Final Phase F handover baseline
354 frontend tests /41 files,299 isolated backend cases (five new connection-order/redaction cases),129 assessment assertions,177 syntax files and build pass.16 prior artifacts match/parse/no conflict markers; application implementation unchanged. PHASE_F_FILE_REVIEW.md lists the review, PHASE_F_ISSUE_REGISTER.md classifies unresolved severity/files/fixes/tests/authorization, and PHASE_G_SANDBOX_PLAN.md is a separate unexecuted plan. Pre-auth DB connection ordering remains an explicit high-priority risk; runtime mitigation deferred pending full compatibility proof. Offline handover complete; external Phase G and production acceptance remain blocked. All mock/participation/allocation/experimental/API safeguards preserved.

## Latest — Phase G1 offline harness preparation

29 October 2026:354/354 frontend tests across41 files;350/350 isolated backend cases (299 retained+51 harness);129 assessment assertions;180/180 backend syntax; production build passed with identical preview assets. New server/tests/integration preparation modules require the existing restrictive guard and deny all live execution capabilities. Synthetic fixture recipes, non-executable receipt cleanup plans, cooperative deadlines/cancellation/barriers, bounded waves and sanitized evidence are available. Production application sources are unchanged. PHASE_G1_HARNESS_READINESS.md supplies scope, evidence and remaining adapter/DB/HTTP/atomicity approval gaps. All live integration remains blocked; no production-readiness claim.

## Latest — Phase G2A offline adapters

29 October 2026:427/427 backend cases (350+77 new adapter checks),354/354 frontend across41 files,129 assessment assertions,185/185 backend syntax and unchanged preview production build passed. Guarded disabled-by-default mock database/HTTP adapters and source-pinned bootstrap composition are prepared; no application/runtime/model/schema/package/auth/route change. Active four-session mock, allocation/campaign-off and unregistered experiment preserved. PHASE_G2A_ADAPTER_READINESS.md lists exact evidence and gaps; PHASE_G2B_SANDBOX_PROPOSAL.md is not authorization to connect or listen. Real topology/role/DB/HTTP/atomicity/load acceptance remains BLOCKED.

## Latest — Phase G2B final offline preflight

29 October 2026: unchanged427/427 backend,354/354 frontend in41 files,129 assessment assertions,185/185 syntax and passing identical production assets. Documentation/evidence only. Intended sandbox tuple and credentials/network/ownership controls remain unverified; no runnable live harness or live authorization exists. PHASE_G2B_FINAL_PREFLIGHT.md and PHASE_G2B_EXECUTION_PLAN.json record ten bounded stages, each BLOCKED pending code/infrastructure/scope approval. Active four-session mock/five mounts, allocation and customer participation off, experimental report unregistered preserved. No integration execution or production readiness.
