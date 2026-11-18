'use strict';
// Static verification only: --check parses files; it does not load application modules.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/MODULE_INVENTORY.json'), 'utf8'));
const modules = new Map(inventory.modules.map(item => [item.file, item]));
const errors = [];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
for (const item of inventory.modules) {
  if (hash(item.file) !== item.sha256) errors.push('Inventory is stale: ' + item.file);
  if (item.parseError) errors.push('Parse error: ' + item.file);
}
const backend = inventory.modules.filter(item => item.file.startsWith('server/') && /\.(?:js|cjs|mjs)$/.test(item.file));
for (const item of backend) {
  const run = spawnSync(process.execPath, ['--check', path.join(root, item.file)], {
    env: {}, windowsHide: true, encoding: 'utf8', timeout: 10000,
  });
  if (run.status !== 0) errors.push({ file: item.file, syntaxExit: run.status, error: run.stderr });
}
const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dep of modules.get(file)?.imports || []) if (dep.target) visit(dep.target);
}
visit('client/src/main.jsx');
const suspicious = /\b(?:localStorage|sessionStorage|indexedDB|XMLHttpRequest|axios|mongoose|nodemailer)\b|\bfetch\s*\(|\.sendMail\s*\(/;
const previewConcerns = [];
for (const file of reachable) {
  if (!/\.(?:js|jsx)$/.test(file)) continue;
  if (/\/authentication\/|\/api\//.test(file) || suspicious.test(fs.readFileSync(path.join(root, file), 'utf8'))) previewConcerns.push(file);
}
if (previewConcerns.length) errors.push({ previewConcerns });
const unresolvedActive = inventory.unresolved.filter(item => !/App\.backup\.jsx|security-checkpoints\//.test(item.file));
if (unresolvedActive.length) errors.push({ unresolvedActive });
const server = modules.get('server/server.js');
const mounts = server.routes.filter(route => route.call === 'app.use' && /^\/api\//.test(route.path || ''));
const expectedMounts = ['/api/auth', '/api/spin', '/api/vendor', '/api/admin', '/api/games'];
if (JSON.stringify(mounts.map(route => route.path)) !== JSON.stringify(expectedMounts)) errors.push('Unexpected API mount order');
const invariantPaths = ['server/server.js', ...inventory.modules.filter(item => item.file.startsWith('server/') && /\/routes\/.*\.js$/.test(item.file)).map(item => item.file),
  'client/src/main.jsx', 'client/src/app/App.jsx', 'client/src/app/routes/AppRoutes.jsx', 'client/src/features/fraud-monitoring/components/FraudMonitoringDashboard.jsx',
  'client/src/shared/api/axiosInstance.js', 'client/vite.config.js', 'client/vercel.json', 'server/vercel.json',
  'client/package.json', 'client/package-lock.json', 'server/package.json', 'server/package-lock.json',
  'server/features/prizes/services/prizeAllocationService.js'];
const invariants = invariantPaths.filter(file => modules.has(file)).map(file => ({ file, state: inventory.checkpointComparison.find(item => item.file === file)?.state || 'not in checkpoint' }));
const reviewedAuthChanges = new Map([
  ['client/src/app/routes/AppRoutes.jsx', '36c1a06383cc8d29a39ddfcfb5896539804feb2f61ff9f869ba768feb7150289'],
  ['server/features/administration/routes/adminRoutes.js', '1dd2a37c9d826caf1290893e0cda624d334a5b018ccab4458f94593766f91712'],
  ['server/features/authentication/routes/authRoutes.js', 'efb054f9e4df03cc9382126dbdb61f0a3ec201a585fb3467bebf264c533bdafc'],
]);
for (const item of invariants) {
  item.reviewedAuthChange = reviewedAuthChanges.has(item.file) && hash(item.file) === reviewedAuthChanges.get(item.file);
  if (item.state !== 'unchanged' && !item.reviewedAuthChange) errors.push({ invariantChanged: item });
}
const authRoutes = modules.get('server/features/authentication/routes/authRoutes.js').routes.filter(route => route.call === 'router.post');
const expectedAuth = [['/register', ['otpLimiter', 'registerUser']], ['/verify-otp', ['otpLimiter', 'verifyUserOtp']], ['/vendor/login', ['loginLimiter', 'loginVendor']], ['/admin/login', ['loginLimiter', 'loginAdmin']], ['/user/login', ['loginLimiter', 'loginUser']], ['/resend-otp', ['otpLimiter', 'resendUserOtp']], ['/logout', ['loginLimiter', "require('../controllers/sessionController').logout"]]];
if (JSON.stringify(authRoutes.map(route => [route.path, route.handlers])) !== JSON.stringify(expectedAuth)) errors.push('Authentication route contract/order differs from review');
const routeSource = fs.readFileSync(path.join(root, 'client/src/app/routes/AppRoutes.jsx'), 'utf8');
const oldRouteSource = fs.readFileSync(path.join(root, 'local-checkpoints/Step15R.23P-2026-10-28T10-03-23-580Z/snapshot/client/src/app/routes/AppRoutes.jsx'), 'utf8');
const paths = source => [...source.matchAll(/\bpath="([^"]+)"/g)].map(match => match[1]);
const addedAdminPaths = ['/admin/operations', '/admin/prize-reviews', '/admin/campaigns'];
if (JSON.stringify(paths(routeSource).filter(p => !addedAdminPaths.includes(p))) !== JSON.stringify(paths(oldRouteSource)) || addedAdminPaths.some(p => paths(routeSource).filter(v => v === p).length !== 1)) errors.push('Frontend route paths differ from reviewed original plus three protected inactive admin views');
const adminRouteSource = fs.readFileSync(path.join(root, 'server/features/administration/routes/adminRoutes.js'), 'utf8');
const oldAdminRoutes = fs.readFileSync(path.join(root, 'local-checkpoints/Step15R.23P-2026-10-28T10-03-23-580Z/snapshot/server/features/administration/routes/adminRoutes.js'), 'utf8');
const normalized = text => text.replace(/\r\n/g, '\n').trim();
if (normalized(adminRouteSource.split('// Read-only operations;')[0]) !== normalized(oldAdminRoutes.replace(/module\.exports = router;\s*$/, ''))) errors.push('Original administrator route declarations or global middleware changed');
const allocationDisabled = /const ALLOCATION_ENABLED = false;/.test(fs.readFileSync(path.join(root, 'server/features/prizes/services/prizeAllocationService.js'), 'utf8'));
if (!allocationDisabled) errors.push('Hardcoded allocation switch changed');
const campaignParticipationDisabled = /const CAMPAIGN_PARTICIPATION_ENABLED = false;/.test(fs.readFileSync(path.join(root, 'server/features/campaigns/services/campaignPolicy.js'), 'utf8'));
if (!campaignParticipationDisabled) errors.push('Campaign participation gate changed');
for (const file of ['server/features/games/services/gameStartService.js','server/features/games/services/gameStatusService.js','server/features/games/engine/sharedGameEngine.js']) {
  if (modules.get(file)?.imports.some(dep => dep.target?.includes('/campaigns/'))) errors.push('Campaign definitions unexpectedly connected to existing gameplay: ' + file);
}
const bundles = fs.readdirSync(path.join(root, 'client/dist/assets')).filter(name => name.endsWith('.js'));
const bundleMarkers = [];
const syntheticFixture = JSON.parse(fs.readFileSync(path.join(root, 'client/src/features/fraud-monitoring/data/fixtures/fraudReportBackend.contract.json'), 'utf8'));
const fixtureMarkers = syntheticFixture.reports.map(report => report.sessionId);
for (const name of bundles) {
  const code = fs.readFileSync(path.join(root, 'client/dist/assets', name), 'utf8');
  for (const marker of ['localStorage', 'AuthProvider', 'fraudReportBackend.contract', 'fraudReportSandboxTransport', 'nodemailer', 'MONGO_URI']) {
    if (code.includes(marker)) bundleMarkers.push({ bundle: name, marker });
  }
  if (fixtureMarkers.some(marker => code.includes(marker))) bundleMarkers.push({ bundle: name, marker: 'synthetic backend fixture session identifier' });
}
// Marker absence supports inspection but is not proof that minified/third-party code has no effects.
const report = { generatedUtc: new Date().toISOString(), backendSyntaxFiles: backend.length, syntaxFailed: errors.filter(e => e.syntaxExit !== undefined),
  reachablePreviewFiles: [...reachable].sort(), previewConcerns, apiMounts: mounts, unchangedInvariants: invariants,
  allocationDisabled, campaignParticipationDisabled, unresolvedActive, historicalUnresolved: inventory.unresolved.filter(item => !unresolvedActive.includes(item)),
  bundleMarkerFindings: bundleMarkers, checkpointDifferences: inventory.checkpointComparison.filter(item => item.state !== 'unchanged'), errors,
  limitations: 'No application module execution, HTTP/API/database/email/transaction testing. Bundle string checks are supplementary; runtime mocks and source graph provide separate evidence.' };
fs.writeFileSync(path.join(root, 'docs/STRUCTURAL_VERIFICATION.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ backendSyntaxFiles: backend.length, reachablePreviewFiles: reachable.size, apiMounts: mounts.map(item => item.path), allocationDisabled, bundleMarkerFindings: bundleMarkers, errors }, null, 2));
if (errors.length) process.exitCode = 1;
