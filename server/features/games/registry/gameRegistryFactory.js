'use strict';

function fail(code, message) {
  return Object.assign(new Error(message), { code, status: 400 });
}

const dangerous = new Set(['__proto__', 'prototype', 'constructor']);

// Copy and freeze JSON data. Reject accessors before reading property values.
function immutableData(value, { maxBytes = 16384 } = {}) {
  let nodes = 0;

  function copy(input, depth) {
    if (++nodes > 2048 || depth > 12) {
      throw fail('INPUT_LIMIT', 'Data exceeds structural limits');
    }

    if (input === null || typeof input === 'boolean') {
      return input;
    }

    if (typeof input === 'string') {
      if (input.length > maxBytes) {
        throw fail('INPUT_LIMIT', 'String exceeds limits');
      }

      return input;
    }

    if (typeof input === 'number' && Number.isFinite(input)) {
      return input;
    }

    if (!input || typeof input !== 'object') {
      throw fail('INVALID_DATA', 'Expected finite JSON data');
    }

    const array = Array.isArray(input);
    const proto = Object.getPrototypeOf(input);

    if (!array && proto !== null && Object.getPrototypeOf(proto) !== null) {
      throw fail('INVALID_DATA', 'Expected plain data');
    }

    const output = array ? [] : {};

    for (const key of Reflect.ownKeys(input)) {
      if (array && key === 'length') {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(input, key);

      if (
        typeof key !== 'string' ||
        dangerous.has(key) ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value') ||
        (array && !/^(0|[1-9]\d*)$/.test(key))
      ) {
        throw fail('INVALID_DATA', 'Unsafe data property');
      }

      output[key] = copy(descriptor.value, depth + 1);
    }

    if (
      array &&
      (
        output.length !== input.length ||
        Reflect.ownKeys(input).length - 1 !== input.length
      )
    ) {
      throw fail('INVALID_DATA', 'Sparse arrays are not supported');
    }

    return Object.freeze(output);
  }

  const result = copy(value, 0);

  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > maxBytes) {
    throw fail('INPUT_LIMIT', 'Data exceeds byte limit');
  }

  return result;
}

function record(value, fields, code = 'INVALID_REGISTRATION') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw fail(code, 'Expected record');
  }

  const proto = Object.getPrototypeOf(value);

  if (proto !== null && Object.getPrototypeOf(proto) !== null) {
    throw fail(code, 'Expected plain record');
  }

  for (const key of Reflect.ownKeys(value)) {
    const prop = Object.getOwnPropertyDescriptor(value, key);

    if (
      typeof key !== 'string' ||
      dangerous.has(key) ||
      !fields.includes(key) ||
      !Object.hasOwn(prop, 'value') ||
      !prop.enumerable
    ) {
      throw fail(code, 'Unknown or unsafe field');
    }
  }
}

function createGameRegistry({ approvedGameIds, definitions } = {}) {
  if (
    !Array.isArray(approvedGameIds) ||
    !Array.isArray(definitions) ||
    !approvedGameIds.length ||
    approvedGameIds.length > 32
  ) {
    throw fail('INVALID_REGISTRATION', 'Explicit approved game identifiers required');
  }

  const validId = (value) =>
    typeof value === 'string' &&
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 48 &&
    !dangerous.has(value);

  if (
    !approvedGameIds.every(validId) ||
    new Set(approvedGameIds).size !== approvedGameIds.length
  ) {
    throw fail('INVALID_REGISTRATION', 'Invalid approved identifiers');
  }

  const games = new Map();

  for (const definition of definitions) {
    const fields = [
      'id',
      'version',
      'execution',
      'config',
      'actions',
      'limits',
      'handlers',
      'preliminaryDecisions',
    ];

    record(definition, fields);

    if (fields.some((field) => !Object.hasOwn(definition, field))) {
      throw fail('INVALID_REGISTRATION', 'Complete registration required');
    }

    const { id, version, execution, handlers } = definition;

    if (!validId(id) || !approvedGameIds.includes(id) || games.has(id)) {
      throw fail('UNAPPROVED_GAME', 'Unapproved or duplicate game');
    }

    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !['legacy', 'verified-evidence'].includes(execution) ||
      typeof definition.preliminaryDecisions !== 'boolean'
    ) {
      throw fail('INVALID_REGISTRATION', 'Invalid game version or capabilities');
    }

    const config = immutableData(definition.config);

    if (
      config.id !== id ||
      typeof config.label !== 'string' ||
      !config.label.trim() ||
      config.label.length > 100 ||
      !Number.isSafeInteger(config.maxAttempts) ||
      config.maxAttempts < 1 ||
      config.maxAttempts > 3 ||
      !Number.isSafeInteger(config.sessionTtlMs) ||
      config.sessionTtlMs < 1 ||
      config.sessionTtlMs > 86400000
    ) {
      throw fail('INVALID_REGISTRATION', 'Invalid lifecycle configuration');
    }

    const actions = immutableData(definition.actions);

    if (
      !Array.isArray(actions) ||
      !actions.length ||
      actions.length > 16 ||
      !actions.every(validId) ||
      new Set(actions).size !== actions.length
    ) {
      throw fail('INVALID_REGISTRATION', 'Invalid actions');
    }

    record(definition.limits, ['maxEvidenceBytes', 'maxEvents']);
    const limits = immutableData(definition.limits);

    if (
      !Number.isSafeInteger(limits.maxEvidenceBytes) ||
      limits.maxEvidenceBytes < 1 ||
      limits.maxEvidenceBytes > 16384 ||
      !Number.isSafeInteger(limits.maxEvents) ||
      limits.maxEvents < 1 ||
      limits.maxEvents > 100
    ) {
      throw fail('INVALID_REGISTRATION', 'Invalid evidence limits');
    }

    const names = execution === 'legacy'
      ? [
          'validateConfig',
          'verify',
          'assessIntegrity',
          'assessBehavior',
        ]
      : [
          'validateConfig',
          'initialize',
          'validateEvidence',
          'apply',
          'verify',
          'present',
          'assessIntegrity',
          'assessBehavior',
        ];

    record(handlers, names);

    if (
      names.some(
        (name) => !Object.hasOwn(handlers, name) || typeof handlers[name] !== 'function'
      )
    ) {
      throw fail('INVALID_REGISTRATION', 'Server validation handlers required');
    }

    if (handlers.validateConfig(config) !== true) {
      throw fail('INVALID_REGISTRATION', 'Game-specific configuration rejected');
    }

    games.set(
      id,
      Object.freeze({
        id,
        version,
        execution,
        config,
        actions,
        limits,
        handlers: Object.freeze({ ...handlers }),
        capabilities: Object.freeze({
          sessions: true,
          expiry: true,
          serverVerification: true,
          reporting: true,
          recovery: true,
          audit: true,
          preliminaryDecisions: definition.preliminaryDecisions,
        }),
      })
    );
  }

  if (games.size !== approvedGameIds.length) {
    throw fail('INVALID_REGISTRATION', 'Every approved game requires a definition');
  }

  const list = Object.freeze([...games.values()]);
  const discovery = Object.freeze(
    list.map(({ handlers, ...metadata }) => immutableData(metadata))
  );

  const find = (id) =>
    typeof id === 'string' ? games.get(id) || null : null;

  return Object.freeze({
    list: () => list,
    discover: () => discovery,
    find,

    require(id) {
      const game = find(id);

      if (!game) {
        throw fail('UNKNOWN_GAME', 'Unknown game');
      }

      return game;
    },
  });
}

module.exports = {
  createGameRegistry,
  immutableData,
  record,
  fail,
};