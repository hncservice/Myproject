'use strict';
module.exports = async function runCases(label, cases) {
  let passed = 0;
  for (const [name, test] of cases) {
    try { await test(); passed++; console.log('PASS: ' + name); }
    catch (error) { process.exitCode = 1; console.error('FAIL: ' + name + '\n' + error.stack); }
  }
  console.log(`RESULT: ${passed}/${cases.length} ${label} CASES PASSED`);
};
