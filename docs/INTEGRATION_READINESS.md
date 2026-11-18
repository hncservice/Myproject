# Phase F integration readiness and Phase G approval plan

Reverified **29 October 2026, Asia/Qatar**. This report closes Phase F offline work. Phase G is a review-ready plan, **not authorization to connect, start a server, migrate data or run HTTP/concurrency/load tests**. The platform is not production-ready.

## Resume findings

The earlier Phase F session left completed source repairs, a 38-case readiness suite, schema/HTTP/concurrency audits and a proposed performance design. Missing work was this report, the Phase F batch/security/readiness summaries and refreshed integrity records. The old CHANGE_MANIFEST.json still described Phase E.

All 286 hash entries in the previous backend evidence (2026-10-28T16-53-01-982Z) matched before rerunning. No implementation was repeated, no application/test/tool source was changed during this resume, and no active syntax/import failure was found. Documentation and generated evidence were completed instead. Source hash matching is scoped to recorded entries, not a claim that every workspace artifact was previously tracked.

## Verified evidence

| Check | Result / scope |
|---|---|
| Frontend regression | **354/354 tests across 41 files**, exit0; includes original mock dashboard, modes, lifecycle, preview isolation, auth/vendor/admin/campaign checks |
| Backend isolated suites | **294/294 cases**, exit0; 256 prior +38 Phase F; standard and library-enabled guards each28/28 probes |
| Reviewed assessment scripts | **129 assertions**, all6 exits0; separate30/30 guard probes; randomized latency simulation is not a load benchmark |
| Production frontend build | Passed,51 modules; same index-DaRxUd9c.js and index-DBkz-poX.css assets |
| Backend syntax | **177 JS/CJS files**, node --check only; no application modules loaded by syntax checks |
| Static structure | Five original API mount groups/order,12 reachable local preview files; no active unresolved imports or inspected auth/storage/fixture bundle markers; four historical backup/checkpoint references intentionally retained |
| Safety gates | Allocation hardcoded false, customer campaign participation hardcoded false, experimental fraud report unregistered, authenticated application unmounted; original four mock sessions remain active |

Current backend evidence: local-checkpoints/master-offline-unit-evidence-2026-10-29T05-46-51-975Z/results.json. Current assessment evidence is recorded in BATCH_LOG.md. MODULE_INVENTORY.json, STRUCTURAL_VERIFICATION.json and CHANGE_MANIFEST.json provide source structure/hashes. This evidence establishes offline behavior only; fake model writes/rollback, fake Express bootstrap, fake mailer and pure URI validation are not database/HTTP/SMTP results.

## Module-by-module Phase G matrix

PASS = verified source/offline behavior. WARNING = known limitation or unverified assumption. BLOCKED = cannot execute/claim acceptance without a separately approved environment and run scope. A module can have PASS offline evidence while its integration remains BLOCKED.

| Module | Offline status | Integration status / required next evidence |
|---|---|---|
| Active preview/frontend | **PASS** | **WARNING:** device/screen-reader/complete gameplay keyboard and live session-expiry navigation unverified; preserve mock entry tree |
| Registration/OTP | **PASS** atomic predicate/limits/recovery tests | **BLOCKED:** real casting/unique identity indexes, canonical alias collisions, null/default counters and resend/consume races; mail must remain memory-only |
| JWT/roles/revocation | **PASS** actual JWT rejection and fake-account version checks; overflow now fails before increment | **WARNING/BLOCKED:** stored role/verification/disabledAt consistency and in-flight revocation semantics need explicit policy/fixtures. Middleware accepts legacy missing versions; explicit null is not the same DB filter state. Exhausted-version service409 currently maps to existing generic500 logout response |
| Game registry/sessions/actions | **PASS** registry/CAS/ownership/expiry/assessment contracts | **BLOCKED:** real indexes and gameplay races; model attempt max3 and PrizeDecision GAME_IDS enum constrain future registrations; historical validator resolution remains open |
| Campaign definitions | **PASS** strict policy/revision/retry/audit contracts | **BLOCKED:** real model/index/transaction behavior. Desired availability cannot admit customers; atomic cross-game participation and version-pinned integration are not implemented/authorized |
| Fraud review | **PASS** independent IntegrityV2/BehavioralV1, advisory-only and private scoped detail | **WARNING/BLOCKED:** real evidence/version snapshot binding and manual-review transactions; experimental reporting stays unregistered |
| Preliminary decisions/recovery | **PASS** offline dispatch/idempotency/claim design | **BLOCKED:** legacy completion commits before callback, so decision failure can leave a durable gap; sandbox-only recovery needs real lease/reconciliation/fault tests and no production worker activation |
| Inventory/allocation | **PASS** source gate false and fake capacity/unauthorized-input cases | **BLOCKED:** reconciliation, actual uniqueness/transactions; allocation activation/private transaction execution is excluded from Phase G |
| Vendor/QR redemption | **PASS** own-vendor boundaries, replay/expiry/capacity negatives and safe fence counter | **BLOCKED:** real transaction/revoke/claim races against explicitly seeded synthetic historical prizes only; no real prizes, QR delivery or SMTP |
| Admin writes/audit | **PASS** fenced writes, revision and audit contract cases | **BLOCKED:** actual rollback/retry, append-only DB permissions, audit retention and contention. Model immutability is not database immutability |
| Reports/exports | **PASS** newer bounded projections and formula-safe cells/CSV | **WARNING/BLOCKED:** real ExcelJS download, count/aggregate/deep skip/query-plan/memory costs. Legacy no-query vendor/catalogue lists remain unbounded for compatibility |
| Express/CORS/limits/errors | **PASS** source/fake-port order/options and safe global-error regressions | **WARNING/BLOCKED:** actual dispatcher/parser/proxy/CORS/network tests; DB middleware precedes auth. Shared in-memory IP limits, no-origin CORS, HTTP origin, URL/origin logging and 404 reflection need review |
| Email/logging | **PASS** HTML escaping with fake transport; bounded admin/vendor/global log metadata | **WARNING:** actual SMTP/header behavior not tested/authorized; other DB/startup/legacy logs and public4xx messages still require policy review |
| Sandbox target preflight | **PASS** pure fail-closed URI/flag tests | **BLOCKED:** not installed in startup; cannot prove DNS/socket target, replica-set discovery, DB permissions or authorization. Actual egress/credential controls and reviewed harness are required |
| Performance/capacity | **PASS** design and historical pure-function evidence only | **BLOCKED:** no representative HTTP/DB/high-traffic result. SLOs in PERFORMANCE_TESTING.md are proposed targets, not measured capacity |

## Phase F repairs retained and rechecked

- infrastructure/email/emailService.js escapes dynamic HTML names, titles, descriptions, vendor text and backup QR text; plain OTP and attachment contracts unchanged. Tests use only in-memory sendMail ports.
- prizes/services/prizeRedemptionService.js requires the returned redemptionFence to be a positive safe integer before any prize lookup/claim. Corrupt/overflowed fences fail409 inside the transaction; real rollback still unverified.
- authentication/services/sessionRevocationService.js rejects MAX_SAFE_INTEGER before increment; no schema/backfill needed to run this check. Existing null/invalid data still requires review.
- middleware/errorMiddleware.js and infrastructure/logging/errorMetadata.js suppress stacks/raw error objects and parser-body reflection; admin/vendor catches reuse bounded code metadata. Expected domain4xx shapes are retained; intentional security changes remove debug stacks/internal5xx text and unsafe codes.
- infrastructure/testing/integrationTargetPolicy.js is pure, reads no files/environment, connects nowhere, and rejects missing/unknown/accessor/prototype options, test/other/remote/SRV databases, unsafe URI options, missing replicaSet, remote/credential-bearing HTTP targets, live mail and activation flags. Returns no DB credentials.
- tools/audit-project.cjs corrects stale revocation documentation and distinguishes field-level index flags from explicit schema.index calls. Tests/guards/finalizer include these exact source files without broadening network/write/DB capabilities.

## Schema/index/transaction approval requirements

DATABASE_SCHEMA_AUDIT.md is the model-by-model source review:11 active models plus commented MonkeySession, declared unique/partial indexes, query-index candidates, validator caveats and reversible migration proposal. No model/index/data migration was performed.

Before runtime acceptance, verify canonical identity collisions and explicit-null sparse keys; safe persisted OTP/version/fence counters; orphan/source/award invariants; GameSession attempt/version/enum compatibility; campaign revision types/private fingerprints; inventory total>=allocated>=redeemed; decision/recovery status consistency. Stage new named indexes only after synthetic duplicate analysis. Do not run syncIndexes blindly. Actual transaction support requires a replica set and reviewed snapshot/majority retry behavior.

No TTL should be added to User OTP or session expiry casually: TTL deletes whole documents, destroys evidence and can reset count-based attempt limits. Token-version rollback must never resurrect old tokens; never restore consumed challenges, reset consumed attempts or re-pend redeemed prizes as a rollback shortcut. Controlled synthetic snapshots/CAS receipts and an explicit retention/migration plan are required. Index candidates and rollback details are proposals, not applied changes.

## Review-ready Phase G plan — stages require separate approval

| Stage | Proposed scope | Approval and stop gate |
|---|---|---|
| G0 harness/preflight | Prepare/review an isolated app factory or equivalent dependency composition, memory mail/QR adapters, target assertions before application initialization, explicit synthetic config and permission/egress controls | **No external execution authorized.** Existing server.js loads dotenv and config/db accepts arbitrary MONGO_URI, so do not use node server.js/current .env as a test harness. Review exact new harness files/commands before authorizing later stages |
| G1 schema/index smoke | Dedicated ephemeral local replica set, only hnc_step15q_sandbox; synthetic accounts/records; verify installed indexes, casting/document hooks vs update validators and non-destructive migration dry runs | Explicit approval of target tuple, DB-scoped credentials, seed, index names/options, resource/time caps and snapshot/cleanup policy. Never database test, other DB, public cluster or production data |
| G2 HTTP contracts | Loopback-only listener on a pinned approved port, memory delivery adapters, HTTP_TEST_MATRIX.md rows with healthy-DB/outage cases separated | Separate explicit server/HTTP permission, command/source review, no .env inheritance or fallback, no non-loopback egress. Smoke <=1req/s,<=5 in flight,<=5min/profile |
| G3 concurrency/faults | Barrier bursts2/5/20 for OTP/session/review/campaign/seeded-redemption plus approved recovery leases and commit-ack faults | Per-workflow permission and fixture invariants from CONCURRENCY_RISK_REGISTER.md. No actual prize allocation/QR delivery. Stop on first duplicate/unauthorized mutation or audit/inventory violation; preserve evidence |
| G4 performance | Only after correctness/security gates: approved workload mix/rate/duration/resources, proposed staged10/25/50/100req/s caps and optional separate endurance approval | PERFORMANCE_TESTING.md targets must be accepted before execution. Limits remain enabled; expected429/409 separated. No public/production traffic, no invented capacity, no automatic stress escalation |

Approval must name: allowed stage(s); exact **literal loopback** address/ports and replica-set identity; database hnc_step15q_sandbox; reviewed code/hash/command list; dedicated synthetic account/DB role and secrets supplied through an isolated channel (not existing production .env); synthetic fixture/data retention scope; memory delivery ports; firewall/permission boundaries; rate/concurrency/duration/CPU/RAM budgets; expected outcomes/stop conditions; and cleanup authorization. A hostname or database name alone is insufficient. The pure target validator is an additional preflight, not the enforcement mechanism or permission.

Future harness must verify actual resolved/connected loopback addresses and replica-set discovered members, pin approved targets, deny every other egress/DB, and confirm actual connection.name before writes. Do not merely set NODE_ENV=test: that does not restrict config/db.js and may enable autoIndex. No URI, password, JWT, OTP, QR claim or real customer data goes into logs/evidence. Bootstrap health tests must not accidentally run the lazy /api connector.

Every stage retains ALLOCATION_ENABLED=false, CAMPAIGN_PARTICIPATION_ENABLED=false, no experimental fraud-report mount, mock-only active frontend and unchanged deployment/secrets. Requesting G1/G2 does not authorize allocation, campaign activation, real delivery, deployment, production inspection, arbitrary sandbox scripts or a production release. Newly reviewed harness/run artifacts and applicable authorization are required before any restricted action. **Stop here; Phase G execution remains BLOCKED.**

## Safe repeat commands (offline only)

From project root: node tools/run-offline-unit-tests.cjs; node tools/run-offline-assessments.cjs; node tools/audit-project.cjs; node tools/verify-offline-structure.cjs; node tools/finalize-offline-report.cjs. From client: npx --no-install vitest run src --environment jsdom; npm run build. Fixed backend runners use empty child environments, exact source/library hashes, denied DB/network/process/worker/write capabilities and synthetic ports; never run a blanket server suite or operational script.

No Git/GitHub, MongoDB connection, backend server startup, live HTTP/email, real QR/prize action, campaign activation, environment-secret modification or deployment occurred during this resume or Phase F verification. Source/doc backups are local code recovery, not database backup evidence.

## Final handover supplement — 29 October 2026

The latest16 artifacts were reconciled against the saved ledger/manifest:15 recorded hash matches, valid self-excluded manifest, no missing files/invalid JSON/merge markers. PHASE_F_FILE_REVIEW.md lists all16 and the security-source findings. No production runtime implementation changed; only integrationReadiness.offline.test.cjs gained five cases. Current totals:354 frontend tests /41 files,299 isolated backend cases (294 retained+5),129 assessment assertions,177 syntax files and production build pass, zero final failures.

Development and production fake-environment tests confirm internal5xx/parser/stack/log redaction; intentionally public4xx remains a trust boundary (F12), not a claim that arbitrary error messages are safe. Offline gate tests prove unauthenticated DB acquisition/failure retry/pending single-flight. The exact two-stage mitigation and compatibility limits are in HTTP_TEST_MATRIX.md. No runtime reorder implemented because full Express/driver/auth compatibility cannot be proved by existing fake routers; healthy public auth and existing outage status precedence must be preserved or explicitly reviewed.

PHASE_F_ISSUE_REGISTER.md is the canonical F01–F19 severity/affected-files/correction/tests/sandbox classification. PHASE_G_SANDBOX_PLAN.md is the separate authorization proposal with target/schema/index/OTP/revocation/game/campaign/recovery/redemption/HTTP/proxy/load stages, expected invariants and rollback safeguards. This supplement supersedes only earlier counts/plan references; earlier evidence remains historical. Phase F offline handover PASS; risks WARNING; all external Phase G execution BLOCKED, no production readiness.

## Phase G1 preparation update — 29 October 2026

PASS: a separate guarded offline harness now exists under server/tests/integration, with51 new unit cases and no live connection/listener capability. Current verification:350 isolated backend cases,354 frontend tests/41 files,129 assessment assertions,180 backend syntax checks and production build pass. Existing286 historical backend source-hash entries differ only in the intentionally extended offline guard; production app sources were not changed.

WARNING/BLOCKED: actual DB/Express/HTTP/proxy/schema/index/transaction and F01–F19 acceptance remains unexecuted. Canonical preparation evidence, exact files, strict configuration and required future authorizations are in PHASE_G1_HARNESS_READINESS.md. This development task does not authorize any database or server stage. Active mock preview and all allocation/campaign/experimental/API gates remain unchanged.

## Phase G2A adapter update — 29 October 2026

PASS offline preparation: new disabled-by-default database/HTTP mock adapters and pinned bootstrap source composition.77 new cases preserve all350 existing backend cases:427 total; frontend354/41 files, assessments129, syntax185 and production build passed. No actual DB/listener/framework/driver/HTTP/SMTP/transaction was executed. Production application and G1 harness modules unchanged; only mock-source allowlists/runner and documentation extended.

WARNING/BLOCKED: live runtime/egress, actual connected role/topology, transitive route/model sandbox binding, seed ownership/cleanup, native cancellation/transactions/HTTP/proxy remain unverified. Exact files/negative tests/contracts: PHASE_G2A_ADAPTER_READINESS.md. Separate unexecuted next-stage/authorization/rollback proposal: PHASE_G2B_SANDBOX_PROPOSAL.md. Mock authorization cannot enable live mode; no production readiness or external testing permission.

## Final G2B preflight — 29 October 2026

Offline review/verification PASS with unchanged427 backend cases,354 frontend/41 files,129 assessment assertions,185 syntax and production build. Code-path checks confirm no adapter URI/env fallback, automatic connection, cleanup deletion or live feature switch; guard and source-only bootstrap remain mandatory. No code/tests changed.

Live authorization/execution BLOCKED: absent real runner, unverified dedicated instance/OS egress/grants/topology, real model/router/credential/request bindings and persistence ownership/cleanup receipts. Current mock policies cannot prove production database test inaccessible under future live capabilities. PHASE_G2B_FINAL_PREFLIGHT.md supplies exact target requirements, issue/source locations, ordered budgets/rollback and decisions. PHASE_G2B_EXECUTION_PLAN.json is executionReady:false with ten BLOCKED stages; command strings are future interface proposals for a missing runner, not executable/approved commands. No production-readiness claim.

## G2C-1 Windows setup preparation — 29 October2026

Documentation/inert examples only: docs/WINDOWS_SANDBOX_SETUP.md, server/tests/integration/provisioning/windows-sandbox.example.json and mongod.cfg.example. No executable availability/port/firewall inspection, provisioning, installation, secret/key generation, process launch, connection or shutdown was performed. Existing .env, active source, adapters and blocked G2B execution plan unchanged. Baseline427 backend/354 frontend/129 assessment/185 syntax/build is retained from G2B, not rerun for this step.

Guide distinguishes inspection/provisioning/connected/shutdown/deletion classes and covers network-disabled Windows guest, exact loopback27018/5501, hnc_isolated/hnc_step15q_sandbox, private key/auth bootstrap, per-collection writer/audit/metadata roles, ACL/data/log segregation, connection and resource caps, scoped firewall defense, safe shutdown and no automatic cleanup. New approval gaps: IP-only replica compatibility, explicit operator admin/internal metadata bootstrap, final localhost-exception closure, guest vs host path rebasing, WiredTiger cache/total RAM limits and single-member shutdown behavior. All live/setup execution remains BLOCKED pending exact version/guest/credential/permission/target/resource/command approval; no production configuration changed.
