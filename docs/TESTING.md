# Safe testing and evidence

## Frontend

From `D:\spinning wheel comp\client`:

```powershell
npx vitest run src --environment jsdom
npm run build
```

Established baseline: 261 tests / 29 files, repeated during initial master audit. Record later counts in the batch ledger; new tests increase the total. Existing tests and assertions must remain. Runtime UI tests cover the mock/offline dashboard and mocked authenticated composition; they do not imply real application E2E coverage.

Initial master repeat: **267/267 tests across 30 files**, production build passed. Six OTP page cases were added; all remain. Current Phase C count appears below. Focused command: `npx vitest run src/features/authentication/pages/VerifyOtpPage.test.jsx --environment jsdom`.

Targeted examples:

```powershell
npx vitest run src/features/fraud-monitoring/components --environment jsdom
npx vitest run src/features/fraud-monitoring/integration --environment jsdom
npx vitest run src/app/previewEntryIsolation.test.jsx src/app/AuthenticatedApp.test.jsx --environment jsdom
```

Coverage reporting needs an installed compatible coverage provider; none has been added or downloaded. Do not report a percentage without a measured report. Keep tests within src unless discovery is deliberately updated.

## Static inventory

From project root: `node tools/audit-project.cjs`. This reads allowlisted client/server source, not .env values, and writes docs inventories. It does not load backend modules or access MongoDB. Historical backup/checkpoint references are listed separately from active failures.

Then run `node tools/verify-offline-structure.cjs` to parse backend JavaScript via `node --check`, verify unchanged routes/safety/entry/configuration files, walk local preview imports and inspect build markers. This writes STRUCTURAL_VERIFICATION.json. Marker absence is supplementary evidence, not a proof about arbitrary third-party code.

## Backend execution classes

See the historical Step 15R.23P `BACKEND_TEST_SAFETY.md` for all 70 scripts, and Step 15R.23Q/R evidence for refinements. Do not run npm test as a suite (currently the package placeholder), start the server, or import config/mailer.js as a safety check.

- Historical isolated tests: allocation safety 6 and recovery classifier 12.
- Separately approved Step 15R.23R execution: simulation plus combined assessment 7, behavior 10, realistic behavior 10, fraud V2 18 named cases. All exit 0; 104 native assertion calls passed. Guard tested 30 blocked capabilities; nine dependency hashes matched the checkpoint.
- Old Perfect Shot test: fixture/error handling repaired in the initial master batch; all 12 original cases / 25 assertions passed under the restrictive guard. Historical held status remains accurate for Step 15R.23Q, not current code.
- Sandbox candidates require exclusive `hnc_step15q_sandbox`, individual review and separate execution authorization. Never fall back to MONGO_URI/MONGODB_URI.
- Operational seed/reset/index/backfill and private transaction loaders are prohibited as regression tests. Never access production `test`.

New pure/service unit tests must use synthetic fixtures and fail-on-unexpected model stubs or explicit module adapters. They must not import Mongoose, email infrastructure, actual server bootstrap, dotenv, HTTP clients or operational scripts. Use Node permission restrictions and restrictive runtime guards when executing new backend checks. Record actual assertion failures separately from guard failures.

Safe new service-unit command from project root (Node 24 permission model required):

```powershell
node tools/run-offline-unit-tests.cjs
```

The fixed allowlist preserves all **122 prior cases** and adds **30 authentication cases (152 total)**. It runs 28 guard probes in standard mode and 28 again in reviewed-library mode. Actual Joi/jsonwebtoken use a hash-checked 166-file/metadata graph; models/email/native bcrypt remain fakes. Child environments are empty and network/process/write/addon capabilities remain blocked. No arbitrary server script discovery occurs. Only the parent writes synthetic evidence.

`tools/auth-library-manifest.json` is local dependency provenance, not copied dependency contents. If the workspace/dependencies change, first review the new graph and run `node tools/review-auth-libraries.cjs` to regenerate its exact paths/hashes. The generator statically rejects dynamic requires and unapproved builtins; it does not execute libraries, download packages or inspect environment files. A changed graph is not blanket permission for backend integration.

Phase C frontend: **301 tests / 35 files**, including all 267 prior tests plus 34 new tests; production build passed with unchanged active-preview assets. Focused auth/journey checks can run with `npx vitest run src/features/authentication src/app/routes/AuthenticatedRoutes.test.jsx src/features/games/components/GameSelectionPanel.test.jsx --environment jsdom` from client. Test storage is synthetic; the preview still has throwing storage/network isolation checks.

`node tools/run-offline-assessments.cjs` separately repeats the six reviewed pure scripts with the unchanged Step 15R.23R capability guard, 30 probes and exact pinned dependency hashes. Current result: 129 assertions, 57 named cases plus one randomized simulation, all six exits zero. This authorization does not extend to arbitrary scripts or database operations.

`node tools/run-offline-benchmark.cjs` performs only the deterministic bounded pure-assessor microbenchmark documented in PERFORMANCE_TESTING.md. It is separate from correctness test totals.

## Evidence limits

No actual HTTP API compatibility, MongoDB transaction/index behavior, live OTP/email, QR delivery, deployment or measured campaign capacity has been verified. Passing mock tests does not satisfy those release criteria. Use PERFORMANCE_TESTING.md for the authorization boundary.

## Latest — Phase D
331 frontend tests / 38 files (301 prior + 30 new); production build passed. 204 backend isolated cases (152 prior + 52 new), 28 probes in each unit-guard mode; six fixed reviewed assessment scripts retain 129 assertions plus 30 probes; 168 syntax checks.

From D:\spinning wheel comp\client:
```powershell
npx vitest run src/features/administration/pages src/features/vendors/pages --environment jsdom
npx vitest run src --environment jsdom
npm run build
```
Local verification used npx --no-install to prevent downloads. Focused new UI: 30/30 in 3 files. From project root, existing reviewed commands remain node tools/run-offline-unit-tests.cjs and node tools/run-offline-assessments.cjs. Static/evidence commands: node tools/audit-project.cjs, node tools/verify-offline-structure.cjs, node tools/finalize-offline-report.cjs.

The new unit suite evaluates exact reviewed source with actual hash-reviewed Joi/JWT and explicit fake DB/email/bcrypt/ExcelJS ports, under empty environment, read-only source access and network/process/write/worker denial. Fake mongoose readyState is synthetic, not a connection. Guard probes run before these cases. Do not discover/run arbitrary backend scripts. Workbook serialization, DB rollback/index/concurrency, live HTTP and browser file delivery remain unverified. Evidence/failure history: BATCH_LOG.md.

## Latest Phase E verification
354 frontend tests across41 files (331 retained +23 new); 256 backend isolated cases (204 retained +52 new); 129 assessment assertions; 174 syntax checks. Frontend build passed with identical active preview assets. Focused new frontend tests:23 across3 files. No existing assertion removed; one existing backend route fixture gained explicit stubs for four new campaign handlers.

From D:\spinning wheel comp\client:
```powershell
npx vitest run src/features/administration/pages/CampaignCompletion.test.jsx src/features/administration/pages/CampaignRoutes.test.jsx src/features/authentication/pages/OtpResendExperience.test.jsx --environment jsdom
npx vitest run src --environment jsdom
npm run build
```
Verification used npx --no-install to forbid downloads. From root, run only node tools/run-offline-unit-tests.cjs and node tools/run-offline-assessments.cjs for backend behavior; source/hash/static commands remain tools/audit-project.cjs, tools/verify-offline-structure.cjs, tools/finalize-offline-report.cjs. Fixed guards retain empty child env, actual hash-reviewed Joi/JWT, fake models/bcrypt/mail/workbook and denied imports plus direct network/process/worker/write capabilities. No real Mongoose load, database or email. New campaign model is syntax/inventory checked only; fake-model callback rollback does not establish database rollback.

New backend cases cover strict dates/games/safety/limits, boundary eligibility, revisions/duplicate requests/audit/admin revocation, active prize references, private bounded activity/list, read-only V2/V1 evidence and existing detail scope/privacy. DOM cases cover structured mutations, retries/secure UUID failure, stale activity clearing, role rejection, independent advisory display, modal labels/focus/escape/trap and quiet resend countdown/timer cleanup/expired OTP feedback. Initial VM-prototype comparisons and grouped-selector focus ordering were corrected; final suites pass. Complete evidence and remaining live integration limits: BATCH_LOG.md and CAMPAIGN_MANAGEMENT.md.

## Phase F resume evidence — 29 October 2026

Current354 frontend tests /41 files,294 backend isolated cases (256 prior+38 readiness),129 assessment assertions and177 syntax checks; build passed with unchanged preview assets. No new implementation/test cases added during resume; all saved cases rerun. Readiness cases recheck HTML escaping through fake sendMail, corrupted/overflowed redemption counters before lookup, unsafe target strings/flags/accessors, stack/body/log redaction and version overflow. Bootstrap tests evaluate source with fake Express/dotenv/DB/router ports: no real Express HTTP dispatch/listener or MongoDB module loaded. Fake models/rollback are not transaction evidence.

Backend evidence: local-checkpoints/master-offline-unit-evidence-2026-10-29T05-46-51-975Z/results.json; assessment evidence: local-checkpoints/master-offline-assessments-2026-10-29T05-46-51-842Z/results.json. Unit guards each28 probes and assessment guard30 probes passed. Existing safe commands remain node tools/run-offline-unit-tests.cjs and node tools/run-offline-assessments.cjs (root); npx --no-install vitest run src --environment jsdom and npm run build (client). No arbitrary backend discovery/operational script allowed. INTEGRATION_READINESS.md describes separately authorized Phase G stages; these have NOT run.

## Final handover regressions
Added exactly five cases to server/tests/unit/integrationReadiness.offline.test.cjs (now43 readiness cases; total299 backend): development and production error redaction, unauthenticated current DB-gate acquisition, failure reset/retry and simultaneous pending-promise coalescing. Real process environment unchanged; fake dotenv/Express/DB/router ports only. Existing38 readiness and all256 prior backend cases/assertions retained. Frontend354 across41 files and129 assessment assertions/build pass. No actual dispatcher, MongoDB, SMTP, listener or live HTTP ran. Final per-process evidence and exact files: BATCH_LOG.md. Actual compatibility/transaction/rate-limit tests remain separately authorized per PHASE_G_SANDBOX_PLAN.md.

## Phase G1 harness tests — 29 October 2026

Run only `node tools/run-offline-unit-tests.cjs` from the project root for the fixed approved backend list. It now includes server/tests/unit/integrationHarness.offline.test.cjs, source-reading the separate integration preparation modules under the same native-permission/import/direct-API guard and empty environment. Do not invoke the harness as a live runner or bypass its required guard.51 new cases cover strict config/target/activation/cleanup denials, immutable fixtures, no live capability, runtime gate, bounded deadlines/cancellation/waves/barriers, case budgets and secret-free evidence. Existing299 cases are unchanged; total350 passed. Two28-probe guard modes are counted separately.

Repeat frontend: from client, `npx --no-install vitest run src --environment jsdom`, then `npm run build`. Actual result354/354 in41 files and build pass. Assessments: `node tools/run-offline-assessments.cjs` yielded129 assertions/six fixed reviewed scripts and30 guard probes. Static checks: `node tools/audit-project.cjs`, then `node tools/verify-offline-structure.cjs` yielded180 syntax files/no active errors; final manifest via `node tools/finalize-offline-report.cjs`. No backend integration/operational/DB-backed test was executed. Detailed source hashes/exits/remaining gates: PHASE_G1_HARNESS_READINESS.md.

## Phase G2A adapter test extension — 29 October 2026

The fixed `node tools/run-offline-unit-tests.cjs` list now includes integrationAdapters.offline.test.cjs with exact source reads for four new integration preparation modules, existing G1 modules/policy and server.js text.77 new positive/negative/mock-lifecycle cases all passed; existing350 retained, total427 across18 guarded child invocations. Guard modes28/28 twice remain additional. Never invoke actual driver/framework/application code or use ordinary node to bypass the guard; adapter ports in this task are mocks only.

Client `npx --no-install vitest run src --environment jsdom`:354/354 across41 files; `npm run build`:PASS, identical51-module assets. Approved assessments remain six fixed reviewed scripts/129 assertions/30 isolation probes. Static audit/structure tools report185 syntax files and no active import/parse failures; known unreachable backup/checkpoint imports retained. Exact evidence and limitations: PHASE_G2A_ADAPTER_READINESS.md. PHASE_G2B_SANDBOX_PROPOSAL.md requires future code/command/source/credential/egress/target/fixture/budget/cleanup approval; no actual transaction/DB/listener test is authorized or represented as passed.

## Phase G2B final preflight verification — 29 October 2026

No tests or application/adapters changed. Reran only the existing approved fixed offline backend/assessment runners, client full regression/build and static syntax/structure checks. Results427/427 backend (18 child invocations exit0, two28-probe guard modes extra),354/354 frontend across41 files,129/129 assessment assertions/six scripts with30 probes,185/185 syntax, build PASS/same51-module assets. No failures. All ten proposed live stages remain BLOCKED; pure JSON planning validation checks non-executable status/budgets, not actual infrastructure isolation. See PHASE_G2B_FINAL_PREFLIGHT.md for commands/evidence and PHASE_G2B_EXECUTION_PLAN.json for future CLI contracts. Do not run nonexistent candidate runner strings or weaken the offline guard.
