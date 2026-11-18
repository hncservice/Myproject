# Controlled performance plan

No production traffic or HTTP/database load test is authorized. The existing latency simulation is random mathematical sampling, not an application performance benchmark.

First offline batch: deterministic synthetic validation/assessment and mocked lifecycle workloads, warm-up plus bounded repetitions, process CPU/heap/event-loop observations, elapsed latency samples and error counts. Report seed/data size, Node/OS, warm-up, iterations and p50/p95/p99. Do not extrapolate concurrency capacity from synchronous loops.

## Initial measured pure-function baseline

Safe repeat command from project root: `node tools/run-offline-benchmark.cjs`. This fixed reviewed benchmark uses the same permission model, explicit source VM substitutions, empty inherited environment and 28 guard probes as the service tests. No application dependency, HTTP listener, DB or mailer loads.

Run evidence: local-checkpoints/master-offline-benchmark-2026-10-28T11-01-19-007Z/results.json. Node v24.11.1, Windows x64; 500 warm-up calls and 10,000 serial measured calls, deterministically alternating valid and score-manipulated synthetic Monkey sessions with seven events each. No random seed is needed; fixtures and ordering are fixed. Zero validation-result mismatches; inputs unchanged.

| Measurement | Observed |
|---|---:|
| Total measured loop | 297.8358 ms |
| Per-call p50 | 0.0276 ms |
| Per-call p95 | 0.0363 ms |
| Per-call p99 | 0.0621 ms |
| Serial calls/second | 33,575.55 |
| CPU user/system | 328 / 0 ms |
| Heap delta | +19,288 bytes |

These measurements include VM and timing overhead on this machine. Heap delta includes allocation/GC noise; CPU timings have platform granularity. This is **not** end-to-end throughput, concurrency, HTTP latency, event-loop delay, transaction performance or campaign capacity. No simultaneous-user claim follows. Remaining workload and event-loop/endurance measurements require further dedicated batches; real HTTP/DB work retains the authorization boundary below.

Before any real HTTP or database-backed test, present an isolated localhost-only server with synthetic adapters, explicit resource limits/duration, blocked SMTP and delivery, hard-disabled allocation, no experimental endpoint, and restricted DB credentials exclusively for hnc_step15q_sandbox if DB work is separately approved. k6/Artillery selection or installation must respect local availability and authorization; neither is required for initial offline work.

Candidate future scenarios (not authorized): mocked concurrent registration/OTP, game starts/submissions, duplicate/invalid completion, simulated decisions, reporting queries, ramp-up/endurance, rate-limit saturation and recovery. Measure throughput, percentiles, error/idempotency rate, CPU/heap/event-loop delay and recovery; test index/query behavior only with DB approval. Stop on resource/error thresholds agreed before running. Never claim support for a specific simultaneous-user count without representative measured results.

## Phase F controlled load-validation design — PROPOSED, NOT RUN

The earlier microbenchmark is historical pure-function evidence only. No new HTTP, database, concurrent-user or load measurements were produced in Phase F. The six reviewed assessment scripts ran offline with129 assertions; randomized arrival-delay simulation is not capacity evidence.

### Entry conditions

All stages require explicit authorization for the exact local target, stage, synthetic seed, tool/version, source hashes, duration, rate/concurrency cap, resource budget and stop/cleanup policy. Use a dedicated ephemeral replica set and only hnc_step15q_sandbox; production test and every other DB are prohibited. Deny external egress, SMTP, QR/prize delivery and production credentials; use memory-only mail/delivery adapters. Allocation and campaign participation remain hardcoded false. Never start server.js using existing .env as a load harness.

The pure infrastructure/testing/integrationTargetPolicy.js validates explicit loopback MongoDB/HTTP URI strings and flags without reading environment or connecting. It rejects test/other DBs, remote/SRV targets, URI overrides, bad authSource, missing replicaSet, live mail and activation flags; output omits credentials. It is not installed in production startup and cannot establish actual DB roles, DNS resolution, socket target, egress rules or consent. A reviewed future harness must call it before module initialization, pin the approved address/ports, verify resolved loopback addresses and actual connection.name, and enforce DB-scoped credentials/no dotenv fallback. App factory/adapters and actual load harness remain to be reviewed/implemented; no tool installed here.

### Proposed workload profiles

| Profile | Data/scenario | Measurements and invariant checks |
|---|---|---|
| Registration | Synthetic unique email/phone, duplicate email/aliases, invalid and interrupted requests, native bcrypt cost10 | Response200/error contract, CPU/hash latency, one account/normalization invariant, pending binding, memory mailbox counts; no actual mail |
| OTP | Correct/incorrect/expired/replaced codes, resend/verify/logout races, identical challenge bursts | <=5 comparisons per challenge; five sends/10min and60s resend rule; exactly one consume; no challenge exposure in logs |
| Auth/role | Login/current/revoked/forged/expired tokens, customer/vendor/admin matrix | Correct rejection codes and zero unauthorized writes; no token in measurements |
| Game start/status | Distinct customers, repeated starts/same-user bursts, expiry/attempt exhaustion | One active attempt, bounded consumed attempts, generated credential; current legacy START_CONFLICT vs future-adapter resume distinguished |
| Gameplay/completion | Monkey and Perfect Shot actual server rules and realistic round/shot timing; duplicate/reordered/final commands, generic abandon completion | p50/p95/p99 action latency and event-loop lag, exactly one transition/score effect. Never submit a fake score as authoritative. Minimum reaction/pause timing must be respected; lower load must not be achieved by disabling verification |
| Fraud/decision | Valid/suspicious persisted synthetic evidence; bounded separateV2/V1 recomputation; decision callback fault | Immutable findings, no V1 enforcement, no reassessment on duplicate existing decision, zero award/draw/QR; track missing-decision recovery lag |
| Admin reports | Indexed synthetic dataset tiers1k/10k/100k only if approved, bounded page/deep offset, substring search, count/aggregate/XLSX variants | Query plans/examined-returned ratio, page/count lag, heap during workbook buffering, no private token/QR columns; distinguish cap5000 from bounded query cost |
| Campaign/admin writes | Concurrent revisions/duplicate request IDs/admin revocation/audit failure, synthetic inventory references | Exactly one accepted revision/audit for each logical mutation, latest-write idempotency, no customer admission or allocation; fence contention metrics |
| Redemption | Separately approved synthetic historical prize/QR fixtures seeded directly, across vendors/replay/expiry/inventory conflicts | One committed claim/inventory increment, no under/oversell, stale vendor denied; email adapter remains memory, no real prize creation/QR delivery/allocation service |
| Recovery | Only separately authorized sandbox worker/lease scenarios, batch<=25, kill/fault/ack loss/reconciliation | At most one active owner, stale worker cannot finish, attempts<=5, pending/held backlog/time-to-reconcile; no live worker activation |

### Rate-limit realism

Existing login/IP limits are10/15min; shared OTP IP limiter is5/10min across register/verify/resend. Per-account challenge limits also apply. A single loopback IP cannot exercise high registration/OTP success throughput without expected429. Keep limiter-functional tests separate from service-capacity tests. Do not remove limits, spoof arbitrary X-Forwarded-For or change production quotas to manufacture passing throughput. Any distinct synthetic client-IP topology must use an approved local proxy with verified trust-proxy semantics and an explicit profile declaration. Always report attempted, accepted, rejected429/409 and unexpected5xx rates separately. Native bcrypt, real MongoDB and actual HTTP processing are absent from current offline throughput evidence.

### Proposed stages and budgets (operator approval required)

1. Correctness smoke: <=1 request/s, <=5 in flight,5min, one workload at a time. Exercise auth and invariants before any ramp. No stage was run.
2. Short concurrency: barrier bursts of2,5,20 operations against the same synthetic account/session/review/QR; <=5min each. Capture commit/ack fault cases; reset only approved synthetic fixtures between trials.
3. Representative read/game mix: approved target hardware, e.g.50% status/history,30% valid gameplay actions,10% starts/completions,8% read-only admin/report,2% synthetic mutations. Ramp10→25→50→100 requests/s,10min/step, <=100 in flight. These are proposed test points, not supported capacity or an automatic permission to reach100.
4. Endurance:60min at the highest prior passing **approved** rate; operator must separately permit runtime/resources. Then controlled restart/recovery. Stress beyond these caps or more simultaneous users needs a separate run proposal.

Fix seed/random schedule per run; keep warm-up separate; record Node/OS/MongoDB/driver versions, CPU/RAM limits, replica-set members/storage, index manifest, source/test hashes and adapter versions. Use constant-arrival-rate plus bounded in-flight/queue metrics to avoid coordinated-omission claims. Record client scheduling delay, server processing/event-loop and DB latency separately. A load generator on the same machine competes for resources; report it.

### Candidate acceptance criteria — targets, not results

| Signal | Proposed gate to approve before testing |
|---|---|
| Auth/registration/OTP with native hashing + fake mail | p95<=1500ms, p99<=3000ms under approved rate; correctness/limits never sacrificed |
| Status/start/gameplay/complete/preliminary decision | p95<=300ms, p99<=1000ms; document latency-fairness impact separately (server arrival-time scoring can penalize network delay) |
| Pure assessment and review recompute | p95<=50ms server processing for bounded fixture; reported HTTP latency separately; no inference from historical serial microbenchmark |
| Admin bounded pages | p95<=1000ms, p99<=2500ms at approved dataset; export<=10s for<=5000 rows without exceeding memory budget |
| Synthetic redemption/admin transaction | p95<=500ms, p99<=1500ms for uncontended valid operations; same-record contention conflicts tracked separately |
| Unexpected errors |<0.1% unexpected5xx/network failures; zero uncaught exceptions/unhandled rejections; all expected429/409 must match scenario, not be hidden as success |
| Integrity/idempotency/privacy | Zero duplicate consumes/claims/awards/terminal effects/audit omissions, unauthorized writes or credential exposure; zero prize/campaign activation |
| Memory | Per API process RSS<=512MiB and<=80% assigned memory; post-warm-up retained heap growth<10% across final30min, corroborated with bounded GC diagnostics; buffered exports counted |
| CPU/event loop/connections | Steady CPU<80% allocated budget, event-loop p99<100ms, bounded connection pool/queue and no connection leak; tune only through reviewed nonproduction harness |
| Graceful recovery | After an approved transient outage, healthy requests recover within30s and pending synthetic decision/recovery backlog within120s or one declared backoff interval; no retry storm or duplicate processing |

Stop immediately for any invariant/privacy/gate violation, nonapproved network/database attempt, OOM/uncaught failure, RSS>80% budget, CPU>95% for60s, unexpected error rate>1% for30s, or p99>3s for60s outside intentionally injected outage windows. Preserve synthetic evidence before separately authorized cleanup. Failed runs remain evidence; do not weaken controls or discard slow/error samples to pass.

No production-readiness/simultaneous-user/transactions-per-second claim follows until representative authorized runs pass, including measured latency/error/heap/recovery results and manual security signoff.

Phase F resume, 29 October 2026: offline regression/build/assessment checks passed again; no load test ran or new capacity result was produced. INTEGRATION_READINESS.md stages G0–G4 and operator approval requirements govern the future plan. Candidate targets and profiles above remain unapproved proposals.

## Final handover classification
Proposed workload/SLO/stop budgets remain unexecuted and unapproved, not load results. F13 (Medium) covers shared-IP/proxy/limiter realism; F14 (Medium) query/export/index/heap costs; F19 (High) external runtime/capacity authorization. PHASE_F_ISSUE_REGISTER.md supplies files/corrections/test requirements, and PHASE_G_SANDBOX_PLAN.md G2b/G4 provides the explicit proxy/load approval/rollback gates. Full contract/correctness stages must pass before any rate escalation. Final offline tests354/299 and build pass do not establish simultaneous-user capacity; no high-traffic run occurred.
