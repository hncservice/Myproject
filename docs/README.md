# HNC developer handover

Start with PROJECT_STATUS.md and IMPLEMENTATION_PLAN.md. The product is not development-complete or approved for launch. Current active application is the offline mock fraud dashboard; authenticated routes exist but remain unmounted.

- ARCHITECTURE.md: ownership and active/unmounted dependency diagrams.
- FRONTEND_MODULES.md / BACKEND_MODULES.md: feature responsibilities, legacy overlap and integration limits.
- MODULE_INVENTORY.md / .json: all current client/server modules and static references.
- API_REFERENCE.md: existing declared backend routes; not an executed API test.
- DATABASE_SCHEMA.md: declared models/refs/indexes, not deployed DB inspection.
- AUTHENTICATION_PERMISSIONS.md: existing auth boundaries and gaps.
- CUSTOMER_AUTHENTICATION.md: Phase C module inventory, journey/security evidence, auth additions and remaining gaps.
- AUTH_SCHEMA_ROLLOUT.md: source-only additive metadata, legacy JWT compatibility and rollout/rollback precautions; no migration executed.
- FRAUD_PRIZE_LIFECYCLE.md: independent assessments, decisions, recovery and disabled draws.
- TESTING.md: safe commands, actual evidence and execution exclusions.
- PERFORMANCE_TESTING.md: bounded offline work and separately authorized load-test plan.
- SECURITY_REVIEW.md: source protections, confirmed repairs and unresolved risks.
- BATCH_LOG.md: exact changed files, backups, executed results and evidence paths.
- CHANGE_MANIFEST.json: hashes for changed/new source, examples, tools and docs; historical checkpoint/backup integrity results. Regenerate with `node tools/finalize-offline-report.cjs` after intentional changes.
- ENVIRONMENT_SETUP.md: source-derived variable names and manual placeholders (added in setup batch).

Use local checkpoints for recovery, not Git commands. Do not open actual environment secrets, start services, run operational scripts or copy production customer data. User will manage Git/GitHub independently.
