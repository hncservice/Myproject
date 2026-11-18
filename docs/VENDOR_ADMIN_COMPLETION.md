# Phase D vendor/administration completion checklist

Initial audit: 28 October 2026. Source presence is not live integration verification. Current preview remains mock-only. No DB, HTTP/SMTP service, operational script or live redemption is run.

| Area | Initial finding | Safe batch / acceptance |
|---|---|---|
| Vendor creation/update | Creation unaudited; password update audited; no UI activation/revocation | Transactional admin fence/audit, optional activation/revocation on existing update contract, synthetic tests |
| Vendor authentication | Typed/versioned/active guards implemented | Preserve Phase C tests; exercise wrong-role/revoked/disabled operations |
| Vendor dashboard/history | Vendor-scoped queries present; malformed numeric query can become NaN | Strict Joi query limits, owner-only projections, guarded contracts |
| QR/redemption | Transaction/fence/claim/inventory logic present | Synthetic model tests for expiry/replay/ownership/conflicts; no real redemption |
| Vendor exports | Unbounded streaming export; lacks admin export's formula sanitation | Row cap, buffered response, safe cell values, scoped projections |
| Customer admin UI | Sends forbidden privilege/reset fields; reset control cannot succeed | Send only supported fields; remove misleading reset/password/verification mutation controls |
| Inventory admin | Update/deactivate audited; creation unaudited | Fence all writes and audit creation; negative inventory tests |
| Prize review | Guarded backend exists; UI absent | Separate inactive authenticated review page, explicit manual actions, independent advisory display |
| Configuration | Source-managed game/campaign policy; no safe mutable campaign model | Read-only administrative inspection; configuration editing remains a reviewed design/migration dependency |
| Reports/audit | Existing XLSX/stats; missing paginated audit/session/redemption views | Guarded bounded read-only endpoints and inactive admin operations UI |
| Responsive/accessibility | Existing responsive CSS; several unlabeled/unsupported controls | Targeted fixes, component tests; real devices/camera/browser unverified |

Final results, exact files and remaining gaps are appended after implementation in BATCH_LOG.md and this document. Never equate a mocked transaction with actual database atomicity or production readiness.

## Phase D final module matrix — offline evidence only

| Module | Delivered and offline verified | Remaining acceptance |
|---|---|---|
| Vendor accounts/auth | Create/update audit and admin fence; activation/password/explicit revocation increments version; bounded list search/status/sort/page; typed active/version guards retained | Real indexes/casting/persistence and concurrent disable/redemption |
| Dashboard/history | Own-vendor queries; strict days/limit; manual QR default, explicit camera opt-in, synchronous request latch | Device/camera/mobile QA; recent ten is not full vendor transaction search |
| QR/eligibility | Actual service with fake models: expiry/replay/non-winning/incomplete/foreign-award/claim/inventory negatives; version fence and owner claim | Real transactions/indexes/concurrency/QR delivery; no live redemption ran |
| Vendor export | Own-vendor scope; strict period; 5000 row pre/post-query caps; buffered workbook before headers; formula/control sanitation | Real ExcelJS serialization/HTTP/browser download (workbook port mocked) |
| Customers | Edit sends name/phone only; reset action removed; verification/attempt/password fields read-only; stale lists ignored | Delete intentionally 409 controlled review; no anonymization/password reset; legacy phone policy |
| Inventory | Create fenced/audited; update/deactivate preserved; privileged counts rejected; reduce-below-allocation/revoked-admin negatives | Real DB reconciliation/transactions; no inventory created in DB |
| Game/campaign config | Read-only campaign policy and registry.discover inspection | Mutable model/version/approval/rollback needs reviewed design/migration |
| Prize review | Inactive manual UI; existing API; campaign/qualified-game/CAS/audit/duplicate negatives; allocation/draw false | Real transactions/retries/browser UX |
| Fraud display | Separate Integrity V2; V1 explicitly unavailable in this review contract, never inferred or combined; original dashboard untouched | Independent V1 evidence needs separately reviewed contract change |
| Reports/audit | Authenticated bounded search/sort/page; explicit serializers omit contact/hash/QR/raw audit details; safe CSV | Actual indexes/query plans/load/retention; raw Mixed details deliberately omitted |
| Exports | Existing XLSX retained; new report CSV capped at 50 returned rows, formula-safe | Spreadsheet interoperability/real browser delivery |
| Authorization | Signed customer/vendor rejected by admin; customer rejected by vendor; global admin route gate; disabled/revoked fences | Real HTTP/database permissions/concurrency/load |
| Accessibility/mobile | QR label connected; new controls labeled; wrap/scroll layouts; responsive CSS retained | Devices, assistive technology, modal focus, visual QA |

Active application remains main → StrictMode → BrowserRouter → App → FraudDashboardPreview → FraudMonitoringDashboard (four original mocks). AuthenticatedApp is unmounted. Its protected /admin/operations and /admin/prize-reviews declarations and Layout links add no automatic activation.

Original five API mounts/order and all original admin declarations remain unchanged. Four additive GETs follow global authAdmin: /configuration, /sessions, /redemptions, /audit-logs. No-query vendor list keeps array shape (additive isActive); optional bounded query returns {items,total,page,pages}. Vendor update adds optional isActive/revokeSessions, retaining name/email/password contracts.

All seven adminController mutation transaction callbacks claim exact active/role/version fence. Existing prizeReviewFence field is reused, no schema/backfill. Vendor/prize creation now requires transaction support, as other admin writes already did. Allocation false and experimental endpoint non-registration remain intact.

Final: 331 frontend tests / 38 files (301 retained + 30 new); 204 backend cases (152 retained + 52 new); 28 probes in each unit-guard mode; 129 assessment assertions plus 30 probes; 168 backend syntax files. Build passes with unchanged 51-module mock-preview assets. No active unresolved imports, 12 preview graph files, no inspected auth/storage/fixture markers; four historical unresolved references retained.

No DB/service HTTP/SMTP/customer data/real QR/server/Git/secret/deployment/prize operation ran. Fake-model callbacks cannot prove DB rollback or deployed indexes. Exact files/failures/evidence: BATCH_LOG.md. Hashes: CHANGE_MANIFEST.json. The platform is not production-ready.
