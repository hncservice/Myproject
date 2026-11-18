'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// Same-realm source evaluation preserves native RegExp identity required by Joi.
// The process remains capability-guarded; require and environment are explicit fakes.
module.exports = function loadAuthSource(relative, dependencies, environment = {}) {
  const sourcePath = path.resolve(__dirname, '../../..', relative);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const module = { exports: {} };
  const evaluate = new vm.Script('(function(require,module,exports,process,console){' + source + '\n})', { filename: sourcePath }).runInThisContext({ timeout: 1000 });
  evaluate(name => { if (!Object.hasOwn(dependencies, name)) throw new Error('UNEXPECTED_AUTH_DEPENDENCY: ' + name); return dependencies[name]; }, module, module.exports, Object.freeze({ env: Object.freeze({ ...environment }) }), Object.freeze({ error() {}, log() {} }));
  return module.exports;
};
