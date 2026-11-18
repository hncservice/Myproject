'use strict';
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { validateHarnessConfig } = require('./offlineHarness');
const { assertOfflineRuntime } = require('./offlineRuntime');
const { exact, fail } = require('./adapterSafety');
// Evaluates pinned bootstrap text, never require(server.js). Every import is
// supplied, including no-op dotenv and a guarded connector; app.listen is denied.
function composeExpressBootstrap({ source, sha256, config, dependencies }) {
  assertOfflineRuntime();
  const cfg = validateHarnessConfig(config);
  if (typeof source !== 'string' || source.length > 262144 || !/^[a-f0-9]{64}$/.test(sha256) ||
      createHash('sha256').update(source).digest('hex') !== sha256) fail('BOOTSTRAP_SOURCE_REJECTED');
  exact(dependencies, ['express', 'cors', 'helmet', 'routers', 'connectDatabase', 'errorMiddleware']);
  exact(dependencies.routers, ['auth', 'spin', 'vendor', 'admin', 'games']);
  if (['express', 'cors', 'helmet', 'connectDatabase', 'errorMiddleware'].some(k => typeof dependencies[k] !== 'function') ||
      Object.values(dependencies.routers).some(router => typeof router !== 'function') ||
      typeof dependencies.express.json !== 'function' || typeof dependencies.express.urlencoded !== 'function') fail('MISSING_ISOLATION_CONTROL');
  const express = () => {
    const app = dependencies.express();
    Object.defineProperty(app, 'listen', { value: () => fail('LIVE_LISTENER_NOT_AUTHORIZED'), writable: false, configurable: false });
    return app;
  };
  express.json = options => dependencies.express.json(options);
  express.urlencoded = options => dependencies.express.urlencoded(options);
  const imports = {
    dotenv: Object.freeze({ config: () => Object.freeze({ parsed: Object.freeze({}) }) }),
    express, cors: dependencies.cors, helmet: dependencies.helmet,
    morgan: () => fail('BOOTSTRAP_LOGGER_NOT_AUTHORIZED'),
    './config/db': dependencies.connectDatabase,
    './middleware/errorMiddleware': dependencies.errorMiddleware,
    './features/authentication/routes/authRoutes': dependencies.routers.auth,
    './features/games/routes/spinRoutes': dependencies.routers.spin,
    './features/vendors/routes/vendorRoutes': dependencies.routers.vendor,
    './features/administration/routes/adminRoutes': dependencies.routers.admin,
    './features/games/routes/gameRoutes': dependencies.routers.games,
  };
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports,
    require: name => { if (!Object.hasOwn(imports, name)) fail('BOOTSTRAP_IMPORT_DENIED'); return imports[name]; },
    process: Object.freeze({ env: Object.freeze({ NODE_ENV: 'test', CLIENT_URL: cfg.target.httpBaseUrl }) }),
    console: Object.freeze({ log() {}, error() {}, warn() {} }),
  }, { codeGeneration: { strings: false, wasm: false } });
  try { new vm.Script(source, { filename: 'pinned-synthetic-bootstrap.js' }).runInContext(context, { timeout: 1000 }); }
  catch { fail('BOOTSTRAP_COMPOSITION_FAILED'); }
  return module.exports;
}
module.exports = { composeExpressBootstrap };
