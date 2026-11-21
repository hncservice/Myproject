const VERSION = 1;
const RULES = Object.freeze({ hz: 60, maxTicks: 5400, maxInputs: 256, width: 4800, ground: 390, playerW: 44, playerH: 58, requiredFood: 10, maxHearts: 3 });
function level(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_LEVEL_SEED');
  let n = seed >>> 0;
  const next = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  return {
    foods: Array.from({ length: 25 }, (_, i) => ({ id: i, x: 210 + i * 175 + Math.floor(next() * 30), y: RULES.ground - (i % 3 === 1 ? 120 : 42), kind: i % 3 })),
    obstacles: [880, 1320, 1710, 2490, 2940, 3360, 4110].map((x, i) => ({ x: x + Math.floor(next() * 25), w: i === 1 ? 72 : 44, h: i === 1 ? 14 : 42, moving: i === 4, kind: i === 1 ? 'spill' : i === 4 ? 'barrier' : 'crate' })),
    platforms: [{ x: 550, y: 310, w: 160 }, { x: 1930, y: 295, w: 190 }, { x: 3630, y: 310, w: 180 }],
    finish: 4650,
  };
}
function create(seed) {
  return { version: VERSION, seed, tick: 0, x: 60, y: RULES.ground - RULES.playerH, vx: 0, vy: 0, grounded: true, coyote: 6, jumpBuffer: 0, previous: 0, hearts: 3, invulnerable: 0, collected: [], phase: 'playing', score: 0 };
}
function obstacleX(obstacle, tick) {
  if (!obstacle.moving) return obstacle.x;
  const t = tick % 180;
  return obstacle.x + (t < 90 ? t : 180 - t) * 0.6 - 27;
}
function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function step(s, mask, world) {
  if (s.phase !== 'playing') return s;
  const direction = (mask & 2 ? 1 : 0) - (mask & 1 ? 1 : 0);
  if ((mask & 4) && !(s.previous & 4)) s.jumpBuffer = 6;
  s.previous = mask;
  if (s.grounded) s.coyote = 6; else s.coyote = Math.max(0, s.coyote - 1);
  if (s.jumpBuffer > 0 && s.coyote > 0) { s.vy = -11.5; s.grounded = false; s.coyote = 0; s.jumpBuffer = 0; }
  else s.jumpBuffer = Math.max(0, s.jumpBuffer - 1);
  s.vx = direction ? Math.max(-4.2, Math.min(4.2, s.vx + direction * 0.65)) : s.vx * 0.72;
  const oldBottom = s.y + RULES.playerH;
  s.x = Math.max(0, Math.min(RULES.width - RULES.playerW, s.x + s.vx));
  s.vy = Math.min(14, s.vy + 0.55); s.y += s.vy;
  s.grounded = false;
  if (s.vy >= 0) {
    for (const platform of world.platforms) {
      if (s.x + RULES.playerW > platform.x && s.x < platform.x + platform.w && oldBottom <= platform.y + 0.01 && s.y + RULES.playerH >= platform.y) {
        s.y = platform.y - RULES.playerH; s.vy = 0; s.grounded = true; break;
      }
    }
    if (s.y + RULES.playerH >= RULES.ground) { s.y = RULES.ground - RULES.playerH; s.vy = 0; s.grounded = true; }
  }
  const player = { x: s.x + 5, y: s.y + 4, w: RULES.playerW - 10, h: RULES.playerH - 5 };
  s.invulnerable = Math.max(0, s.invulnerable - 1);
  for (const food of world.foods) {
    if (!s.collected.includes(food.id) && overlaps(player, { x: food.x - 13, y: food.y - 16, w: 26, h: 32 })) s.collected.push(food.id);
  }
  s.score = s.collected.length * 10;
  for (const obstacle of world.obstacles) {
    if (!s.invulnerable && overlaps(player, { x: obstacleX(obstacle, s.tick), y: RULES.ground - obstacle.h, w: obstacle.w, h: obstacle.h })) {
      s.hearts--; s.invulnerable = 75;
      if (s.hearts <= 0) s.phase = 'lost';
      break;
    }
  }
  s.tick++;
  if (s.phase === 'playing' && s.x >= world.finish) s.phase = s.collected.length >= RULES.requiredFood ? 'won' : 'lost';
  if (s.tick >= RULES.maxTicks && s.phase === 'playing') s.phase = 'lost';
  return s;
}
function validateTrace(ticks, inputs) {
  if (!Number.isSafeInteger(ticks) || ticks < 1 || ticks > RULES.maxTicks || !Array.isArray(inputs) || inputs.length < 1 || inputs.length > RULES.maxInputs) throw new Error('INVALID_REPLAY');
  let last = -1;
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isSafeInteger(entry[0]) || entry[0] <= last || entry[0] >= ticks || !Number.isInteger(entry[1]) || entry[1] < 0 || entry[1] > 7) throw new Error('INVALID_REPLAY');
    last = entry[0];
  }
  if (inputs[0][0] !== 0) throw new Error('INVALID_REPLAY');
}
function replay(seed, ticks, inputs) {
  validateTrace(ticks, inputs);
  const world = level(seed), state = create(seed);
  let index = 0, mask = 0;
  for (let t = 0; t < ticks; t++) {
    if (index < inputs.length && inputs[index][0] === t) mask = inputs[index++][1];
    if (state.phase !== 'playing') throw new Error('REPLAY_AFTER_FINISH');
    step(state, mask, world);
  }
  return state;
}
function summary(s) { return { ticks: s.tick, score: s.score, food: s.collected.length, hearts: s.hearts, phase: s.phase }; }

export { VERSION, RULES, level, create, obstacleX, step, replay, summary, validateTrace };
