'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const guard = path.join(__dirname, 'offline-unit-guard.cjs');
const registrySources = ['features/games/registry/gameRegistryFactory.js', 'features/games/registry/gameRegistry.js', 'config/gameConfig.js'];
const libraryManifestPath = path.join(__dirname, 'auth-library-manifest.json');
const libraries = JSON.parse(fs.readFileSync(libraryManifestPath, 'utf8'));
const authSources = ['features/authentication/controllers/authController.js', 'features/authentication/controllers/sessionController.js', 'features/authentication/services/authPolicy.js', 'features/authentication/services/otpChallengeService.js', 'features/authentication/services/otpVerificationService.js', 'features/authentication/services/sessionRevocationService.js', 'features/authentication/services/otpService.js', 'features/authentication/middleware/authMiddleware.js', 'config/jwt.js', 'features/games/services/gameStartService.js', 'features/games/services/gameStatusService.js'];
const cases = [
  { test: 'offlineGuard.offline.test.cjs', source: null },
  { test: 'integrationHarness.offline.test.cjs', source: 'tests/integration/offlineHarness.js', extraSources: ['tests/integration/offlineRuntime.js', 'infrastructure/testing/integrationTargetPolicy.js'] },
  { test: 'integrationAdapters.offline.test.cjs', source: 'tests/integration/adapterSafety.js', extraSources: ['tests/integration/databaseIntegrationAdapter.js', 'tests/integration/httpIntegrationAdapter.js', 'tests/integration/expressBootstrapAdapter.js', 'tests/integration/offlineHarness.js', 'tests/integration/offlineRuntime.js', 'infrastructure/testing/integrationTargetPolicy.js', 'server.js'] },
  { test: 'authMiddleware.offline.test.cjs', source: 'features/authentication/middleware/authMiddleware.js' },
  { test: 'otpVerification.offline.test.cjs', source: 'features/authentication/services/otpVerificationService.js', extraSources: ['features/authentication/services/authPolicy.js'] },
  { test: 'gameSessionService.offline.test.cjs', source: 'features/games/services/gameSessionService.js' },
  { test: 'mailerInitialization.offline.test.cjs', source: 'config/mailer.js' },
  { test: 'gameConfig.offline.test.cjs', source: 'config/gameConfig.js', extraSources: registrySources },
  { test: 'gameRegistry.offline.test.cjs', source: 'features/games/registry/gameRegistryFactory.js', extraSources: [...registrySources, 'features/fraud-monitoring/services/prizeFraudAssessmentService.js', 'features/fraud-monitoring/services/gameplayBehaviorSignalsService.js'] },
  { test: 'sharedGameEngine.offline.test.cjs', source: 'features/games/engine/sharedGameEngine.js', extraSources: registrySources },
  { test: 'gameEngineCompatibility.offline.test.cjs', source: 'features/games/engine/legacyGameEngineFactory.js', extraSources: [...registrySources, 'features/games/services/gameCompletionDecisionService.js', 'features/games/controllers/gameController.js', 'features/games/controllers/monkeyGameplayController.js', 'features/games/controllers/perfectShotGameplayController.js'] },
  { test: 'registeredGameAssessments.offline.test.cjs', source: 'features/games/engine/registeredGameAssessments.js', extraSources: [...registrySources, 'features/games/engine/gameSessionStoreFactory.js', 'features/fraud-monitoring/services/prizeFraudAssessmentService.js', 'features/fraud-monitoring/services/gameplayBehaviorSignalsService.js'] },
  { test: 'gameSessionStore.offline.test.cjs', source: 'features/games/engine/gameSessionStoreFactory.js', extraSources: [...registrySources, 'features/games/engine/sharedGameEngine.js', 'features/games/engine/persistentGameEngineFactory.js'] },
  { test: 'offlineGuard.offline.test.cjs', source: null, libraries: true },
  { test: 'integrationReadiness.offline.test.cjs', source:'middleware/errorMiddleware.js',extraSources:['server.js','infrastructure/logging/errorMetadata.js','infrastructure/email/emailService.js','infrastructure/testing/integrationTargetPolicy.js','features/prizes/services/prizeRedemptionService.js','features/authentication/services/sessionRevocationService.js','features/authentication/services/authPolicy.js'],libraries:true },
  { test: 'campaignReview.offline.test.cjs', source: 'features/campaigns/services/campaignPolicy.js', extraSources: ['features/campaigns/services/campaignAdministrationService.js','features/campaigns/controllers/campaignAdministrationController.js','features/prizes/services/prizeReviewEvidenceService.js','features/prizes/controllers/prizeReviewController.js','features/prizes/services/prizeReviewService.js',...registrySources,'features/games/engine/registeredGameAssessments.js','features/fraud-monitoring/services/prizeFraudAssessmentService.js','features/fraud-monitoring/services/gameplayBehaviorSignalsService.js'], libraries: true },
  { test: 'vendorAdministration.offline.test.cjs', source: 'features/administration/controllers/adminController.js', extraSources: ['features/vendors/controllers/vendorController.js', 'features/administration/controllers/adminOperationsController.js', 'features/administration/routes/adminRoutes.js', 'features/prizes/services/prizeReviewService.js', 'infrastructure/reporting/reportSafety.js', 'infrastructure/logging/errorMetadata.js', 'features/prizes/services/prizeRedemptionService.js', ...authSources], libraries: true },
  { test: 'customerAuthentication.offline.test.cjs', source: 'features/authentication/controllers/authController.js', extraSources: [...authSources, ...registrySources], libraries: true },
];
const evidence = path.join(root, 'local-checkpoints', 'master-offline-unit-evidence-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(evidence, { recursive: true });
const sourceFiles = [guard, libraryManifestPath, ...libraries.files.map(item => item.path), ...cases.flatMap(item => [path.join(root, 'server/tests/unit', item.test), ...[item.source, ...(item.extraSources || [])].filter(Boolean).map(file => path.join(root, 'server', file))]), ...fs.readdirSync(path.join(root, 'server/tests/unit/helpers')).filter(name => name.endsWith('.cjs')).map(file => path.join(root, 'server/tests/unit/helpers', file))];
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes = sourceFiles.map(file => ({ file: path.relative(root, file), sha256: digest(file) }));
const results = [];
for (const item of cases) {
  const test = path.join(root, 'server/tests/unit', item.test);
  const allowed = [guard, path.join(root, 'server/package.json'), path.join(root, 'server/tests/unit'), ...[item.source, ...(item.extraSources || [])].filter(Boolean).map(file => path.join(root, 'server', file))];
  const args = ['--permission', ...allowed.map(file => '--allow-fs-read=' + file), '--require', guard, test];
  if (item.libraries) {
    args.splice(1, 0, '--allow-fs-read=' + libraryManifestPath, ...libraries.files.map(file => '--allow-fs-read=' + file.path));
    args.push('--auth-libraries');
  }
  const run = spawnSync(process.execPath, args, { cwd: root, env: {}, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  const result = { test: item.test, exitCode: run.status, signal: run.signal, processError: run.error?.message || null, stdout: run.stdout, stderr: run.stderr };
  results.push(result);
  console.log(run.stdout + run.stderr);
  if (run.status !== 0) {
    process.exitCode = 1;
    // A failed guard probe stops all unit executions; guards are never weakened.
    if (!item.source) break;
  }
}
for (const item of hashes) if (digest(path.join(root, item.file)) !== item.sha256) throw new Error('Source changed during execution: ' + item.file);
fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ node: process.version, sourceHashes: hashes, environment: 'empty inherited environment; VM receives only explicitly synthetic values', restrictions: 'Node permission model, import hooks, runtime network/process blockers, read-only source facade, all application dependencies substituted', results }, null, 2) + '\n');
console.log(JSON.stringify({ evidence, results: results.map(({ test, exitCode }) => ({ test, exitCode })) }, null, 2));
