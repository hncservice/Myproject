'use strict';
// Static require-graph review only. Never executes installed auth libraries here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire, isBuiltin } = require('node:module');
const parser = require('../client/node_modules/@babel/parser');
const root = path.resolve(__dirname, '..');
const nodeModules = path.join(root, 'server/node_modules') + path.sep;
const resolve = createRequire(path.join(root, 'server/package.json'));
const roots = Object.fromEntries(['joi', 'jsonwebtoken'].map(name => [name, resolve.resolve(name)]));
const files = new Map(); const resolutions = {}; const builtins = new Set();
function visit(file) {
  if (files.has(file)) return;
  if (!file.startsWith(nodeModules)) throw new Error('Library graph escaped dependencies');
  const source = fs.readFileSync(file, 'utf8');
  files.set(file, { path: file, sha256: crypto.createHash('sha256').update(source).digest('hex') });
  if (file.endsWith('.json')) return;
  const ast = parser.parse(source, { sourceType: 'unambiguous' });
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.name === 'require') {
      if (node.arguments[0]?.type !== 'StringLiteral') throw new Error('Dynamic dependency needs review: ' + file);
      const name = node.arguments[0].value;
      if (isBuiltin(name)) builtins.add(name);
      else {
        const target = createRequire(file).resolve(name);
        resolutions[JSON.stringify([file, name])] = target; visit(target);
      }
    }
    for (const [key, value] of Object.entries(node)) if (!['loc', 'extra'].includes(key)) {
      if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  let directory = path.dirname(file);
  while (directory.startsWith(nodeModules)) {
    const metadata = path.join(directory, 'package.json');
    if (fs.existsSync(metadata) && !files.has(metadata)) { const bytes = fs.readFileSync(metadata); files.set(metadata, { path: metadata, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }); }
    directory = path.dirname(directory);
  }
}
Object.values(roots).forEach(visit);
const approved = ['buffer', 'crypto', 'stream', 'util', 'url', 'assert', 'events', 'node:util'];
if ([...builtins].some(name => !approved.includes(name))) throw new Error('Unreviewed builtins: ' + JSON.stringify([...builtins]));
fs.writeFileSync(path.join(__dirname, 'auth-library-manifest.json'), JSON.stringify({ roots, resolutions, builtins: [...builtins], files: [...files.values()] }, null, 2) + '\n');
console.log(JSON.stringify({ modulesAndMetadata: files.size, builtins: [...builtins], rootPackages: Object.keys(roots), scope: 'Static graph only; no library application code executed; only pure builtin dependencies admitted' }, null, 2));
