# Offline integration harness preparation — Phase G1

29 October 2026. This directory is **preparation only**, not a live runner. The user's G1 development authorization does not authorize the database-execution G1 stage in PHASE_G_SANDBOX_PLAN.md. No driver, Express, application, dotenv, mailer or socket module is imported here.

## Files and safe execution

- offlineRuntime.js requires the fully installed approved offline guard, native Node permission denials, and an empty frozen environment. It has no unguarded fallback.
- offlineHarness.js validates explicit configuration, produces immutable synthetic fixture recipes/cleanup plans, coordinates cooperative deadlines/cancellation/barriers, and emits bounded sanitized evidence. All connect/listen/request/email/QR/allocation/activation/cleanup operations always throw LIVE_INTEGRATION_NOT_AUTHORIZED, even with an authorization-looking argument.
- config.example.json is inert, credential-free preparation data, never loaded automatically. Supply a new unique 18-character lowercase hex runId for each isolated test. Never reuse this example runId for persisted fixtures. No environment lookup or MONGO_URI fallback exists.
- ../unit/integrationHarness.offline.test.cjs verifies this source through the existing source-only loader and restrictive child guard. Do not run this test or the harness directly with ordinary node.

From the project root, the approved command is `node tools/run-offline-unit-tests.cjs`. Its fixed allowlist includes this source and tests; each child has an empty environment, no filesystem-write/child/worker/addon/WASI permissions, blocked CommonJS/ESM external imports and direct network/process API blockers. The parent alone writes hashed evidence under local-checkpoints. Guard failure is fatal; never relax it to obtain a pass.

## Explicit configuration and budgets

Every field in config.example.json is required; unknown/symbol/prototype/accessor fields are rejected. The URI must exactly follow the shown canonical option order and credential-free literal IPv4 loopback form. Only database hnc_step15q_sandbox, an explicit nonprivileged port, a named replica set, and authSource matching that database are accepted. HTTP must be the exact loopback origin on a different explicit port, with no credentials/path/query/fragment. DNS, SRV, replica lists, alternate hosts, implicit ports and driver override options are rejected. Returned metadata does not contain the URI.

Connection/request timeouts: 1–5000ms; total run window: at most300000ms and no shorter than either timeout; case count:1–100; concurrency helper:1–20. connectionOptions disables autoCreate/autoIndex and bounds pool/selection/connect/socket settings; it is only a future adapter proposal and never passed to a driver here. Each runCase accepts a reviewed clock with monotonic integer now(), setTimeout and clearTimeout; clock identity cannot change during the run. The first case starts the total window. The runner's child-process wall-clock limit is a separate hard ceiling.

runWave applies the harness maxConcurrency and remaining maxCases to a known scenario, captures each case result, and stops/cancels siblings on failure. The lower-level runConcurrent accepts a bounded task array and preserves result order, with a single batch deadline and cooperative AbortSignal; use runWave for configured runs. createBarrier synchronizes arrival, and cancel rejects waiters. Always cancel barriers on abort in a prepared scenario. Timeout/failure/termination stops new cases and aborts registered cases. Callbacks must observe cancellation; Promise cancellation cannot forcibly stop arbitrary code or undo a committed write. The outer guard/process timeout is mandatory. No arbitrary unreviewed callback or test script is an approved capability.

## Fixture isolation and cleanup

Each test creates a fresh harness with a distinct runId and obtains frozen user/campaign/game-session recipes. IDs consist of the run prefix and a bounded sequence. Sessions require prior user/campaign fixtures and reference those exact recipes. Email uses example.invalid; campaign enabled is false and only existing games are assigned. Hashes/credentials are conspicuous unusable placeholders, dates are deterministic strings. These recipes are not valid authentication credentials or evidence of Mongoose casting/validation. A separately reviewed live seeder must hash synthetic credentials, set approved test-relative clocks, validate actual schemas, reject every preexisting-ID collision and retain insert acknowledgements before cleanup can be considered.

cleanupPlan requires the exact database/host/port/replica-set tuple plus object-identical fixtures produced by this harness. It rejects empty, duplicate, copied, foreign or fabricated receipts, arbitrary filters/collections and override fields. It returns only allowlisted collection/exact-ID records marked non-executable and authorization-required. It never drops a database, truncates a collection or deletes anything. This in-memory preparation receipt is **not** proof that an insertion occurred or that a persisted record remains owned/unchanged. Future cleanup needs an approved immutable seed ledger, actual topology/connection validation, exact inserted IDs and state/revision checks; no rollback may resurrect consumed OTPs, tokens, attempts or redeemed prizes.

## Prepared concurrency scenarios (not database tests)

The immutable scenario catalogue and runCase IDs below are reusable preparation contracts. Existing offline domain suites remain the business-rule evidence; these identifiers and synthetic callback tests do not establish database atomicity. Prepare independent synthetic identities/fixtures for each wave2/5/20, never real customers or actual prize issuance.

| ID | Barrier / expected acceptance after separate authorization |
|---|---|
|otp-issue|Same-account CAS issuance: one replacement and memory delivery, send budget/cooldown retained|
|otp-verify|Same challenge: one consume/token, at most five comparisons; replaced/expired challenge loses|
|token-revoke|Same version: one increment; old/replayed token rejected; no version rollback|
|game-start|Start/resume one user/game: one active/attempt winner, consumed attempts retained|
|game-complete|Duplicate final action: one terminal transition and server-verified score|
|prize-decision|Qualified owned synthetic session: one preliminary decision, no allocation/reroll|
|recovery|Interrupted completion: exclusive live claim/lease and bounded retries, reconcile existing decision|
|qr-fence|Separately seeded historical synthetic claim: one redemption/inventory increment; memory delivery only|
|campaign|Revision/CAS conflict: one definition/audit, participation remains off|
|admin-write|Concurrent/revoked actor: one authorized revision and matching audit or full rollback|

## HTTP middleware composition boundary

Do not import server.js or config/db.js here: they load dotenv/use unrestricted MONGO_URI. The existing43 integrationReadiness offline cases evaluate bootstrap **source text** with fake dependencies and denied listen, preserving evidence of trust-proxy/CORS/Helmet/parsers/public health/lazy DB/five routers/404/error ordering. They confirm pending-connection coalescing and the pre-auth DB risk. They do not emulate the real Express dispatcher.

A future separately reviewed source loader/app composition must supply real Express/routers through a pinned dependency manifest but substitute dotenv, DB connection, logs, OTP mail and QR delivery before module initialization. It must preserve `/api/auth`, `/api/spin`, `/api/vendor`, `/api/admin`, `/api/games` and current middleware order. A listener owner must bind only the approved literal address/port, pin every HTTP request to that exact socket, disable redirects/proxies, limit bodies/time/rate, cancel/close requests/listener/DB at termination, and prohibit all nonapproved egress including replica discovery. No such live adapter/listener is enabled by this preparation module. Full H01–H28 dispatcher/outage/role/rate-limit acceptance remains BLOCKED.

## Evidence, stops and authorization

runCase reports only known scenario ID, PASS/FAIL and fixed failure codes. Callback return values, error messages/stacks, request/response bodies, URI, OTP/JWT/QR/passwords are never recorded. A failure terminates the run. Reports are deeply immutable; parent runner captures source hashes, actual exits and test assertions. No reporter writes from the guarded process.

Before real adapters or execution: approve exact code/dependency hashes/commands, isolated replica-set/HTTP tuple and discovered peers, database-scoped synthetic credentials supplied privately (not this config or an existing .env), OS egress policy, memory delivery ports, fixtures/seed receipts, named indexes/options, CPU/memory/time/rate limits, operator/evidence owner, stop thresholds, transaction-fault scenarios and exact cleanup scope. Source validation alone cannot prove these controls. Stop on wrong target/peer, denied egress, secret evidence, duplicate mutation, missing audit, inventory mismatch or activation-gate change. Freeze writers, close only approved handles, preserve sanitized receipts and reconcile unknown commits before retry; no automatic destructive rollback.

Allocation and customer participation remain hardcoded off, the experimental endpoint unregistered, and the four-session mock frontend active. See docs/PHASE_G_SANDBOX_PLAN.md and docs/PHASE_G1_HARNESS_READINESS.md. No live execution command is provided.

## Phase G2A adapters — offline-only extension

adapterSafety.js, databaseIntegrationAdapter.js, httpIntegrationAdapter.js and expressBootstrapAdapter.js add mock-port interfaces; they do not relax G1. No MongoDB, Mongoose, HTTP client, Express package, real application module or SMTP module is imported. The existing offlineRuntime guard is checked at creation and before every acquisition/operation/disposal. Both adapter factories accept only config, enabled, authorization, ports and clock. enabled defaults false; valid configuration is still mandatory. Unknown/accessor/prototype options (including MONGO_URI) are rejected. Never run them with an ordinary node invocation.

An enabled adapter also requires an exact copied authorization descriptor: mode synthetic-offline, runId matching config, databaseName hnc_step15q_sandbox, host127.0.0.1, mongoPort and replicaSet matching config, matching httpBaseUrl, and capability database-mock or http-mock as appropriate. This descriptor authorizes **mock work only**, not live execution, and is not evidence of human permission. mode live is always rejected. There is no live authorization flag. The frozen empty environment and native/runtime guard remain mandatory even with this descriptor.

### Database mock port contract

createDatabaseIntegrationAdapter accepts ports.credentials/open/describe/operation/transaction/close functions, pinned at first use. Import/creation never calls them. connect coalesces pending acquisition, obtains explicit synthetic credentials and calls only the supplied mock open function. No URI is passed to the port; the immutable target/options and credential object are separate. Credentials require username synthetic_<runId>, a synthetic-offline-prefixed placeholder password, databaseName hnc_step15q_sandbox, role hnc_synthetic_fixture and exactly ordered actions find/insert/update. Accessor arrays/additional privileges are rejected. This is a **mock least-privilege contract**, not a verified MongoDB role or a live credential provider.

describe must return exactly databaseName/host/port/replicaSet/members/role/actions, with the configured identity, one pinned loopback replica member and the same restricted role/actions. It is checked after acquisition before any operation, then again before each operation/transaction descriptor. Wrong identity/peer/role prevents workflow dispatch and disposes the owned mock handle. Actual discovery, role grants and DB permissions require separately reviewed driver/OS enforcement later.

fixture(kind) uses G1 recipes and retains object-identity ownership; copied/foreign/duplicate/empty fixture lists are rejected. operation(workflow, fixtures) and transaction(workflow, fixtures) accept only the ten existing scenario IDs and pass exact owned kind/IDs, sandbox/run scope, maxTimeMS and snapshot/majority/maxCommitTimeMS descriptors. They call mocks only; no actual transaction or business operation is executed. Return receipts contain only workflow/accepted/matchedCount0-or1. These descriptors do not establish OTP/session/recovery/redemption atomicity or seed historical QR/prize records. cleanupPlan stays non-executable and cleanup always throws; no deletion/drop/index-management port exists.

### HTTP mock port and bootstrap contracts

createHttpIntegrationAdapter accepts ports.buildApp/openListener/describeListener/dispatch/closeListener, also pinned at first use. open calls only mock ports after enablement/authorization/guard checks; bind metadata must be the exact configured literal loopback host/port. The mock listener identity is rechecked before requests. No socket/listener is created by this implementation or tests.

request takes exactly method/path/body/fixtures: allowed methods GET/POST/PUT/PATCH/DELETE/OPTIONS; only root/health or paths in the original five API namespaces; no absolute/protocol-relative URLs, query/fragment/encoded/traversal paths, host/headers/proxy overrides or experiment namespace. Non-null bodies require owned synthetic fixture receipts. JSON is copied/frozen with depth6,50 entries/array elements and8192 UTF-8 bytes; getters/prototype/function/activation fields and non-example.invalid email strings are rejected. Responses have bounded status/body and the same bounded JSON handling. Caller-supplied strings are not proof of synthetic provenance; only reviewed mock/test bodies are authorized. Auth-header, query-string, malformed-JSON, oversized parser, TLS/proxy and wider HTTP matrix cases need separately reviewed request contracts before future execution.

dispatch descriptors pin the origin, redirect:error, proxy:false, timeout and max response bytes. These are interface obligations for a future client, not OS egress enforcement. No redirect is followed here. Responses can contain sensitive synthetic test values; callers must not serialize raw responses into evidence. Adapter diagnostics never include request/response bodies or transport errors.

composeExpressBootstrap accepts explicit bootstrap source text, reviewed SHA256 pin, config and exact express/cors/helmet/routers/connectDatabase/errorMiddleware ports. It uses the actual unchanged server.js text in a bounded VM evaluation, with a closed import map, no-op dotenv, synthetic frozen process environment and discarded raw logs. Only supplied routers are used; no route/controller/model dependency is automatically imported. app.listen is replaced with an unconditional denial. The VM is a composition utility, not a security boundary: source/dependencies must remain reviewed and the outer runtime/process guard mandatory. Real Express/routers/drivers are **not loaded in this phase**. Source pin tests preserve five mounts and actual bootstrap registration ordering through fake Express, not real HTTP dispatch. F02's pre-auth DB gate remains unchanged.

### Limits, disposal and evidence

The G1 configured total window, maxCases and per-operation deadlines apply; connection work is additionally bounded by connectionTimeoutMs and the outer request/run ceiling. Adapter in-flight work rejects above maxConcurrency instead of queueing unbounded requests. HTTP/database operation timeout or failure terminates the harness and closes the owned mock handle. close is idempotent, cancels pending work and prevents reuse. If acquisition resolves after timeout/close, its handle is disposed rather than adopted. Disposal itself has a deadline and closeFailed is reported without raw errors. Cooperative abort cannot force arbitrary callbacks to stop or undo an unknown commit; a reviewed future driver must enforce native cancellation and quarantine unreconciled state.

The ten scenario IDs are reused for budgeted callbacks. Infrastructure acquisition/request diagnostics currently use game-start/game-complete budget labels; these labels do not indicate gameplay was executed. Dedicated adapter tests prove wiring/safety, not actual domain transactions. New77 cases are in ../unit/integrationAdapters.offline.test.cjs, run only via the approved fixed offline runner. Full report: docs/PHASE_G2A_ADAPTER_READINESS.md; proposed next gates: docs/PHASE_G2B_SANDBOX_PROPOSAL.md. No live command or adapter is activated by this extension.
