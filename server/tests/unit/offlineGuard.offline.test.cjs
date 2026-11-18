'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  assert.equal(Object.keys(process.env).length, 0);
  for (const permission of ['fs.write', 'child', 'worker', 'addons', 'wasi']) assert.equal(process.permission.has(permission), false);
  let probes = 6;
  for (const name of ['mongoose', 'mongodb', 'nodemailer', 'axios', 'dotenv', 'node:net', 'node:https', 'node:fs/promises', 'node:child_process', 'node:worker_threads']) {
    assert.throws(() => require(name), error => error.code === 'OFFLINE_UNIT_GUARD_BLOCKED');
    probes++;
  }
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
    assert.throws(() => globalThis[name]('never-contacted.invalid'), error => error.code === 'OFFLINE_UNIT_GUARD_BLOCKED');
    probes++;
  }
  for (const name of ['binding', 'getBuiltinModule', 'dlopen', 'kill', 'exit']) {
    assert.throws(() => process[name]('blocked'), error => error.code === 'OFFLINE_UNIT_GUARD_BLOCKED');
    probes++;
  }
  assert.throws(() => fs.readFileSync('/forbidden/.env', 'utf8'), error => error.code === 'OFFLINE_UNIT_GUARD_BLOCKED');
  assert.equal(fs.writeFileSync, undefined);
  await assert.rejects(import('node:net'), error => error.code === 'OFFLINE_UNIT_GUARD_BLOCKED');
  probes += 3;
  console.log(`RESULT: ${probes}/${probes} OFFLINE GUARD PROBES PASSED`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
