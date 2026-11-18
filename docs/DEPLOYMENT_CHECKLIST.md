# Future deployment/activation checklist — no authorization granted

This document does not deploy or change infrastructure. The active preview stays offline; authenticated application activation, live reporting, notifications, DB connectivity and prize issuance each require explicit owner decisions.

- Reconcile all required modules against PROJECT_STATUS; close or accept documented security/product gaps.
- Repeat approved tests/build and preserve reproducible evidence. Verify API compatibility in an approved isolated HTTP environment.
- Review account revocation, OTP rate-limit topology, JWT/session-key entropy/rotation, safe logs and SMTP initialization before runtime approval.
- Review CORS/public origins, reverse-proxy trust, HTTPS, body limits, dependency advisories and environment validation without exposing values.
- Verify named-sandbox permissions, actual indexes, migrations/rollback, transactions/concurrency and synthetic cleanup under separate approval; no production DB testing.
- Obtain representative isolated load results; do not assume campaign capacity from unit tests or latency math.
- Keep `ALLOCATION_ENABLED = false` hardcoded. Any future request to change it requires separate activation/security/concurrency/inventory/reconciliation sign-off; no current batch may do so.
- No private allocation loader, seed/reset/backfill/index utility or notification send is a deployment smoke test.
- Keep the experimental fraud-report endpoint unregistered and no live dashboard transport until separately approved.
- Deployment artifacts omit secrets, tests/fixtures where unnecessary, operational tools and backend modules from the frontend bundle. Static inspection alone does not prove live behavior.

Development completion, owner acceptance, deployment approval and prize launch approval are separate milestones.
