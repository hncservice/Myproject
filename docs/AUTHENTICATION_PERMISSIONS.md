# Authentication and permission review

| Role / operation | Existing boundary | Unverified / missing |
|---|---|---|
| Public registration | Real Joi validation, canonical new phones/common alias checks, unique declarations, atomically bound pending credentials/challenge | Historical aliases/admin writes, physical phone ownership and real duplicate races unverified |
| Customer login | Password then purpose=login OTP, verified/active account, per-account persistent send/attempt counters | Actual DB/distributed rollout, native bcrypt and provider behavior unverified |
| OTP verification | Purpose/hash/expiry/version/pending-data pinning, five reserved attempts, one-use update | Actual MongoDB concurrency/provider ordering unverified |
| Customer APIs | HS256, verified/active lookup and tokenVersion; legacy untyped/unversioned tokens at stored version zero | Coordinated rollout/rollback required; see AUTH_SCHEMA_ROLLOUT.md |
| Vendor APIs | type=vendor, active account, tokenVersion; redemption transaction rechecks authenticated version | Real transactional fencing/concurrent revocation |
| Admin APIs | type=admin, active/disabled checks, tokenVersion; review transaction rechecks version | Role separation beyond the single administrator type |
| Logout | Local clearing plus explicit bearer self-account version-CAS revocation for user/vendor/admin; role-specific redirects and failure notice | Actual persisted revocation/unavailable storage/cross-tab UX need runtime integration verification |

Do not replace current auth or remove legacy compatibility silently. Provider composition tests are mocked; they do not prove real OTP/login/DB behavior. All real auth pages and data remain inactive from the current preview. Account deletion, normalization or revocation schema changes require a migration/backfill/rollback proposal before altering existing records.

Phase C redacts authentication controller/middleware error logs. Shared errors elsewhere still need privacy review. Actual Joi/jsonwebtoken run under the reviewed offline guard; native bcrypt, SMTP and real models remain faked. JWT key entropy/rotation and issuer/audience policy remain deployment review items; existing token/session-HMAC coupling is unchanged. No secret/provider access is authorized. CUSTOMER_AUTHENTICATION.md records exact evidence and remaining gaps.
