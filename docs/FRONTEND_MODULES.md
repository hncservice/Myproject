# Frontend module guide

React/Vite owns presentation and API interaction; it never authorizes gameplay scores or awards. MODULE_INVENTORY.md lists every file and import; this guide describes responsibility and evidence.

| Folder | Responsibility | Current boundary |
|---|---|---|
| src/app | App composition, Layout, routes, future AuthenticatedApp | Main renders the offline preview. AuthenticatedApp remains unmounted and requires a caller-supplied router. |
| features/authentication | Registration/password-to-OTP, resend/recovery feedback, role login, safe local/remote logout and AuthContext | Inactive from preview; storage keys preserved with error-safe handling. Phase C adds journey/context/API tests; original OTP cases remain. |
| features/games | Monkey, Perfect Shot, spin and game/status/history pages, shared game APIs | Server results are authoritative. Broader gameplay UI/reconnect/error tests remain required. Historical alternative components are not activated. |
| features/fraud-monitoring/components | Dashboard mode selector, mock container, shared renderer and behavior/mode tests | Four original sessions remain default. Mock unrestricted search and selection restoration are deliberate. |
| features/fraud-monitoring/data | Strict report contract, provider, adapter, pure filters/KPIs, view model, controller, synthetic fixture | Disabled by default; complete proposed state validated before commit. Integrity V2 and Behavioral Signals V1 remain independent. |
| features/fraud-monitoring/integration | Offline lifecycle hook and isolated integration preview | Fresh report identity/enable changes reset safely; failed updates preserve valid state. Integration preview remains unmounted. |
| features/fraud-monitoring/preview | Active mock preview composition | Imports the dashboard with default props; no transport or auth provider. |
| features/prizes | Existing inventory administration UI/API | No allocation activation; customer prize/redeem workflow is not complete merely because files exist. |
| features/vendors | Scan and vendor-facing interfaces/APIs | Real scans can mutate redemption/send notifications on backend; tests must mock these calls. |
| features/administration | Customer/vendor/report management and APIs | Campaign/game-settings/audit/prize-review product interfaces remain incomplete. |
| shared/api | Existing Axios configuration | Not reachable from active preview. Base URL unchanged; port-default mismatch is documented in ENVIRONMENT_SETUP.md. |
| assets / styles | Existing presentation resources | Active preview styling and build/deployment configuration unchanged. |

The default build can contain the offline validation/controller implementation because the dashboard supports explicit offline modes. That does not imply a live report connection. Static inspection found no backend-contract fixture IDs, sandbox transport marker or storage-backed authentication code in the current production JavaScript. Third-party dependency behavior is covered separately by preview isolation tests, not inferred solely from string absence.

Use TESTING.md for focused/full commands. Route guards are navigation aids; backend authorization remains mandatory. Phase C protects the existing game/user-home routes, while public authentication pages remain public. The entire authenticated composition is still unmounted from the preview.

Phase C wraps Monkey/Perfect Shot in customer ProtectedRoute without changing paths or mounting authenticated routing. UserHome offers GameSelectionPanel using only the existing eligibility GET; refresh never starts a session. Registration/login carries a whitelisted user-home destination through OTP; the older OTP fallback remains compatible. CUSTOMER_AUTHENTICATION.md supersedes earlier auth gap notes.
