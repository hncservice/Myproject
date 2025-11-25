// server/utils/weightedRandom.js
function weightedRandom(items, weightProp = 'probabilityWeight') {
  const total = items.reduce((sum, item) => sum + (item[weightProp] || 0), 0);
  if (total === 0) return null;

  let rnd = Math.random() * total;
  for (const item of items) {
    const w = item[weightProp] || 0;
    if (rnd < w) return item;
    rnd -= w;
  }
  return null;
}

module.exports = weightedRandom;
