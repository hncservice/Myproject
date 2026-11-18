# Existing API reference — source inventory

Routes are recorded statically and are not HTTP-tested. No server was started. All /api business routers pass through lazy database middleware; root and /api/health precede it. Handler names identify implementation ownership, not proof of authorization correctness.

## server/features/administration/routes/adminRoutes.js

| Method | Existing path | Handlers | Source line |
|---|---|---|---:|
| USE | router-wide middleware | authAdmin | 43 |
| POST | /api/admin/vendors | createVendor | 49 |
| GET | /api/admin/vendors | listVendors | 50 |
| PUT | /api/admin/vendors/:id | updateVendor | 51 |
| GET | /api/admin/users | listUsers | 57 |
| GET | /api/admin/users/:id | getUser | 58 |
| POST | /api/admin/users | createUser | 59 |
| PUT | /api/admin/users/:id | updateUser | 60 |
| DELETE | /api/admin/users/:id | deleteUser | 61 |
| POST | /api/admin/wheel-items | createWheelItem | 67 |
| GET | /api/admin/wheel-items | listWheelItems | 68 |
| PUT | /api/admin/wheel-items/:id | updateWheelItem | 69 |
| DELETE | /api/admin/wheel-items/:id | deleteWheelItem | 70 |
| GET | /api/admin/prize-reviews | listPrizeReviews | 77 |
| GET | /api/admin/prize-reviews/:id | getPrizeReview | 78 |
| POST | /api/admin/prize-reviews/:id/approve | approvePrizeReview | 82 |
| POST | /api/admin/prize-reviews/:id/reject | rejectPrizeReview | 87 |
| GET | /api/admin/reports/export | exportReport | 96 |
| GET | /api/admin/report/stats | getReportStats | 97 |
| GET | /api/admin/configuration | operations.configuration | 101 |
| GET | /api/admin/sessions | operations.sessions | 102 |
| GET | /api/admin/redemptions | operations.redemptions | 103 |
| GET | /api/admin/audit-logs | operations.audit | 104 |
| GET | /api/admin/campaigns | campaigns.list | 108 |
| POST | /api/admin/campaigns | campaigns.create | 109 |
| PUT | /api/admin/campaigns/:campaignId | campaigns.update | 110 |
| GET | /api/admin/campaigns/:campaignId/activity | campaigns.activity | 111 |
## server/features/authentication/routes/authRoutes.js

| Method | Existing path | Handlers | Source line |
|---|---|---|---:|
| POST | /api/auth/register | otpLimiter, registerUser | 14 |
| POST | /api/auth/verify-otp | otpLimiter, verifyUserOtp | 15 |
| POST | /api/auth/vendor/login | loginLimiter, loginVendor | 16 |
| POST | /api/auth/admin/login | loginLimiter, loginAdmin | 17 |
| POST | /api/auth/user/login | loginLimiter, loginUser | 18 |
| POST | /api/auth/resend-otp | otpLimiter, resendUserOtp | 19 |
| POST | /api/auth/logout | loginLimiter, require('../controllers/sessionController').logout | 20 |
## server/features/games/routes/gameRoutes.js

| Method | Existing path | Handlers | Source line |
|---|---|---|---:|
| USE | router-wide middleware | authUser | 28 |
| POST | /api/games/prize-decision | prizeDecision.create | 39 |
| GET | /api/games/status | game.getStatus | 48 |
| POST | /api/games/:gameId/start | game.start | 50 |
| GET | /api/games/:gameId/session | game.getSession | 52 |
| GET | /api/games/:gameId/history | game.getHistory | 54 |
| POST | /api/games/:gameId/complete | game.complete | 56 |
| POST | /api/games/monkey/next | monkey.nextRound | 62 |
| POST | /api/games/monkey/hit | monkey.hit | 64 |
| POST | /api/games/perfect-shot/next | perfectShot.nextShot | 70 |
| POST | /api/games/perfect-shot/shoot | perfectShot.shoot | 72 |
## server/features/games/routes/spinRoutes.js

| Method | Existing path | Handlers | Source line |
|---|---|---|---:|
| GET | /api/spin/__ping | (req, res) => { res.json({ ok: true, router: 'spinRoutes', time: new Date().toISOString() }); } | 8 |
| GET | /api/spin/wheel | spinController.getWheelConfig | 12 |
| POST | /api/spin/spin | authUser, spinController.spinOnce | 13 |
| GET | /api/spin/monkey-status | authUser, spinController.getMonkeyStatus | 15 |
| POST | /api/spin/monkey-attempt | authUser, spinController.monkeyAttempt | 16 |
| POST | /api/spin/monkey-complete | authUser, spinController.monkeyComplete | 17 |
| GET | /api/spin/my-latest-win | authUser, spinController.getMyLatestWin | 18 |
## server/features/vendors/routes/vendorRoutes.js

| Method | Existing path | Handlers | Source line |
|---|---|---|---:|
| POST | /api/vendor/scan | authVendor, scanQr | 18 |
| GET | /api/vendor/dashboard | authVendor, getVendorDashboard | 20 |
| GET | /api/vendor/reports/export | authVendor, exportVendorRedemptions | 26 |

The experimental fraud-report controller exists in source but is intentionally unregistered. Spin and legacy Monkey mutation endpoints remain disabled. Game completion creates preliminary decisions only. Do not infer prize allocation from a decision status.
