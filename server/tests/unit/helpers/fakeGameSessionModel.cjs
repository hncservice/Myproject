'use strict';
// Query-shaped synthetic model. No mongoose/database imports; deterministic memory only.
module.exports = function fakeGameSessionModel() {
  const rows = new Map(); const calls = []; let duplicate = false;
  const clone = value => structuredClone(value);
  const at = (object, key) => key.split('.').reduce((current, part) => current?.[part], object);
  function matches(row, filter) { return Object.entries(filter).every(([key, value]) => {
    const actual = at(row, key);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).every(([operator, threshold]) => operator === '$lte' ? Number(actual) <= Number(threshold) : operator === '$gt' ? Number(actual) > Number(threshold) : false);
    }
    return actual === value;
  }); }
  function update(row, change) { for (const [key, value] of Object.entries(change.$set)) { const parts = key.split('.'); const last = parts.pop(); let object = row; for (const part of parts) object = object[part]; object[last] = clone(value); } }
  function query(filter, one) {
    let limit = 50; let descending = false;
    return { select() { return this; }, sort() { descending = true; return this; }, limit(value) { limit = value; return this; }, async lean() {
      let result = [...rows.values()].filter(row => matches(row, filter)); if (descending) result.sort((a, b) => Number(b.startedAt) - Number(a.startedAt));
      return clone(one ? result[0] || null : result.slice(0, limit));
    } };
  }
  const model = {
    async updateMany(filter, change) { calls.push({ name: 'updateMany', filter, change }); for (const row of rows.values()) if (matches(row, filter)) update(row, change); },
    findOne(filter) { calls.push({ name: 'findOne', filter }); return query(filter, true); },
    async countDocuments(filter) { return [...rows.values()].filter(row => matches(row, filter)).length; },
    async create(document) { calls.push({ name: 'create', document }); if (duplicate || [...rows.values()].some(row => row.userId === document.userId && row.campaignId === document.campaignId && row.gameId === document.gameId && (row.attemptNumber === document.attemptNumber || row.status === 'active'))) throw Object.assign(new Error('duplicate'), { code: 11000 }); rows.set(document._id, clone(document)); return clone(document); },
    async findOneAndUpdate(filter, change) { calls.push({ name: 'findOneAndUpdate', filter, change }); const row = [...rows.values()].find(item => matches(item, filter)); if (!row) return null; update(row, change); return clone(row); },
    async updateOne(filter, change) { calls.push({ name: 'updateOne', filter, change }); const row = [...rows.values()].find(item => matches(item, filter)); if (row) update(row, change); },
    find(filter) { calls.push({ name: 'find', filter }); return query(filter, false); },
  };
  return { model, rows, calls, forceDuplicate() { duplicate = true; } };
};
