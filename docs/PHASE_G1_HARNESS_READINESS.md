# Phase G1 offline harness readiness — 29 October 2026

## Outcome

**PASS: offline harness preparation and regression. WARNING: live adapter/topology/atomicity readiness remains unverified. BLOCKED: all MongoDB, listener, live HTTP/SMTP, real QR/prize and integration execution.** This user's G1 task authorizes offline development only; it does not authorize the database-execution G1 stage named in the earlier Phase G plan. No restricted execution occurred.

## Exact files

Created:

1. server/tests/integration/offlineHarness.js — immutable explicit configuration, literal target descriptors, disabled capability surface, synthetic user/campaign/session recipes, exact receipt cleanup plans, barriers, cooperative deadlines/cancellation, configured concurrency waves and sanitized evidence.
2. server/tests/integration/offlineRuntime.js — requires fully installed offline guard, denied native capability scopes and empty frozen environment; no ordinary-node fallback.
3. server/tests/integration/config.example.json — inert credential-free target/budget example, not an environment file and not autoloaded.
4. server/tests/integration/README.md — configuration/API usage, per-test identity isolation, ten concurrency contracts, HTTP composition boundary, termination, rollback and future authorization.
5. server/tests/unit/integrationHarness.offline.test.cjs —51 new focused guarded cases; existing unit location preserves the exact guarded loader boundary.
6. docs/PHASE_G1_HARNESS_READINESS.md — this report.

Modified:

- tools/offline-unit-guard.cjs — two exact additional source reads; immutable completion marker published only after denial hooks. No network/import/write/process denial removed.
- tools/run-offline-unit-tests.cjs — one fixed harness test entry with exact source allowlist, normal empty-env/native-permission execution, source hashes/evidence and hard child timeout.
- docs/PHASE_G_SANDBOX_PLAN.md, docs/INTEGRATION_READINESS.md, docs/PROJECT_STATUS.md, docs/TESTING.md, docs/BATCH_LOG.md — current preparation status, counts and approval gates; historical Phase F findings retained.
- Generated static evidence refreshed: docs/MODULE_INVENTORY.json, docs/MODULE_INVENTORY.md, docs/API_REFERENCE.md, docs/DATABASE_SCHEMA.md, docs/STRUCTURAL_VERIFICATION.json, docs/CHANGE_MANIFEST.json.

No runtime application, frontend, route, model/schema, package/dependency, deployment, secret or authentication implementation changed.286 prior Phase F source-hash entries were compared: only the intended tools/offline-unit-guard.cjs change differs in that old ledger. The runner was backed up separately before editing. Local pre-edit backup: local-backups/phase-g1-harness-2026-10-29T07-00-30-652Z/manifest.json. This backup covers the seven intentionally edited pre-existing tool/handwritten-document files; generated inventories are reproducible evidence.

## Isolation and negative evidence

| Control | Result and scope |
|---|---|
|Missing/ambiguous configuration|PASS: no env lookup/default URI; missing fields, unknown/prototype/accessor keys, malformed objects and unsafe budgets rejected before work|
|DB target|PASS: only canonical credential-free mongodb://127.0.0.1:explicit-port/hnc_step15q_sandbox with exact replicaSet/authSource options; test/other DB, remote/SRV/DNS/credentials/overrides/duplicates rejected|
|HTTP target|PASS: exact literal loopback origin/different nonprivileged port; paths, queries, credentials, remote hosts, wrong ports and protocol targets rejected. No request is issued, even to accepted descriptor|
|Runtime enforcement|PASS: guarded child, frozen empty env, no write/child/worker/addon/WASI permission, CJS/ESM and direct network/process blockers; all existing guard probes retained. Marker alone is not an OS security boundary|
|Live capabilities|PASS: connect/listen/request/email/QR/allocation/campaign activation/cleanup all unconditionally denied; an authorization-looking argument cannot enable them|
|Fixtures/cleanup|PASS: immutable deterministic example.invalid identity and disabled campaign, owned session links, distinct run IDs; cleanup rejects wrong topology/arbitrary/foreign/copied/duplicate/empty receipts and emits only non-executable exact-ID plans|
|Concurrency and cancellation|PASS: bounded configured waves, result order, barrier release/cancel, timeout abort, pre-abort prevents work, failure stops siblings, termination prevents late PASS, total window/clock identity and case-count budgets|
|Evidence privacy|PASS: only known scenario IDs/PASS/FAIL/fixed codes; no callback result/error text/URI/credentials recorded; parent alone writes hash/exit evidence|
|Application compatibility|PASS offline: same five mount groups/order and twelve-file active preview graph, hardcoded allocation/campaign gates, unregistered experimental route, same frontend bundle. Existing domain tests untouched|

## Verification actually executed

| Check | Result |
|---|---|
|Approved backend runner|**350/350** business/harness cases:299 retained+51 new; all17 child invocations exit0. Two guard modes28/28 each are additional, not counted as business cases|
|Frontend `npx --no-install vitest run src --environment jsdom`|**354/354**,41 files, exit0|
|Approved assessment runner|**129/129** native assertions, six reviewed scripts, exit0;30 isolation probes. Randomized latency output is not a production benchmark|
|Static syntax/import/structure|**180/180** backend JS/CJS syntax checks; no active import/parse/structure errors. Four known unreachable backup/checkpoint imports retained|
|Frontend `npm run build`|PASS exit0,51 modules. Same index-DaRxUd9c.js and index-DBkz-poX.css assets; no inspected forbidden bundle markers|

Zero final test/check/build failures; no isolation guard weakened. Exact backend source hashes/assertion output/exits: local-checkpoints/master-offline-unit-evidence-2026-10-29T07-06-20-701Z/results.json. Assessment evidence: local-checkpoints/master-offline-assessments-2026-10-29T07-06-33-516Z/results.json. Static findings: docs/STRUCTURAL_VERIFICATION.json. Hash manifest: docs/CHANGE_MANIFEST.json. These are offline results, not real replica-set/Express HTTP/SMTP/concurrency results.

## Required preparation configuration

Use server/tests/integration/config.example.json as a shape example only: required target keys mongoUri/httpBaseUrl/environment/emailAdapter/allocationEnabled/campaignParticipationEnabled plus unique18-hex runId, connectionTimeoutMs, requestTimeoutMs, durationMs, maxConcurrency and maxCases. Only integration-sandbox/memory/false/false are accepted. Ports27018/5501 and replica set hnc_isolated are examples, **not authorized live targets**. Returned future connection options disable autoCreate/autoIndex and bound pool/timeouts. The preparation format rejects credentials entirely; a future credential provider must be separately reviewed with DB-scoped synthetic credentials, never a production .env or automatic environment discovery.

## Remaining risks and explicit next-stage gates

| Status / severity | Affected area | Required correction/test and authorization |
|---|---|---|
|BLOCKED / High|Real DB/HTTP bootstrap, F01/F02; server.js/config/db.js remain unrestricted production startup|Implement/review a separate live adapter/source loader with substituted dotenv/connection/mail/QR/logs, dependency/source hashes, OS socket egress policy, connected DB/peer checks and handle ownership. Do not use node server.js or only NODE_ENV=test. Explicit target/command/listener/database authorization required before execution|
|WARNING / High|Topology, credential role, discovery and cleanup provenance|URI validation is not egress enforcement. Pin all actual replica peers/address/ports, verify connection.name before writes, provide DB-scoped credentials privately, and retain acknowledged insert ledger/revision receipts. Reject pre-existing ID collisions. CleanupPlan performs no DB action and is not insertion proof. Separate exact cleanup authorization required|
|WARNING / High|Fixtures and concurrency scenarios|Recipes contain unusable placeholder hashes and deterministic ISO dates; live seeders require actual schema casting, synthetic credential hashing/test-relative clock and isolated identity receipts. Ten scenario contracts are prepared, not implemented real-driver race proofs. Staged waves2/5/20 and fault injection need per-workflow approval|
|WARNING / High|Deadlines/rollback|AbortSignal is cooperative and cannot undo an unknown commit or interrupt arbitrary CPU code. Existing guard/child timeout is mandatory offline. Live adapter must close only its approved handles, enforce absolute monotonic wall-clock/resource limits, reconcile outcome before retries, and never resurrect OTP/version/attempt/redemption states|
|BLOCKED / High|Schema/index/transaction/HTTP/proxy acceptance|F03–F19 remain in PHASE_F_ISSUE_REGISTER.md. No index rollout, migration, replica-set atomicity, real Express dispatcher, proxy/rate-limit or load behavior verified. Approve named index/fixture/migration/HTTP matrices and transaction fault cases separately|

Every future approval must identify exact files/hashes/commands, stage and operator, literal DB/HTTP sockets/replica identity/discovered peers, dedicated credential role without secrets, fixture/seed count and hashes, memory-only mail/QR ports, index options, CPU/RAM/pool/concurrency/rate/duration budgets, expected results/stop thresholds, evidence owner and bounded rollback/cleanup scope. The current harness has **no live authorization switch**. Adding real adapters requires further reviewed code; approving this report alone cannot activate them.

Hard exclusions survive future sandbox permission: production DB test/any other DB, real data, production traffic, live SMTP/QR delivery, allocation, campaign participation, experiment registration, authenticated frontend activation, secret/deployment changes. Stop here. No live execution command or production readiness claim is supplied.
