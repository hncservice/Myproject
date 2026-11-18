# Recovery and rollback

Local backups are outside active source. Step 15R.23P contains source/config/package structure with integrity hashes; Step 15R.23R contains isolated-script evidence; master-plan-batch-001 backs up the two initial repair targets before modification. Never restore secret files from another environment or overwrite production records.

Before rollback: stop development writes, identify the exact batch and changed paths, verify checkpoint SHA256SUMS/manifest and review expected API/model differences. Restore to a separate local review folder first; compare targeted source changes before replacing active files. No automated restore, recursive deletion, database rollback or Git action is performed by these instructions.

After a reviewed source rollback: rerun static import/syntax checks, focused tests, complete frontend regression and build. Preserve the new tests where they document still-valid contracts; a rollback must not quietly remove security assertions. Leave hardcoded allocation false, experimental report route unregistered and preview mock default unchanged.

Database rollback is a separate plan: declared indexes may differ from deployed indexes; evidence/award/redemption history must not be reset. Any migration requires reviewed forward/backward compatibility, ownership, uniqueness/conflict resolution, dry-run evidence and explicit sandbox execution approval. Never inspect production `test` for rehearsal.

For Phase C, retain tokenVersion/counter metadata and consult AUTH_SCHEMA_ROLLOUT.md. Restoring older authentication code that ignores revocations can reactivate still-live JWTs. No version decrement, user reset, backfill or runtime rollback was executed; use the Phase C local backup only for source review.
