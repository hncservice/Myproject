# Phase G2A offline adapter readiness — 29 October 2026

**PASS: offline adapter preparation and regression. WARNING: live dependency composition/role/topology/transaction acceptance remains unverified. BLOCKED: all database connection, real listener/HTTP/SMTP/QR, operational and live integration execution.** No restricted execution occurred.

## Exact files created/modified

Created:

- server/tests/integration/adapterSafety.js — strict plain-data option/authorization/privilege checks, guarded configured time/case/concurrency budgets and bounded disposal.
- server/tests/integration/databaseIntegrationAdapter.js — disabled-by-default mock-port adapter, explicit credentials/target/role/peer checks, owned fixtures, operation/transaction descriptors, sanitized receipts and owned-handle lifecycle; cleanup disabled.
- server/tests/integration/httpIntegrationAdapter.js — disabled-by-default mock listener/request adapter, literal identity/path/body/receipt bounds, no proxy/redirect/external target, timeout/concurrency/late-handle disposal.
- server/tests/integration/expressBootstrapAdapter.js — SHA256-pinned unchanged server.js source composition with exact imports, fake dotenv, synthetic frozen environment, supplied framework/route/connection ports and unconditional app.listen denial.
- server/tests/unit/integrationAdapters.offline.test.cjs —77 new guarded mock-only cases, keeping existing350 intact.
- docs/PHASE_G2A_ADAPTER_READINESS.md — this report.
- docs/PHASE_G2B_SANDBOX_PROPOSAL.md — separate unexecuted next-stage proposal/authorization/stop/rollback gates.

Modified:

- tools/offline-unit-guard.cjs — four additional exact source read names only; native/direct network/process/write/import denials unchanged.
- tools/run-offline-unit-tests.cjs — one fixed adapter suite entry with explicit reviewed sources; empty environment/permission/hash/timeout/evidence handling retained.
- server/tests/integration/README.md — precise adapter APIs, scope, constraints and remaining live-port dependencies.
- docs/PHASE_G_SANDBOX_PLAN.md, docs/INTEGRATION_READINESS.md, docs/PROJECT_STATUS.md, docs/TESTING.md, docs/BATCH_LOG.md — latest evidence/limits/gates; historical reports retained.
- Refreshed generated docs/MODULE_INVENTORY.json, MODULE_INVENTORY.md, API_REFERENCE.md, DATABASE_SCHEMA.md, STRUCTURAL_VERIFICATION.json and CHANGE_MANIFEST.json.

No runtime frontend/backend application, auth/controller/model/schema, routes, package/dependency, environment secret or deployment configuration modified.290 G1 source-hash entries compared: only the intentionally extended offline guard differs in that prior ledger; the old ledger does not include the runner, which was backed up before editing. Pre-edit eight-file backup: local-backups/phase-g2a-adapters-2026-10-29T07-15-51-633Z/manifest.json. Existing fixtures/backups/checkpoints retained.

## Design and safety evidence

| Category | Status / verified scope |
|---|---|
|Import/default behavior|PASS: no port invoked during import/construction. Missing config fails; enabled defaults false. No real framework/driver/application/SMTP/HTTP module imported; bootstrap uses source text, never require(server.js)|
|Authorization|PASS: explicit copied synthetic-offline descriptor bound to runId/database/literal sockets/replica/capability; live mode, absent/mismatched/unknown authorization rejected. Descriptor is mock-only, not human permission|
|Target and environment|PASS: G1 strict canonical sandbox target; test/other DB, remote/DNS/SRV/credential URI/driver overrides/external HTTP rejected. Top-level MONGO_URI/overrides/getters also rejected. Guard/frozen empty environment rechecked at operation time; no env fallback|
|Credential/identity|PASS mock contract: only synthetic run-bound credentials and custom DB-scoped find/insert/update role; no delete/drop/admin privilege. Connected DB/host/port/replica/one peer/role/actions checked before workflow and every subsequent operation; mismatch prevents dispatch and disposes handle. Actual server grants/discovery are not verified|
|Fixture and cleanup|PASS: original G1 synthetic receipts are adapter-owned by object identity; copies/foreign/duplicate lists rejected. Exact tuple/ID non-executable cleanup plan only; no deletion/drop/automatic cleanup port|
|Timeout/lifecycle|PASS: acquisition single-flight, configured deadlines/case/total/in-flight caps; failure aborts/terminates and disposes owned handles, late acquisitions disposed, close idempotent. Abort is cooperative; unknown commit still requires reconciliation. Failed disposal is a sanitized flag, not a claim of successful close|
|HTTP isolation|PASS mock contract: exact configured loopback listener metadata; namespace/method/path whitelist; no headers/Host/proxy/absolute/query/encoded/traversal override. Owned receipts for bodies; bounded immutable UTF-8 JSON; redirects never followed. Actual client/OS egress enforcement remains future work|
|Bootstrap compatibility|PASS source composition: original security/parser/health/DB/five-router/404/error registration order, body1mb, proxy1, lazy DB coalescing; app.listen always denied. Fake Express/route ports were used; actual dispatcher and transitive real routes not loaded|
|Transaction workflows|PASS interfaces for OTP issue/verify, token revoke, start/resume, completion, preliminary decision, recovery, QR fence, campaign and admin writes. Only mock callback descriptors/receipts were exercised; no actual transaction or domain atomicity conclusion|
|Privacy/side effects|PASS: diagnostics contain fixed codes/scenario IDs/status only; no URI/credential/error/body values. No email/QR/allocation/activation interface; both cleanup methods throw. Request/response values remain synthetic in memory and must not be logged by a future live caller|

The77 new cases include rejection of missing config/authorization, wrong DB/host/role/peer/URI/env/options, excessive concurrency, fixture escape/cleanup attempts, malformed payloads/getters/prototype keys/activation flags, source pin/import drift, timeout/late resource/close and source-order tests. Both pre-existing guard modes28/28 and all G1 tests remain passing. Not every case is a negative test: positive wiring, lifecycle and contract checks are included in77.

## Final verification

| Approved offline check | Result |
|---|---|
|node tools/run-offline-unit-tests.cjs|**427/427**,350 retained+77 new, all18 child invocations exit0; two28-probe guard modes additional|
|client: npx --no-install vitest run src --environment jsdom|**354/354**,41 files, exit0|
|node tools/run-offline-assessments.cjs|**129/129** native assertions, six reviewed scripts,30 guard probes, exit0. Randomized latency simulation is not production performance evidence|
|node tools/audit-project.cjs; node tools/verify-offline-structure.cjs|**185/185** backend syntax; no active import/parse/structure errors; four known unreachable backup/checkpoint imports retained|
|client: npm run build|PASS,51 modules; identical index-DaRxUd9c.js/index-DBkz-poX.css preview assets|

No final failures or weakened isolation guard. Backend evidence: local-checkpoints/master-offline-unit-evidence-2026-10-29T07-35-05-188Z/results.json. Assessments: local-checkpoints/master-offline-assessments-2026-10-29T07-23-13-929Z/results.json. Source/static manifests: docs/STRUCTURAL_VERIFICATION.json and docs/CHANGE_MANIFEST.json. No actual DB/listener/HTTP/SMTP/QR/transaction test executed. Original five API mounts/order, twelve-file active four-session mock preview graph, allocation/campaign hardcoded off and experimental endpoint unregistered preserved.

## Remaining authorization requirements and risks

- **High / BLOCKED:** no live runtime/driver/HTTP port exists here; guard denies actual sockets even if enabled and mock-authorized. G2B needs a separately reviewed capability runtime and exact command/source/dependency hashes, not weakening/reusing the offline guard as a live guard.
- **High / WARNING:** mock describe/role claims do not prove actual connected DB/discovered peers/least privilege. Live adapter must attest against actual driver/topology/grants, pin egress before module initialization and close on mismatch. Dedicated synthetic credentials supplied privately; never existing .env or production secrets.
- **High / WARNING:** real routes/models still need explicit sandbox connection binding, memory delivery substitution and full transitive dependency review. Source composition proves registration order only. F02 pre-auth DB acquisition remains unchanged; a blanket auth reorder remains unapproved.
- **High / WARNING:** no actual seed/insert/transaction/index/migration/unknown-commit/rollback evidence. G1 dates/hash placeholders and generic operation descriptors need reviewed real-schema seeders and acknowledged ownership ledger; QR/recovery/prize fixtures must never come from allocation or real data. Future cleanup needs separate exact ID/revision permission; no automatic reset.
- **Medium / WARNING:** prepared HTTP contract intentionally excludes query/header/auth-token/malformed-body/large-parser/proxy cases; full H01–H28 needs reviewed extensions. Supplied text/port callbacks remain trusted reviewed test code. Evidence must never include raw JWT/OTP/QR/password/response bodies. VM/source hash checks are not a security sandbox.
- **High / BLOCKED:** actual concurrency, revocation/OTP CAS, transaction/driver cancellation, native bcrypt, rate/proxy and resource acceptance remain unverified. Cooperative cancellation cannot forcibly terminate callbacks or undo writes; native cancellation/handle ownership/reconciliation and OS limits must be reviewed and authorized before live use.

PHASE_G2B_SANDBOX_PROPOSAL.md specifies entry gates, target/credential/egress/seed/index/command approvals, staged expected results and rollback/stop procedures. Prior F01–F19 risks remain open. Stop before connection/listener startup. No production readiness claim.
