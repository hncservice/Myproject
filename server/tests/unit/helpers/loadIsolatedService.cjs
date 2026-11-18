'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Read source only. Every application dependency must be explicitly substituted;
// no Mongoose model, SMTP module, dotenv file or application bootstrap is loaded.
module.exports = function loadIsolatedService(relativePath, dependencies, environment = {}) {
  const server = path.resolve(__dirname, '../../..');
  const file = path.resolve(server, relativePath);
  if (!file.startsWith(server + path.sep)) throw new Error('Service path outside server');
  const source = fs.readFileSync(file, 'utf8');
  const isolatedModule = { exports: {} };
  const context = vm.createContext({
    Buffer,
    process: Object.freeze({ env: Object.freeze({ ...environment }) }),
    console: Object.freeze({ error() {}, log() {}, warn() {} }),
  }, { codeGeneration: { strings: false, wasm: false } });
  const factory = new vm.Script(`(function(require,module,exports){${source}\n})`, { filename: file })
    .runInContext(context, { timeout: 1000 });
  factory(name => {
    if (!Object.hasOwn(dependencies, name)) throw new Error('UNEXPECTED_ISOLATED_DEPENDENCY: ' + name);
    return dependencies[name];
  }, isolatedModule, isolatedModule.exports);
  return isolatedModule.exports;
};
