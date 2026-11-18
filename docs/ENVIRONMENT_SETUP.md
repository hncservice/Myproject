# Environment setup without secret access

The examples were created from source references only. Existing `.env` files were not opened, overwritten, populated or copied. Examples contain no working credentials. Do not copy production connection strings into local development.

The current frontend preview needs no backend, JWT, SMTP or database configuration. Use the existing installed frontend dependencies for offline tests/build; do not start the backend to test configuration.

| Variable / setting | Current source meaning | Manual setup / restrictions |
|---|---|---|
| VITE_API_BASE_URL | Public Axios base URL; source fallback `http://localhost:5000/api` | Preview does not import Axios. Backend's existing default port is 5001, so an authorized local authenticated setup needs an explicit matching base URL. Do not silently change compatibility defaults. |
| VITE_FRAUD_REPORT_SANDBOX_ENABLED | Literal true only in Vite test mode | Keep false. Does not register an endpoint or configure transport. |
| Vite MODE | Build-tool mode; test boundary input | Not a secret or a custom application variable. Do not manufacture it in examples. |
| PORT / NODE_ENV | Backend 5001 fallback / logging, security and development checks | Examples are not permission to start a service. Production behavior remains unverified. |
| CLIENT_URL | Allowed CORS origin, QR public URL prefix | Local placeholder only. Existing CORS also has hardcoded deployment origins; no deployment/CORS changes were made. |
| GAME_CAMPAIGN_ID | Campaign policy identifier, source fallback legacy campaign | Use a clearly synthetic identifier for offline fixtures. No campaign records were modified. |
| MONGO_URI | Existing server DB adapter target | Leave blank. Not used by offline tests; never point to production `test`. |
| HNC_SANDBOX_MONGO_URI | Intended sandbox test target | Leave blank until separate approval. Must exclusively address hnc_step15q_sandbox with restricted permissions and no fallback. |
| JWT_SECRET / JWT_EXPIRES_IN | HS256 signing and gameplay-session HMAC / one-hour fallback | No real values were read/generated. Enter a local non-production secret manually only for approved isolated auth runtime. Rotation policy remains a design task. |
| EMAIL_HOST / PORT / USER / PASS | Existing SMTP transporter; port fallback 587, 465 selects secure mode | Blank credentials; never test delivery implicitly. Import-time verify was removed. Offline tests substitute email dependencies entirely; real sends remain unauthorized. |
| SMTP_FROM / SMTP_USER | Receipt sender fallback aliases in emailService | Optional sender values, not a replacement credential configuration. |
| ADMIN_EMAIL / ADMIN_PASSWORD | seedAdmin operational inputs | Blank. Seed script is not a test and is not authorized. |
| ALLOCATION_ENABLED | Literal false required by sandbox recovery/report services | Always false. Does not supersede the separate hardcoded false allocation switch. |
| HNC_FRAUD_REPORT_SANDBOX_ENABLED | Requires test environment, named sandbox, restricted permissions | False; experimental endpoint stays unregistered. |
| HNC_EXPORT_FRAUD_CONTRACT | Optional synthetic fixture export in sandbox script | False; do not regenerate fixtures via database access during offline work. |
| HNC_TEST_SHOT_COMPENSATION | Non-production client timestamp compensation experiment | False. Never activate to make tests pass. |
| HNC_SHADOW_SCORING | Non-production observational scoring experiment | False; no runtime activation. |

Other settings are **constants, not implemented environment variables**: OTP expiry ten minutes, bcrypt rounds ten, OTP limiter five requests per ten minutes, login limiter ten per fifteen minutes, Express body limit 1 MiB, recovery limits and session TTL/attempt counts in gameConfig. Do not imply unsupported `.env` knobs exist.

Startup checks currently include required JWT presence and lazy DB URI presence, not a unified safe runtime-configuration validator. Import-time SMTP verification has been removed and covered with synthetic tests. A future batch should validate names/types/origins without printing values and further review transporter initialization before any approved runtime. Do not claim examples implement runtime gates.

Do not set `NODE_OPTIONS` or use dotenv preloads in offline unit runs. The unit runner launches children with an empty inherited environment; isolated VM services receive only explicitly synthetic settings. No environment secrets or credentials are required.

Phase C adds no environment variables. OTP policy constants now live in authentication/services/authPolicy.js: ten-minute expiry/send window, one-minute cooldown, five sends/window and five verification attempts/challenge. Existing IP limits remain unchanged. User metadata defaults/rollout are documented in AUTH_SCHEMA_ROLLOUT.md; never run a backfill or start services to validate them.
