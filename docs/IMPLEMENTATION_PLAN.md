# Implementation plan

The master completion request authorizes ordinary offline source improvements. Preserve current API routes, entry points, feature ownership, security gates and existing assertions. Back up affected files before substantial edits; use small batches and update evidence after each.

## Ordered work

| Phase | Work / smallest useful batch | Acceptance | Boundary |
|---|---|---|---|
| A | Static full module/import/route/model inventory, checkpoint comparison, status and risk matrix | Inventory reproducible; distinguish evidence from presence | No application module initialization or secrets |
| B | Retain existing feature folders; introduce `docs`, `tools`, `server/tests/unit` only when used | No mass migration, routes/exports unchanged | Do not move legacy backups |
| C | Map registration → pending data → email OTP → atomic consumption → JWT and role guards; add dependency-injected/VM unit tests for failure/recovery | Tests cover one-use/expiry/replaced OTP and role revocation without real models or email | User schema/revocation migrations need a reviewed plan; live OTP/DB blocked |
| D | Repair completion-token name collision with synthetic service tests; specify registry/validation interface before expanding game abstractions | No client score accepted; idempotent completion/expiry/token cases preserved | No new live game routes or DB calls |
| E | Repair held Perfect Shot fixture and rejected-promise handling; add valid/invalid/timeout evidence tests; audit frontend reconnect handling | Current validators stay strict; deterministic offline tests pass | Gameplay persistence/concurrency needs separate sandbox authorization |
| F | Review allocation fail-closed boundary, decision/recovery/redemption contracts; expand mocks for inventory/replay/claims | Allocation always rejects before writes; no QR delivery | Actual draws, issuance, redemption writes, migrations and transactions blocked |
| G | Vendor forms, permission/error/receipt tests using mocked APIs only | Synthetic scan/revocation/duplicate cases; no notifications | No real scanning/redemption transaction |
| H | Fill missing admin presentation modules incrementally around existing routes; inventory unsupported campaign/audit APIs before building UI | No invented endpoint; paging/role/empty/error tests | Keep fraud-report endpoint unregistered |
| I | Authentication/game/vendor UI accessibility, loading/error and responsive cases | Existing dashboard default/markup/behavior stays intact | No authenticated app activation |
| J | Source-derived `.env.example` files and ENVIRONMENT_SETUP.md; plan explicit offline startup validation and lazy mailer construction | No copied values or working credentials, safe switches false | Do not populate/read current `.env`; do not initialize SMTP/DB |
| K | Document model refs/indexes, query bounds, expiry/retention and migration/rollback proposal | Schema and actual deployment kept distinct | DB/schema changes need reviewed plan and explicit sandbox execution |
| L | Separate pure units, isolated model/API simulations, sandbox integration and operational scripts; document exact safe commands | Approved tests/build pass; no assertions deleted | No blanket server scripts or real HTTP listener without authorization |
| M | Design fixture-only load simulation and separately proposed capped local HTTP/DB environment | Actual latency/CPU/memory measurements, assumptions, no unsupported capacity claim | Real HTTP/DB load tests require separate authorization |
| N | Threat review and targeted negative tests for roles, JWT, OTP, replay, QR/logging/privacy and dependency review | Verified issues fixed or explicitly tracked | No speculative security-gate weakening or network audit installs |
| O | Architecture/API/game-plugin/setup/testing/recovery/release documentation reconciled against final evidence | Another developer can repeat safe checks and identify blocked work | Development completion is distinct from launch approval |

## Execution rules

1. Read implementations and prove the defect or gap.
2. Use the source checkpoint as history, not as permission to execute its scripts. Create a batch backup outside active source for every modified source/test file.
3. Add meaningful regression coverage. Use synthetic values and fake model adapters; no production customer records.
4. Apply the smallest backward-compatible change. No route rewrites, general URI fallback, private allocation loading or environment activation.
5. Run focused tests, static source checks and frontend regression/build as relevant.
6. Record actual exit codes/counts, limitations and changed files. Keep the prior baseline passing.
7. Continue safe work. Document restricted tasks as blocked while progressing independent offline tasks.

## Integration blockers — not yet authorized

- Any MongoDB connection, including `hnc_step15q_sandbox`, requires explicit permission and a preflight confirming exact database name, non-production restricted credentials, resource limits and synthetic cleanup ownership.
- Production database `test` is never a testing target; a hostname or sandbox-looking path alone is insufficient isolation.
- Do not send OTP/prize/redemption mail, issue or dispatch prizes/QRs, register experimental reporting, mount authenticated routes, deploy, or change hardcoded allocation false.
- Real HTTP/performance runs require an approved local-only environment; no backend server is started by this plan's initial offline batches.

## Current batch ledger

- Audit established: full source inventory and checkpoint comparison; no original source difference at audit start.
- Initial offline repairs passed: completion helper shadowing (8 cases), old Perfect Shot fixture/error handling (12 original cases), mailer import-time verify removal (2 cases).
- Authentication preservation coverage added without changing auth source: 9 role/JWT-context cases and 8 purpose-specific atomic OTP-consumption cases.
- OTP frontend defects repaired with six regressions: unconditional hooks, existing prize-holder destination and accessible digit fields. Auth implementation/storage/API contracts remain unchanged and unmounted.
- Game configuration lookup hardened against inherited keys and non-string coercion; six isolated regressions pass. This is not a completed multi-game registry.
- Current verification: 267 frontend tests / 30 files and build pass; 33 isolated backend service cases and 28 guard probes pass; 140 backend syntax checks pass. See BATCH_LOG.md for evidence paths.
- Initial pure-assessor performance baseline measured under isolation: deterministic 10,000-call microbenchmark, zero mismatches; no HTTP/DB/concurrent-user capacity claim. Broader workload/performance phases remain incomplete.
- Source-derived environment examples/setup and initial developer handover added. All target phases still have open items; a folder or guide is not evidence that a missing product workflow was implemented.

## Shared game engine — Phase B follow-up

Implemented sealed static registry/config versions, compatibility facade, validation/transition contract, shared eligibility/session/expiry/credential/replay/CAS/completion/reporting, reusable GameSession adapter, assessment dispatch and pending recovery integration. Only Monkey/Perfect Shot are production registrations; synthetic example is test-only. Existing scoring/routes/schema/security gates remain intact.

Verification: 89 new isolated cases plus all 33 prior cases = 122 passed, with 28 guard probes; six scripts retain 129 assertions; frontend 267/267 across 30 files/build pass; 158 backend syntax checks. Exact files/evidence are in BATCH_LOG.md.

Next safe work: game UI/reconnect/error characterization and remaining auth/privacy/product workflows with synthetic tests. No future game/HTTP adapter is activated here. Version resolution/migration and worker pending-marker reconciliation need further coverage. Real model casting/index/concurrency, recovery workers and HTTP integration need separately authorized isolated environments.

## Customer/authentication — Phase C

Implemented atomic challenge/pending binding; account cooldown/send/attempt controls; customer verified/active/version guards; self-account remote revocation; resend/logout auth handlers; canonical new phone writes; safe auth errors; protected game entry; registration/password → OTP → eligibility/selection; stale-response/in-flight protection and explicit logout failure handling. AUTH_SCHEMA_ROLLOUT.md documents additive defaults and safe rollout/rollback; no record/index migration ran. Main/App/AuthenticatedApp activation unchanged.

Verified: 301 frontend tests / 35 files and build; 152 isolated backend cases; 28 probes in each of standard and real-library modes; 129 assessment assertions; 165 backend syntax files. Actual installed Joi/JWT are hash-reviewed; email/models/bcrypt are fakes. See CUSTOMER_AUTHENTICATION.md and BATCH_LOG.md.

Remaining: separately approved sandbox casting/atomicity/revocation/index tests; SMTP delivery verification; distributed IP limits, legacy phone/admin normalization policy, cross-tab/browser/device integration, profile/password-reset product work and broader game UI/reconnect tests. Do not treat mocks as production completion.

## Phase D — safe vendor/administration batches
Implemented targeted existing-module repairs, guarded read-only admin report/configuration endpoints and separate unmounted review/operations interfaces. No working game/auth/mock-dashboard implementation was replaced. Current evidence: 331 frontend tests / 38 files/build pass, 204 isolated backend cases, 129 assessment assertions and 168 syntax files. See VENDOR_ADMIN_COMPLETION.md for the matrix and BATCH_LOG.md for batch files. Continue with reviewed campaign configuration persistence/versioning, independently validated behavioral review evidence, mobile/accessibility QA, controlled customer retention/deletion design. Real DB/HTTP/concurrency/load integration requires separate authorization; source presence is not live acceptance.

## Phase E — campaign definitions, review evidence and targeted usability
Delivered in offline batches: strict registry-backed campaign definitions, admin fence/revision CAS/last-write retry deduplication/audit, bounded admin activity/list APIs and unmounted campaign form; independent registered Integrity V2 and Behavioral V1 evidence through existing review detail; modal keyboard/focus/labels and OTP resend countdown. Existing 331 frontend/204 backend cases retained; current 354 frontend/256 backend, 129 assessment assertions, 174 syntax checks/build pass.

Campaign desired availability cannot open participation: CAMPAIGN_PARTICIPATION_ENABLED=false and no existing game lifecycle imports definitions. Future integration must pin registry versions, use trusted account/prize/count facts and atomically reserve cross-game limits without bypassing per-game verification or disabled allocation. Separately approve model/index/transaction/HTTP/concurrency/load checks before runtime activation; no database migration or deployment ran. Evidence snapshot binding/history retention, real mobile/screen-reader/game-keyboard and session-expiry browser journeys remain open. See CAMPAIGN_MANAGEMENT.md for exact contracts and limitations.
