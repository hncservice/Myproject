'use strict';
// Deliberately has no compatibility fallback. Normal node invocation is denied.
function assertOfflineRuntime() {
  if (globalThis.__HNC_OFFLINE_GUARD__ !== true || !process.permission ||
      ['fs.write', 'child', 'worker', 'addons', 'wasi'].some(scope => process.permission.has(scope)) ||
      !Object.isFrozen(process.env) || Reflect.ownKeys(process.env).length !== 0) {
    throw Object.assign(new Error('OFFLINE_HARNESS_GUARD_REQUIRED'), { code: 'OFFLINE_HARNESS_GUARD_REQUIRED' });
  }
}
module.exports = { assertOfflineRuntime };
