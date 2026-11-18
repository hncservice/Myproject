# Frontend Phase 1 migration report

All paths below are relative to client/src. Only import specifiers were changed in source files. Backups, assets, checkpoints, backend files, environment files, API configuration and navigation behavior were preserved.

## Every moved file

| Old path | New path |
|---|---|
| `App.jsx` | `app/App.jsx` |
| `App.css` | `app/App.css` |
| `routes/AppRoutes.jsx` | `app/routes/AppRoutes.jsx` |
| `components/Layout.jsx` | `app/layout/Layout.jsx` |
| `styles/layout.css` | `app/layout/layout.css` |
| `context/AuthContext.jsx` | `features/authentication/context/AuthContext.jsx` |
| `api/authApi.js` | `features/authentication/api/authApi.js` |
| `pages/user/RegisterPage.jsx` | `features/authentication/pages/RegisterPage.jsx` |
| `pages/user/VerifyOtpPage.jsx` | `features/authentication/pages/VerifyOtpPage.jsx` |
| `pages/user/UserLoginPage.jsx` | `features/authentication/pages/UserLoginPage.jsx` |
| `pages/vendor/VendorLoginPage.jsx` | `features/authentication/pages/VendorLoginPage.jsx` |
| `pages/admin/AdminLoginPage.jsx` | `features/authentication/pages/AdminLoginPage.jsx` |
| `styles/RegisterPage.css` | `features/authentication/styles/RegisterPage.css` |
| `styles/userLogin.css` | `features/authentication/styles/userLogin.css` |
| `pages/user/UserHomePage.jsx` | `features/games/pages/UserHomePage.jsx` |
| `pages/user/MonkeyGamePage.jsx` | `features/games/monkey/MonkeyGamePage.jsx` |
| `pages/user/PerfectShotGame.jsx` | `features/games/perfect-shot/PerfectShotGame.jsx` |
| `pages/user/SpinPage.jsx` | `features/games/spin/SpinPage.jsx` |
| `pages/user/SpinPage.css` | `features/games/spin/SpinPage.css` |
| `components/SpinWheel.jsx` | `features/games/spin/SpinWheel.jsx` |
| `components/SpinWheel.css` | `features/games/spin/SpinWheel.css` |
| `components/NewYearPopup.jsx` | `features/games/components/NewYearPopup.jsx` |
| `components/BackToschool.jsx` | `features/games/components/BackToschool.jsx` |
| `api/gameApi.js` | `features/games/api/gameApi.js` |
| `api/spinApi.js` | `features/games/api/spinApi.js` |
| `components/FraudDashboardPreview.jsx` | `features/fraud-monitoring/preview/FraudDashboardPreview.jsx` |
| `components/admin/FraudMonitoringDashboard.details.test.jsx` | `features/fraud-monitoring/components/FraudMonitoringDashboard.details.test.jsx` |
| `components/admin/FraudMonitoringDashboard.jsx` | `features/fraud-monitoring/components/FraudMonitoringDashboard.jsx` |
| `components/admin/FraudMonitoringDashboard.network.test.jsx` | `features/fraud-monitoring/components/FraudMonitoringDashboard.network.test.jsx` |
| `components/admin/FraudMonitoringDashboard.test.jsx` | `features/fraud-monitoring/components/FraudMonitoringDashboard.test.jsx` |
| `api/fixtures/fraudReportBackend.contract.json` | `features/fraud-monitoring/data/fixtures/fraudReportBackend.contract.json` |
| `api/fraudDashboardDataProvider.js` | `features/fraud-monitoring/data/fraudDashboardDataProvider.js` |
| `api/fraudDashboardDataProvider.test.js` | `features/fraud-monitoring/data/fraudDashboardDataProvider.test.js` |
| `api/fraudDashboardFilters.js` | `features/fraud-monitoring/data/fraudDashboardFilters.js` |
| `api/fraudDashboardFilters.test.js` | `features/fraud-monitoring/data/fraudDashboardFilters.test.js` |
| `api/fraudDashboardOfflineIntegration.test.js` | `features/fraud-monitoring/data/fraudDashboardOfflineIntegration.test.js` |
| `api/fraudDashboardPresentationAdapter.js` | `features/fraud-monitoring/data/fraudDashboardPresentationAdapter.js` |
| `api/fraudDashboardPresentationAdapter.test.js` | `features/fraud-monitoring/data/fraudDashboardPresentationAdapter.test.js` |
| `api/fraudDashboardViewModel.js` | `features/fraud-monitoring/data/fraudDashboardViewModel.js` |
| `api/fraudDashboardViewModel.test.js` | `features/fraud-monitoring/data/fraudDashboardViewModel.test.js` |
| `api/fraudReportActualBackend.test.js` | `features/fraud-monitoring/data/fraudReportActualBackend.test.js` |
| `api/fraudReportActualContract.test.js` | `features/fraud-monitoring/data/fraudReportActualContract.test.js` |
| `api/fraudReportApi.js` | `features/fraud-monitoring/data/fraudReportApi.js` |
| `api/fraudReportApi.test.js` | `features/fraud-monitoring/data/fraudReportApi.test.js` |
| `api/fraudReportCancellation.test.js` | `features/fraud-monitoring/data/fraudReportCancellation.test.js` |
| `api/fraudReportContract.test.js` | `features/fraud-monitoring/data/fraudReportContract.test.js` |
| `api/fraudReportErrorIsolation.test.js` | `features/fraud-monitoring/data/fraudReportErrorIsolation.test.js` |
| `api/fraudReportFallbackPolicy.test.js` | `features/fraud-monitoring/data/fraudReportFallbackPolicy.test.js` |
| `api/fraudReportHardening.test.js` | `features/fraud-monitoring/data/fraudReportHardening.test.js` |
| `api/fraudReportIntegration.test.js` | `features/fraud-monitoring/data/fraudReportIntegration.test.js` |
| `api/fraudReportSandboxAdapter.js` | `features/fraud-monitoring/data/fraudReportSandboxAdapter.js` |
| `api/fraudReportSandboxAdapter.test.js` | `features/fraud-monitoring/data/fraudReportSandboxAdapter.test.js` |
| `api/fraudReportSandboxTransport.js` | `features/fraud-monitoring/data/fraudReportSandboxTransport.js` |
| `api/fraudReportSandboxTransport.test.js` | `features/fraud-monitoring/data/fraudReportSandboxTransport.test.js` |
| `api/fraudReportStreaming.test.js` | `features/fraud-monitoring/data/fraudReportStreaming.test.js` |
| `api/fraudReportValidator.js` | `features/fraud-monitoring/data/fraudReportValidator.js` |
| `api/fraudReportValidator.test.js` | `features/fraud-monitoring/data/fraudReportValidator.test.js` |
| `pages/vendor/VendorScanPage.jsx` | `features/vendors/pages/VendorScanPage.jsx` |
| `api/vendorApi.js` | `features/vendors/api/vendorApi.js` |
| `pages/admin/AdminWheelItemsPage.jsx` | `features/prizes/pages/AdminWheelItemsPage.jsx` |
| `pages/admin/AdminUsersPage.jsx` | `features/administration/pages/AdminUsersPage.jsx` |
| `pages/admin/AdminVendorsPage.jsx` | `features/administration/pages/AdminVendorsPage.jsx` |
| `pages/admin/AdminReportPage.jsx` | `features/administration/pages/AdminReportPage.jsx` |
| `api/adminApi.js` | `features/administration/api/adminApi.js` |
| `api/axiosInstance.js` | `shared/api/axiosInstance.js` |

## Every updated import

Includes import paths inside existing commented code; comments remain comments. Line numbers refer to the destination file.

| File:line | Old import | New import |
|---|---|---|
| `features/administration/api/adminApi.js:2` | `./axiosInstance` | `../../../shared/api/axiosInstance` |
| `features/authentication/api/authApi.js:2` | `./axiosInstance` | `../../../shared/api/axiosInstance` |
| `features/games/api/gameApi.js:3` | `./axiosInstance` | `../../../shared/api/axiosInstance` |
| `features/games/api/spinApi.js:2` | `./axiosInstance` | `../../../shared/api/axiosInstance` |
| `features/vendors/api/vendorApi.js:2` | `./axiosInstance` | `../../../shared/api/axiosInstance` |
| `app/App.jsx:3` | `./components/Layout` | `./layout/Layout` |
| `app/App.jsx:15` | `./components/FraudDashboardPreview` | `../features/fraud-monitoring/preview/FraudDashboardPreview` |
| `features/fraud-monitoring/preview/FraudDashboardPreview.jsx:1` | `./admin/FraudMonitoringDashboard` | `../components/FraudMonitoringDashboard` |
| `app/layout/Layout.jsx:5` | `../context/AuthContext` | `../../features/authentication/context/AuthContext` |
| `app/layout/Layout.jsx:6` | `../assets/logos.png` | `../../assets/logos.png` |
| `app/layout/Layout.jsx:8` | `../styles/layout.css` | `./layout.css` |
| `main.jsx:6` | `./App.jsx` | `./app/App.jsx` |
| `main.jsx:7` | `./context/AuthContext` | `./features/authentication/context/AuthContext` |
| `features/authentication/pages/AdminLoginPage.jsx:4` | `../../api/authApi` | `../api/authApi` |
| `features/authentication/pages/AdminLoginPage.jsx:5` | `../../context/AuthContext` | `../context/AuthContext` |
| `features/administration/pages/AdminReportPage.jsx:3` | `../../api/adminApi` | `../api/adminApi` |
| `features/administration/pages/AdminUsersPage.jsx:7` | `../../api/adminApi` | `../api/adminApi` |
| `features/administration/pages/AdminVendorsPage.jsx:3` | `../../api/adminApi` | `../api/adminApi` |
| `features/prizes/pages/AdminWheelItemsPage.jsx:8` | `../../api/adminApi` | `../../administration/api/adminApi` |
| `features/games/monkey/MonkeyGamePage.jsx:26` | `../../context/AuthContext` | `../../authentication/context/AuthContext` |
| `features/games/monkey/MonkeyGamePage.jsx:34` | `../../api/gameApi` | `../api/gameApi` |
| `features/games/monkey/MonkeyGamePage.jsx:36` | `../../components/NewYearPopup` | `../components/NewYearPopup` |
| `features/games/monkey/MonkeyGamePage.jsx:38` | `../../assets/sounds/monkey-hit.mp3` | `../../../assets/sounds/monkey-hit.mp3` |
| `features/games/monkey/MonkeyGamePage.jsx:39` | `../../assets/sounds/monkey-miss.mp3` | `../../../assets/sounds/monkey-miss.mp3` |
| `features/games/monkey/MonkeyGamePage.jsx:40` | `../../assets/sounds/game-start.mp3` | `../../../assets/sounds/game-start.mp3` |
| `features/games/monkey/MonkeyGamePage.jsx:41` | `../../assets/sounds/game-win.mp3` | `../../../assets/sounds/game-win.mp3` |
| `features/games/monkey/MonkeyGamePage.jsx:42` | `../../assets/sounds/game-lose.mp3` | `../../../assets/sounds/game-lose.mp3` |
| `features/games/monkey/MonkeyGamePage.jsx:43` | `../../assets/sounds/game-bg-loop.mp3` | `../../../assets/sounds/game-bg-loop.mp3` |
| `features/games/perfect-shot/PerfectShotGame.jsx:2` | `../../context/AuthContext` | `../../authentication/context/AuthContext` |
| `features/games/perfect-shot/PerfectShotGame.jsx:3` | `../../api/axiosInstance` | `../../../shared/api/axiosInstance` |
| `features/authentication/pages/RegisterPage.jsx:15` | `../../api/authApi` | `../api/authApi` |
| `features/authentication/pages/RegisterPage.jsx:16` | `../../assets/logos.png` | `../../../assets/logos.png` |
| `features/authentication/pages/RegisterPage.jsx:17` | `../../styles/RegisterPage.css` | `../styles/RegisterPage.css` |
| `features/games/spin/SpinPage.jsx:28` | `../../context/AuthContext` | `../../authentication/context/AuthContext` |
| `features/games/spin/SpinPage.jsx:29` | `../../api/spinApi` | `../api/spinApi` |
| `features/games/spin/SpinPage.jsx:30` | `../../components/SpinWheel` | `./SpinWheel` |
| `features/games/pages/UserHomePage.jsx:3` | `../../assets/logos.png` | `../../../assets/logos.png` |
| `features/games/pages/UserHomePage.jsx:4` | `../../api/spinApi` | `../api/spinApi` |
| `features/games/pages/UserHomePage.jsx:5` | `../../context/AuthContext` | `../../authentication/context/AuthContext` |
| `features/authentication/pages/UserLoginPage.jsx:4` | `../../api/authApi` | `../api/authApi` |
| `features/authentication/pages/UserLoginPage.jsx:5` | `../../assets/logos.png` | `../../../assets/logos.png` |
| `features/authentication/pages/UserLoginPage.jsx:6` | `../../styles/userLogin.css` | `../styles/userLogin.css` |
| `features/authentication/pages/VerifyOtpPage.jsx:4` | `../../api/authApi` | `../api/authApi` |
| `features/authentication/pages/VerifyOtpPage.jsx:5` | `../../context/AuthContext` | `../context/AuthContext` |
| `features/authentication/pages/VendorLoginPage.jsx:4` | `../../api/authApi` | `../api/authApi` |
| `features/authentication/pages/VendorLoginPage.jsx:5` | `../../context/AuthContext` | `../context/AuthContext` |
| `features/authentication/pages/VendorLoginPage.jsx:7` | `../../assets/logos.png` | `../../../assets/logos.png` |
| `features/vendors/pages/VendorScanPage.jsx:3` | `../../context/AuthContext` | `../../authentication/context/AuthContext` |
| `features/vendors/pages/VendorScanPage.jsx:8` | `../../api/vendorApi` | `../api/vendorApi` |
| `app/routes/AppRoutes.jsx:4` | `../context/AuthContext` | `../../features/authentication/context/AuthContext` |
| `app/routes/AppRoutes.jsx:6` | `../pages/user/RegisterPage` | `../../features/authentication/pages/RegisterPage` |
| `app/routes/AppRoutes.jsx:7` | `../pages/user/VerifyOtpPage` | `../../features/authentication/pages/VerifyOtpPage` |
| `app/routes/AppRoutes.jsx:8` | `../pages/user/SpinPage` | `../../features/games/spin/SpinPage` |
| `app/routes/AppRoutes.jsx:9` | `../pages/user/MonkeyGamePage` | `../../features/games/monkey/MonkeyGamePage` |
| `app/routes/AppRoutes.jsx:10` | `../pages/user/PerfectShotGame` | `../../features/games/perfect-shot/PerfectShotGame` |
| `app/routes/AppRoutes.jsx:12` | `../pages/vendor/VendorLoginPage` | `../../features/authentication/pages/VendorLoginPage` |
| `app/routes/AppRoutes.jsx:13` | `../pages/vendor/VendorScanPage` | `../../features/vendors/pages/VendorScanPage` |
| `app/routes/AppRoutes.jsx:15` | `../pages/admin/AdminLoginPage` | `../../features/authentication/pages/AdminLoginPage` |
| `app/routes/AppRoutes.jsx:16` | `../pages/admin/AdminVendorsPage` | `../../features/administration/pages/AdminVendorsPage` |
| `app/routes/AppRoutes.jsx:17` | `../pages/admin/AdminWheelItemsPage` | `../../features/prizes/pages/AdminWheelItemsPage` |
| `app/routes/AppRoutes.jsx:18` | `../pages/admin/AdminReportPage` | `../../features/administration/pages/AdminReportPage` |
| `app/routes/AppRoutes.jsx:19` | `../pages/admin/AdminUsersPage` | `../../features/administration/pages/AdminUsersPage` |
| `app/routes/AppRoutes.jsx:21` | `../pages/user/UserLoginPage` | `../../features/authentication/pages/UserLoginPage` |
| `app/routes/AppRoutes.jsx:22` | `../pages/user/UserHomePage` | `../../features/games/pages/UserHomePage` |

## Validation

- Static checks: 100 relative import references resolved; 21 existing test files found; no failures.
- Confirmed App still renders FraudDashboardPreview and has no active AppRoutes import.
- Confirmed the mock dashboard has no fetch, Axios, or sandbox transport reference.
- Existing backend contract fixture remains at server/scripts/fixtures/fraudReportBackend.contract.json; its frontend test path was preserved.
- Tests: npx vitest run src/features/fraud-monitoring/data src/features/fraud-monitoring/components --environment jsdom — 21/21 files and 174/174 tests passed.
- Build: npm run build — passed (44 modules transformed). Vite regenerated client/dist as normal build output.
- Failures: none. Vitest printed an informational environment-performance suggestion; no test or build warnings required changes.
- Backend migration was not started. No Git commands, MongoDB connections, secret edits, endpoint registration, or prize-allocation changes were performed.
- All 65 moves and 64 changed import specifiers are listed above. Existing backups and checkpoint trees remain in place. The frontend fixture moved with its tests; no fixtures were discarded.
- No package, lockfile, Vite, API-base-URL, navigation, or deployment configuration changes were needed.
