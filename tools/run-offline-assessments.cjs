'use strict';
// Fixed, individually reviewed pure scripts. Never discover arbitrary backend tests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '..');
const checkpoint = path.join(workspace, 'local-checkpoints/Step15R.23P-2026-10-28T10-03-23-580Z');
const manifestBytes = fs.readFileSync(path.join(checkpoint, 'manifest.json'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checksum = fs.readFileSync(path.join(checkpoint, 'SHA256SUMS'), 'utf8').split(/\r?\n/).find(line => line.endsWith('  manifest.json'));
if (!checksum || hash(manifestBytes) !== checksum.slice(0, 64)) throw new Error('Historical manifest integrity failed');
const historical = JSON.parse(manifestBytes);
const scripts = ['simulatePerfectShotLatency.js', 'testCombinedGameplayAssessment.js', 'testGameplayBehaviorSignals.js', 'testMonkeyRealisticBehavior.js', 'testPrizeFraudAssessmentV2.js', 'testPerfectShotFraudAssessment.js'];
const reviewedChanges = new Map([
  ['server/config/gameConfig.js', '41a6589c9f36703debb05beb10ec4fbdcef7481938fc02422695d1489d03fb64'],
  ['server/scripts/testPerfectShotFraudAssessment.js', '3a42c2ea90b46160edea74ae3fea75f6ba72834294e3cc9e0461eae1269cec9c'],
  ['server/features/games/registry/gameRegistryFactory.js', '469f1e48bdb27f0ec217547e69fe9e8a4b46cbe74ca2b6a890279992ab462bf5'],
  ['server/features/games/registry/gameRegistry.js', '4a098f2d1714f32f63b5dba85b2b0155ade6215edc65e7bff23c5619be83bb76'],
  ['server/features/games/engine/registeredGameAssessments.js', '26259842aa72c77aa329cdb50c87adf3b5e13e040f48ba5db6c9c8fb12af7717'],
  ['server/features/games/engine/gameSessionStoreFactory.js', '3ebcf55dafca423d7a9acbcff6b59415c4ccb0e01c47ce8cd5516b0c6b660292'],
  ['server/features/fraud-monitoring/services/combinedGameplayAssessmentService.js', 'b65397020c3628ea61dfbc11b3476320b6e027cdcac705f46d47dc2519cbbc0e'],
]);
const graph = new Map();
function visit(file) {
  if (graph.has(file)) return;
  const name = path.relative(workspace, file).split(path.sep).join('/');
  const bytes = fs.readFileSync(file);
  const original = historical.files.find(item => item.path === 'snapshot/' + name);
  const expected = reviewedChanges.get(name) || original?.sha256;
  if (!expected || hash(bytes) !== expected) throw new Error('Unreviewed source difference: ' + name);
  graph.set(file, { path: file, sha256: hash(bytes) });
  const source = bytes.toString('utf8');
  for (const match of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const specifier = match[1];
    if (['node:assert/strict', 'node:crypto'].includes(specifier)) continue;
    if (!specifier.startsWith('.')) throw new Error('Unexpected dependency: ' + specifier);
    const base = path.resolve(path.dirname(file), specifier);
    const target = ['', '.js'].map(extension => base + extension).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!target) throw new Error('Unresolved reviewed dependency: ' + specifier);
    visit(target);
  }
}
const targets = scripts.map(name => path.join(workspace, 'server/scripts', name));
targets.forEach(visit);
const evidence = path.join(workspace, 'local-checkpoints/master-offline-assessments-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(evidence, { recursive: true });
const config = { workspace, scripts: targets, files: [...graph.values()], packageFile: path.join(workspace, 'server/package.json') };
const approved = path.join(evidence, 'approved-files.json');
fs.writeFileSync(approved, JSON.stringify(config, null, 2) + '\n');
const guard = path.join(evidence, 'offline-guard.cjs');
fs.copyFileSync(path.join(workspace, 'local-checkpoints/Step15R.23R-2026-10-28/offline-guard.cjs'), guard);
const guardHash = hash(fs.readFileSync(guard));
const flags = ['--permission', ...[guard, approved, config.packageFile, ...graph.keys()].map(file => '--allow-fs-read=' + file)];
const options = { cwd: evidence, env: {}, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 };
const probeRun = spawnSync(process.execPath, [...flags, guard, '--probe'], options);
const probe = { exitCode: probeRun.status, stdout: probeRun.stdout, stderr: probeRun.stderr };
if (probe.exitCode !== 0) throw new Error('Guard failed; no scripts executed: ' + probe.stderr);
console.log(probe.stdout);
const results = [];
for (const target of targets) {
  const run = spawnSync(process.execPath, [...flags, guard, target], options);
  const marker = (run.stdout || '').split(/\r?\n/).find(line => line.startsWith('__OFFLINE_AUDIT__'));
  const audit = marker ? JSON.parse(marker.slice('__OFFLINE_AUDIT__'.length)) : null;
  const passed = run.status === 0 && audit && audit.assertions.failed === 0 && audit.blockedOperations.length === 0;
  results.push({ script: path.basename(target), status: passed ? 'PASS' : 'FAIL', exitCode: run.status, signal: run.signal, processError: run.error?.message || null, stdout: run.stdout, stderr: run.stderr, audit });
  console.log(path.basename(target) + '\n' + run.stdout + run.stderr);
  if (!passed) process.exitCode = 1;
}
for (const item of graph.values()) if (hash(fs.readFileSync(item.path)) !== item.sha256) throw new Error('Source changed during run');
if (hash(fs.readFileSync(guard)) !== guardHash) throw new Error('Guard changed during run');
fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ node: process.version, reviewedChanges: [...reviewedChanges], guardHash, probe, sourceHashes: [...graph.values()], results }, null, 2) + '\n');
console.log(JSON.stringify({ evidence, results: results.map(result => ({ script: result.script, status: result.status, exitCode: result.exitCode, assertions: result.audit?.assertions })) }, null, 2));
