'use strict';
// Only guarded mock ports are executable in G2A. No Mongo/Mongoose/env import.
const { fail, exact, literalList, ownedFixtures, createGate } = require('./adapterSafety');
function createDatabaseIntegrationAdapter(input = {}) {
  exact(input, ['config', 'enabled', 'authorization', 'ports', 'clock'], true);
  let { config, enabled = false, authorization = null, ports, clock } = input;
  const gate = createGate({ config, enabled, authorization, clock }, 'database-mock');
  const cfg = gate.config, owned = new Set();
  const resources = new Set(), disposals = new Set();
  let handle = null, pending = null, closed = false, closeFailed = false;
  function ready() {
    gate.check();
    if (closed) fail('ADAPTER_CLOSED');
    exact(ports, ['credentials', 'open', 'describe', 'operation', 'transaction', 'close']);
    if (Object.values(ports).some(port => typeof port !== 'function')) fail('MISSING_ISOLATION_CONTROL');
    ports = Object.freeze({ ...ports });
  }
  function validateIdentity(identity) {
    exact(identity, ['databaseName', 'host', 'port', 'replicaSet', 'members', 'role', 'actions']);
    if (identity.databaseName !== 'hnc_step15q_sandbox' || identity.host !== '127.0.0.1' || identity.port !== cfg.mongoPort ||
        identity.replicaSet !== cfg.replicaSet || !literalList(identity.members, [`127.0.0.1:${cfg.mongoPort}`]) ||
        identity.role !== 'hnc_synthetic_fixture' || !literalList(identity.actions, ['find', 'insert', 'update'])) fail('ADAPTER_IDENTITY_REJECTED');
  }
  function credentials(value) {
    exact(value, ['username', 'password', 'databaseName', 'role', 'actions']);
    if (value.username !== `synthetic_${cfg.runId}` || typeof value.password !== 'string' ||
        !/^synthetic-offline-[A-Za-z0-9_-]{8,80}$/.test(value.password) || value.databaseName !== 'hnc_step15q_sandbox' ||
        value.role !== 'hnc_synthetic_fixture' || !literalList(value.actions, ['find', 'insert', 'update'])) fail('ADAPTER_CREDENTIAL_SCOPE_REJECTED');
    return Object.freeze({ username: value.username, password: value.password, databaseName: value.databaseName,
      role: value.role, actions: Object.freeze(['find', 'insert', 'update']) });
  }
  const dispose = async resource => {
    if (!resources.delete(resource)) return;
    const work = gate.dispose(ports.close, resource); disposals.add(work);
    try { if (!await work) closeFailed = true; } finally { disposals.delete(work); }
  };
  const closeOwned = async () => { await Promise.all([...resources].map(dispose)); await Promise.all([...disposals]); };
  async function connect() {
    ready();
    if (handle) return Object.freeze({ connected: true, mode: 'synthetic-offline', databaseName: 'hnc_step15q_sandbox' });
    if (pending) return pending;
    pending = gate.run('game-start', async signal => {
      const auth = credentials(await ports.credentials(signal));
      if (signal.aborted || closed) fail('ADAPTER_CANCELLED');
      const resource = await ports.open(Object.freeze({ host: '127.0.0.1', port: cfg.mongoPort,
        replicaSet: cfg.replicaSet, options: cfg.connectionOptions, credentials: auth }), signal);
      if (resource) resources.add(resource);
      try {
        if (!resource || signal.aborted || closed) fail('ADAPTER_CANCELLED');
        validateIdentity(await ports.describe(resource, signal));
        if (signal.aborted || closed) fail('ADAPTER_CANCELLED');
        handle = resource;
        return Object.freeze({ connected: true, mode: 'synthetic-offline', databaseName: 'hnc_step15q_sandbox' });
      } catch (error) { if (resource) await dispose(resource); throw error; }
    }, cfg.connectionTimeoutMs).catch(async error => {
      closed = true; handle = null; await closeOwned(); throw error;
    }).finally(() => { pending = null; });
    return pending;
  }
  function scope(fixtures) {
    return Object.freeze(ownedFixtures(fixtures, owned).map(f => Object.freeze({ kind: f.kind, id: f.data._id })));
  }
  async function execute(workflow, fixtures, transaction) {
    ready();
    if (!gate.harness.scenarios.some(s => s.id === workflow)) fail('ADAPTER_WORKFLOW_REJECTED');
    const records = scope(fixtures);
    if (!handle) fail('ADAPTER_NOT_CONNECTED');
    return gate.run(workflow, async signal => {
      // Recheck before each operation: no reuse after wrong DB/topology/role.
      validateIdentity(await ports.describe(handle, signal));
      if (signal.aborted || closed) fail('ADAPTER_CANCELLED');
      const receipt = await ports[transaction ? 'transaction' : 'operation'](handle, Object.freeze({ workflow,
        runId: cfg.runId, databaseName: 'hnc_step15q_sandbox', fixtures: records, maxTimeMS: cfg.requestTimeoutMs,
        transactionOptions: Object.freeze({ readConcern: Object.freeze({ level: 'snapshot' }),
          writeConcern: Object.freeze({ w: 'majority' }), maxCommitTimeMS: cfg.requestTimeoutMs }) }), signal);
      if (signal.aborted || closed) fail('ADAPTER_CANCELLED');
      exact(receipt, ['accepted', 'matchedCount']);
      if (typeof receipt.accepted !== 'boolean' || ![0, 1].includes(receipt.matchedCount)) fail('ADAPTER_RECEIPT_REJECTED');
      return Object.freeze({ workflow, accepted: receipt.accepted, matchedCount: receipt.matchedCount });
    }).catch(async error => {
      if (error.code === 'ADAPTER_OPERATION_FAILED') { closed = true; handle = null; await closeOwned(); }
      throw error;
    });
  }
  return Object.freeze({ connect,
    fixture(kind) { ready(); const f = gate.harness.fixture(kind); owned.add(f); return f; },
    operation: (workflow, fixtures) => execute(workflow, fixtures, false),
    transaction: (workflow, fixtures) => execute(workflow, fixtures, true),
    cleanupPlan: (target, fixtures) => { ready(); scope(fixtures); return gate.harness.cleanupPlan(target, fixtures); },
    cleanup() { fail('ADAPTER_CLEANUP_DISABLED'); },
    async close() { closed = true; gate.harness.terminate(); handle = null; await closeOwned(); },
    diagnostics: () => Object.freeze({ mode: 'synthetic-offline', closed, closeFailed, ...gate.harness.report() }),
  });
}
module.exports = { createDatabaseIntegrationAdapter };
