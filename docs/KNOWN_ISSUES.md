# Known issues ledger

| ID | Finding | Status / required next step |
|---|---|---|
| GAME-001 | Generic completion's sessionToken argument shadowed its helper | Fixed by local alias; reproduced before fix (1/8 cases), then 8/8 isolated cases passed. API field remains sessionToken. |
| TEST-001 | Legacy Perfect Shot fraud fixture lacked events/coordinates; async error catch ineffective | Fixed fixture and removed unnecessary async; all 12 original cases / 25 assertions passed under the Step 15R.23R restrictive guard. Validator unchanged. |
| AUTH-001 | Customer revocation | Implemented offline: verified/active/version checks and self-account logout; legacy-zero compatibility. Actual persistence/coordinated rollout/rollback still unverified. |
| AUTH-002 | Phone identity/legacy normalization | New customer writes canonicalized and common aliases checked. Historical unusual whitespace/admin writes/phone ownership and conflict migration remain open; no records inspected. |
| AUTH-003 | Customer workflows | OTP resend/attempt limits/interrupted verification now tested; real provider/distributed behavior and profile/password-reset product APIs remain unverified/missing. |
| SMTP-001 | Mail transporter verify ran on module import | Fixed: automatic verify removed; export/options retained; two synthetic import cases pass. Real delivery/integration unverified and unauthorized. |
| LOG-001 | Controllers/global middleware log raw errors; dev response may include stack | Open; define bounded privacy-preserving error contract and regression tests before refactor. |
| DB-001 | Old scripts use general URI fallbacks or other sandbox DB names | Restricted; inventory marks them prohibited. Do not execute. Add preflight boundary only after compatibility/individual review. |
| GAME-002 | Multi-game extensibility | Registry/lifecycle/model-store/compatibility contracts implemented with 89 new offline cases. Actual DB/HTTP/concurrency, historical-version resolution and worker pending-marker reconciliation remain unverified; no future game activated. |
| GAME-003 | Config lookup accepted inherited names and coerced non-string game IDs | Fixed: string own-key lookup; six isolated configuration cases pass. Existing identifiers/configuration unchanged. |
| UI-002 | OTP conditional hooks failed on location-state changes; prize redirect targeted missing /profile; digit fields lacked names | Fixed: unconditional hooks, existing /user/home target and accessible digit labels. Six mocked UI cases pass; no active-route changes. |
| UI-001 | Admin campaign/audit/game-settings/prize-review presentation gaps; QR URL has no declared redeem route | Open; do not invent live endpoints. Mocked UI and contract review required. |
| HIST-001 | Stale imports in inactive App.backup.jsx and historical Step15R22O adapter copy | Retained history; not active import failures. |
| VERIFY-001 | Live DB/HTTP/email/login/transaction/index/concurrency/performance behavior unverified | Blocked pending explicit isolated environment authorization. No production readiness claim. |

See source inventories for exact file ownership and TESTING.md for evidence. A passed mocked unit test is not a verified database transaction.
