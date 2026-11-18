'use strict';
// Hash only known source/docs/backups; no environment secrets or application execution.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function safeFile(base, relative) {
  if (path.isAbsolute(relative) || /(?:^|[\\/])\.env(?!\.example$)|\.(?:pem|key|pfx|p12|crt|cer)$/i.test(relative)) throw new Error('Excluded path in integrity manifest');
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) throw new Error('Manifest path outside expected root');
  return target;
}
const checkpoint = path.join(root, 'local-checkpoints/Step15R.23P-2026-10-28T10-03-23-580Z');
const historical = JSON.parse(fs.readFileSync(path.join(checkpoint, 'manifest.json'), 'utf8'));
const manifestChecksum = fs.readFileSync(path.join(checkpoint, 'SHA256SUMS'), 'utf8').split(/\r?\n/).find(line => line.endsWith('  manifest.json'));
if (!manifestChecksum || digest(path.join(checkpoint, 'manifest.json')) !== manifestChecksum.slice(0, 64)) throw new Error('Historical manifest checksum failed');
let historicalFilesVerified = 0;
for (const item of historical.files) {
  if (digest(safeFile(checkpoint, item.path)) !== item.sha256) throw new Error('Checkpoint integrity failed: ' + item.path);
  historicalFilesVerified++;
}
const backups = [];
const backupRoot = path.join(root, 'local-backups');
for (const entry of fs.readdirSync(backupRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^(?:master-plan-batch-00[1-5]-|shared-game-(?:engine|engine-tests|assessments|store)-|phase-c-(?:auth|docs)-|phase-d-(?:vendor-admin|docs)-|phase-e-campaign-|phase-f-readiness-)/.test(entry.name)) continue;
  const directory = path.join(backupRoot, entry.name);
  const records = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  for (const item of Array.isArray(records) ? records : [records]) {
    if (digest(safeFile(directory, item.path)) !== item.sha256) throw new Error('Backup integrity failed: ' + entry.name + '/' + item.path);
    backups.push({ backup: entry.name, ...item });
  }
}
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/MODULE_INVENTORY.json'), 'utf8'));
const baseline = new Set(inventory.checkpointComparison.map(item => item.file));
const changed = inventory.checkpointComparison.filter(item => item.state !== 'unchanged').map(item => item.file);
const created = inventory.modules.filter(item => !baseline.has(item.file)).map(item => item.file);
const paths = new Set([...changed, ...created, 'client/.env.example', 'server/.env.example']);
for (const folder of ['docs', 'tools']) for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
  if (entry.isFile() && entry.name !== 'CHANGE_MANIFEST.json') paths.add(folder + '/' + entry.name);
}
const files = [...paths].sort().map(relative => {
  const target = safeFile(root, relative);
  return { path: relative, sha256: digest(target), bytes: fs.statSync(target).size };
});
const output = { generatedUtc: new Date().toISOString(), scope: 'Master audit/initial-batch changed and new source, examples, tools and documentation; excludes this manifest itself, dependencies/build output, secrets and historical artifact duplication',
  historicalCheckpointFilesVerified: historicalFilesVerified, backupsVerified: backups, changedOriginalFiles: changed, newClientServerSourceFiles: created, files,
  limitations: 'Hashes detect changes against this record; no signature/authenticity claim. Full platform remains incomplete. Rerun after intentional documentation/inventory changes.' };
fs.writeFileSync(path.join(root, 'docs/CHANGE_MANIFEST.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ historicalCheckpointFilesVerified: historicalFilesVerified, backupFileCopiesVerified: backups.length, recordedFiles: files.length, changedOriginalFiles: changed, newClientServerSourceFiles: created }, null, 2));
