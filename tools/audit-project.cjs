'use strict';
// Static project inventory. Never imports application modules or environment files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('../client/node_modules/@babel/parser');
const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
fs.mkdirSync(docs, { recursive: true });
const slash = value => value.split(path.sep).join('/');
const files = [];
function collect(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isSymbolicLink() || ['node_modules', 'dist', 'build', '.git', '.vite', 'coverage'].includes(item.name) || /^\.env(?:\.|$)/i.test(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) collect(file);
    else if (/\.(js|jsx|cjs|mjs|css|html|json|md|png|mp3)$/.test(item.name) || item.name === '.gitignore') files.push(file);
  }
}
collect(path.join(root, 'client'));
collect(path.join(root, 'server'));
function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'extra'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => walk(child, visitor));
    else if (value && typeof value === 'object') walk(value, visitor);
  }
}
const modules = files.sort().map(file => {
  const name = slash(path.relative(root, file));
  const bytes = fs.readFileSync(file);
  const info = { file: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), imports: [], exports: [], routes: [], modelReferences: [], schemaFields: [], schemaIndexes: [], environmentNames: [], initialization: [], parseError: null };
  if (!/\.(js|jsx|cjs|mjs)$/.test(file)) return info;
  const source = bytes.toString('utf8');
  const snippet = node => source.slice(node.start, node.end).replace(/\s+/g, ' ');
  try {
    const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] });
    for (const node of ast.program.body) {
      if (node.type === 'ExpressionStatement') info.initialization.push({ line: node.loc.start.line, expression: snippet(node).slice(0, 160) });
    }
    walk(ast, node => {
      const line = node.loc?.start.line;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) info.imports.push({ line, specifier: node.source.value, kind: node.type });
      if (node.type === 'ExportDefaultDeclaration') info.exports.push({ line, name: 'default' });
      if (node.type === 'ExportNamedDeclaration' && node.declaration?.id) info.exports.push({ line, name: node.declaration.id.name });
      if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
        for (const declaration of node.declaration.declarations) if (declaration.id.name) info.exports.push({ line, name: declaration.id.name });
      }
      if (node.type === 'ExportNamedDeclaration' && !node.declaration) {
        for (const specifier of node.specifiers || []) info.exports.push({ line, name: specifier.exported?.name || specifier.exported?.value });
      }
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') {
        if (node.left.object.name === 'exports') info.exports.push({ line, name: node.left.property.name });
        if (snippet(node.left) === 'module.exports') info.exports.push({ line, name: 'module.exports', members: node.right.properties?.map(p => p.key?.name || p.key?.value).filter(Boolean) || [] });
      }
      if (node.type === 'MemberExpression') {
        const expression = snippet(node);
        const env = /^(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)$/.exec(expression);
        if (env) info.environmentNames.push({ line, name: env[1] });
      }
      if (node.type === 'ObjectProperty' && (node.key.name === 'ref' || node.key.value === 'ref') && node.value.type === 'StringLiteral') info.modelReferences.push({ line, target: node.value.value });
      if (node.type === 'NewExpression' && /(?:^|\.)Schema$/.test(snippet(node.callee)) && node.arguments[0]?.type === 'ObjectExpression') {
        for (const field of node.arguments[0].properties) {
          if (field.type === 'ObjectProperty') info.schemaFields.push({ line: field.loc.start.line, name: field.key.name || field.key.value, declaration: snippet(field.value) });
        }
      }
      if (node.type !== 'CallExpression' && node.type !== 'ImportExpression') return;
      const callee = node.callee ? snippet(node.callee) : 'import';
      if (callee === 'require' || callee === 'require.resolve' || callee === 'import' || node.type === 'ImportExpression') {
        const argument = node.source || node.arguments?.[0];
        info.imports.push({ line, specifier: argument?.type === 'StringLiteral' ? argument.value : null, kind: callee });
      }
      if (/^(router|app)\.(get|post|put|patch|delete|use|set)$/.test(callee)) info.routes.push({ line, call: callee, path: node.arguments[0]?.type === 'StringLiteral' ? node.arguments[0].value : null, handlers: node.arguments.slice(node.arguments[0]?.type === 'StringLiteral' ? 1 : 0).map(snippet).map(s => s.length > 100 ? '<inline middleware>' : s) });
      if (/Schema\.index$|schema\.index$/.test(callee)) info.schemaIndexes.push({ line, declaration: snippet(node) });
    });
  } catch (error) { info.parseError = error.message; }
  return info;
});
for (const info of modules) for (const dep of info.imports) {
  if (!dep.specifier?.startsWith('.')) continue;
  const base = path.resolve(path.dirname(path.join(root, info.file)), dep.specifier);
  const target = ['', '.js', '.jsx', '.cjs', '.mjs', '.json', '.css', '/index.js', '/index.jsx'].map(ext => base + ext).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  dep.target = target ? slash(path.relative(root, target)) : null;
}
const unresolved = modules.flatMap(info => info.imports.filter(dep => dep.specifier?.startsWith('.') && !dep.target).map(dep => ({ file: info.file, ...dep })));
const checkpointDir = path.join(root, 'local-checkpoints/Step15R.23P-2026-10-28T10-03-23-580Z');
const checkpoint = JSON.parse(fs.readFileSync(path.join(checkpointDir, 'manifest.json'), 'utf8'));
const checkpointComparison = checkpoint.files.filter(item => item.path.startsWith('snapshot/')).map(item => {
  const file = item.path.slice('snapshot/'.length);
  const current = path.join(root, file);
  return { file, state: !fs.existsSync(current) ? 'missing' : crypto.createHash('sha256').update(fs.readFileSync(current)).digest('hex') === item.sha256 ? 'unchanged' : 'changed' };
});
const result = { generatedUtc: new Date().toISOString(), scope: 'client/server source, configuration, tests and assets; no dependencies, build output or environment files; static evidence is not runtime verification', modules, unresolved, checkpointComparison };
fs.writeFileSync(path.join(docs, 'MODULE_INVENTORY.json'), JSON.stringify(result, null, 2) + '\n');
let table = '# Complete module inventory\n\nGenerated by `node tools/audit-project.cjs`. Presence and exports are inventory only, not a completion claim. See PROJECT_STATUS.md for evidence levels. Environment VALUES are never read.\n\n| File | Exports | Dependencies | Status |\n|---|---|---:|---|\n';
for (const info of modules) table += `| \`${info.file}\` | ${info.exports.map(e => e.members?.length ? e.members.join(', ') : e.name).join('; ')} | ${info.imports.length} | ${info.parseError ? 'PARSE ERROR: ' + info.parseError : /\.test\./.test(info.file) ? 'Test source; see execution evidence' : /backup|security-checkpoints/.test(info.file) ? 'Historical/inactive' : 'Present; implementation verification varies'} |\n`;
table += '\n## Unresolved historical references\n\n' + unresolved.map(dep => `- \`${dep.file}:${dep.line}\` → \`${dep.specifier}\``).join('\n') + '\n';
fs.writeFileSync(path.join(docs, 'MODULE_INVENTORY.md'), table);
let api = '# Existing API reference — source inventory\n\nRoutes are recorded statically and are not HTTP-tested. No server was started. All /api business routers pass through lazy database middleware; root and /api/health precede it. Handler names identify implementation ownership, not proof of authorization correctness.\n\n';
const mounts = { 'authRoutes.js': '/api/auth', 'spinRoutes.js': '/api/spin', 'gameRoutes.js': '/api/games', 'vendorRoutes.js': '/api/vendor', 'adminRoutes.js': '/api/admin' };
for (const info of modules.filter(m => m.file.endsWith('Routes.js') && m.file.startsWith('server/'))) {
  api += `## ${info.file}\n\n| Method | Existing path | Handlers | Source line |\n|---|---|---|---:|\n`;
  for (const route of info.routes) api += `| ${route.call.split('.')[1].toUpperCase()} | ${route.path ? (mounts[path.basename(info.file)] || '') + route.path : 'router-wide middleware'} | ${route.handlers.join(', ') || '(first argument is middleware)'} | ${route.line} |\n`;
}
api += '\nThe experimental fraud-report controller exists in source but is intentionally unregistered. Spin and legacy Monkey mutation endpoints remain disabled. Game completion creates preliminary decisions only. Do not infer prize allocation from a decision status.\n';
fs.writeFileSync(path.join(docs, 'API_REFERENCE.md'), api);
let schema = '# Database source review\n\nNo database, collections, indexes or records were inspected. These are schema declarations only; actual index installation, uniqueness, cleanup and transaction behavior are unverified. Do not apply schema changes until migration/rollback review.\n\n';
for (const info of modules.filter(m => /server\/features\/.*\/models\//.test(m.file))) {
  schema += `## ${info.file}\n\nReferences: ${info.modelReferences.map(ref => ref.target).join(', ') || 'None declared (or inactive/comment-only model)'}.\n\n`;
  if (info.schemaFields.length) {
    schema += '| Field | Schema declaration | Line |\n|---|---|---:|\n';
    for (const field of info.schemaFields) schema += `| ${field.name} | \`${field.declaration}\` | ${field.line} |\n`;
    schema += '\nExplicit schema.index declarations (field-level index/unique flags appear in the field table):\n\n';
  }
  for (const index of info.schemaIndexes) schema += `- Line ${index.line}: \`${index.declaration}\`\n`;
}
schema += '\nReview priorities: email/phone uniqueness normalization, per-campaign/game attempt uniqueness, partial active-session uniqueness, one award per campaign/session/spin, one decision/recovery per game, redemption compare-and-set, claim leases and audit retention. GameSession expiresAt is a business expiry field, not currently a declared TTL index; retaining evidence and deleting abandoned sessions need a deliberate retention policy. Customer/vendor/admin revocation use version comparisons and conditional updates; explicit null, unsafe counters and legacy defaults require data-rollout review. No installed index or database state is verified.\n';
fs.writeFileSync(path.join(docs, 'DATABASE_SCHEMA.md'), schema);
const sourceErrors = modules.filter(info => info.parseError);
console.log(JSON.stringify({ files: modules.length, jsModules: modules.filter(m => /\.(js|jsx|cjs|mjs)$/.test(m.file)).length, frontendTestFiles: modules.filter(m => m.file.startsWith('client/src/') && /\.test\.(js|jsx)$/.test(m.file)).length, backendScripts: modules.filter(m => /^server\/scripts\/[^/]+\.js$/.test(m.file)).length, parseErrors: sourceErrors.map(m => ({ file: m.file, error: m.parseError })), unresolved, checkpointChanged: checkpointComparison.filter(item => item.state !== 'unchanged') }, null, 2));
