'use strict';
// Preload only with Node's permission model. No environment or application module
// is imported here. Unit services are read as text and evaluated with explicit stubs.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { fileURLToPath } = require('node:url');
const network = ['net', 'tls', 'http', 'https', 'http2', 'dns', 'dgram', 'child_process', 'worker_threads']
  .map(name => require('node:' + name));
const root = path.resolve(__dirname, '..');
const units = path.join(root, 'server/tests/unit') + path.sep;
const sourceNames = [
  'tests/integration/offlineHarness.js',
  'tests/integration/offlineRuntime.js',
  'tests/integration/adapterSafety.js',
  'tests/integration/databaseIntegrationAdapter.js',
  'tests/integration/httpIntegrationAdapter.js',
  'tests/integration/expressBootstrapAdapter.js',
  'middleware/errorMiddleware.js',
  'infrastructure/logging/errorMetadata.js',
  'infrastructure/email/emailService.js',
  'infrastructure/testing/integrationTargetPolicy.js',
  'server.js',
  'features/campaigns/services/campaignPolicy.js',
  'features/campaigns/services/campaignAdministrationService.js',
  'features/campaigns/controllers/campaignAdministrationController.js',
  'features/prizes/services/prizeReviewEvidenceService.js',
  'features/prizes/controllers/prizeReviewController.js',
  'features/vendors/controllers/vendorController.js',
  'features/administration/controllers/adminController.js',
  'features/administration/controllers/adminOperationsController.js',
  'features/administration/routes/adminRoutes.js',
  'features/prizes/services/prizeReviewService.js',
  'features/prizes/services/prizeRedemptionService.js',
  'infrastructure/reporting/reportSafety.js',
  'features/games/services/gameSessionService.js',
  'features/authentication/middleware/authMiddleware.js',
  'features/authentication/services/otpVerificationService.js',
  'config/mailer.js',
  'config/gameConfig.js',
  'features/fraud-monitoring/services/prizeFraudAssessmentService.js',
  'features/fraud-monitoring/services/gameplayBehaviorSignalsService.js',
  'features/games/registry/gameRegistryFactory.js',
  'features/games/registry/gameRegistry.js',
  'features/games/engine/sharedGameEngine.js',
  'features/games/engine/registeredGameAssessments.js',
  'features/games/engine/gameSessionStoreFactory.js',
  'features/games/engine/persistentGameEngineFactory.js',
  'features/games/engine/legacyGameEngineFactory.js',
  'features/games/services/gameCompletionDecisionService.js',
  'features/games/controllers/gameController.js',
  'features/games/controllers/monkeyGameplayController.js',
  'features/games/controllers/perfectShotGameplayController.js',
  'features/authentication/controllers/authController.js',
  'features/authentication/controllers/sessionController.js',
  'features/authentication/services/authPolicy.js',
  'features/authentication/services/otpChallengeService.js',
  'features/authentication/services/sessionRevocationService.js',
  'features/authentication/services/otpService.js',
  'config/jwt.js',
  'features/games/services/gameStartService.js',
  'features/games/services/gameStatusService.js',
];
const sourceFiles = new Set(sourceNames.map(name => path.resolve(root, 'server', name).toLowerCase()));
const nativeLoad = Module._load;
const nativeRead = fs.readFileSync;
const libraryEnabled = process.argv.includes('--auth-libraries');
const libraryManifest = libraryEnabled ? JSON.parse(nativeRead(path.join(__dirname, 'auth-library-manifest.json'), 'utf8')) : null;
const libraryFiles = new Set();
const libraryBuiltins = new Map();
if (libraryManifest) {
  for (const item of libraryManifest.files) {
    if (!item.path.startsWith(path.join(root, 'server/node_modules') + path.sep) || !/\.(js|json)$/.test(item.path) || crypto.createHash('sha256').update(nativeRead(item.path)).digest('hex') !== item.sha256) throw new Error('AUTH_LIBRARY_INTEGRITY_FAILURE');
    libraryFiles.add(item.path);
  }
  for (const name of libraryManifest.builtins) {
    if (!['url', 'util', 'buffer', 'stream', 'crypto'].includes(name)) throw new Error('AUTH_LIBRARY_BUILTIN_DENIED');
    libraryBuiltins.set(name, nativeLoad.call(Module, name));
  }
}
void process.stdout; void process.stderr;
if (!process.permission || ['fs.write', 'child', 'worker', 'addons', 'wasi'].some(scope => process.permission.has(scope))) {
  throw new Error('OFFLINE_PERMISSION_MODEL_REQUIRED');
}
const deny = name => { throw Object.assign(new Error('OFFLINE_UNIT_GUARD_BLOCKED: ' + name), { code: 'OFFLINE_UNIT_GUARD_BLOCKED' }); };
for (const api of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
  Object.defineProperty(globalThis, api, { value: () => deny(api), writable: false, configurable: false });
}
for (const builtin of network) for (const key of Object.getOwnPropertyNames(builtin)) {
  if (typeof builtin[key] === 'function') Object.defineProperty(builtin, key, { value: () => deny(key), writable: false, configurable: false });
}
for (const key of ['binding', '_linkedBinding', 'getBuiltinModule', 'dlopen', 'kill', 'abort', 'exit', 'chdir']) {
  Object.defineProperty(process, key, { value: () => deny('process.' + key), writable: false, configurable: false });
}
Object.defineProperty(process, 'env', { value: Object.freeze({}), writable: false, configurable: false });
const readOnlyFs = Object.freeze({
  readFileSync(file, encoding) {
    if (typeof file !== 'string' || !sourceFiles.has(path.resolve(file).toLowerCase())) return deny('filesystem read');
    return nativeRead.call(fs, file, encoding);
  },
});
const builtins = new Map([
  ['node:assert/strict', assert], ['node:crypto', crypto], ['node:path', path],
  ['node:vm', vm], ['node:fs', readOnlyFs],
]);
Object.defineProperty(Module, '_load', {
  value(request, parent, isMain) {
    if (builtins.has(request)) return builtins.get(request);
    if (libraryManifest) {
      const fromLibrary = libraryFiles.has(parent?.filename);
      if (fromLibrary && libraryBuiltins.has(request)) return libraryBuiltins.get(request);
      const selected = fromLibrary ? libraryManifest.resolutions[JSON.stringify([parent.filename, request])] : (parent?.filename?.startsWith(units) ? libraryManifest.roots[request] : null);
      if (selected && libraryFiles.has(selected)) return nativeLoad.call(Module, selected, parent, isMain);
    }
    const target = path.resolve(parent ? path.dirname(parent.filename) : root, request);
    if ((!request.startsWith('.') && !path.isAbsolute(request)) || !target.startsWith(units) || !target.endsWith('.cjs')) return deny('import ' + request);
    return nativeLoad.call(Module, request, parent, isMain);
  }, writable: false, configurable: false,
});
Module.registerHooks({ resolve(specifier, context, nextResolve) {
  if (builtins.has(specifier)) return nextResolve(specifier, context);
  const result = nextResolve(specifier, context);
  if (!result.url.startsWith('file:') || (!fileURLToPath(result.url).startsWith(units) && !libraryFiles.has(fileURLToPath(result.url)))) return deny('dynamic import ' + specifier);
  return result;
} });
// Published only after every denial hook is installed; preparation harnesses also
// verify native permission scopes and empty frozen environment before any work.
Object.defineProperty(globalThis, '__HNC_OFFLINE_GUARD__', { value: true, writable: false, configurable: false });
