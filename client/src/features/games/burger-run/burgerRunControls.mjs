export const ACTION_BITS = Object.freeze({ left: 1, right: 2, jump: 4 });

// Each finger/key owns a source. Releasing one never releases another source.
export function createRunnerInput() {
  const sources = new Map();
  let jumpTicks = 0;
  function peekMask() {
    let mask = jumpTicks > 0 ? ACTION_BITS.jump : 0;
    for (const bits of sources.values()) mask |= bits;
    return mask;
  }
  return {
    set(source, action) {
      if (Object.hasOwn(ACTION_BITS, action)) sources.set(source, ACTION_BITS[action]);
    },
    remove(source) { sources.delete(source); },
    queueJump() { jumpTicks = 8; },
    peekMask,
    nextMask() { const mask = peekMask(); jumpTicks = Math.max(0, jumpTicks - 1); return mask; },
    clear() { sources.clear(); jumpTicks = 0; },
  };
}

// Upward intent: >=28 CSS pixels, predominantly vertical, within 700 ms.
// Recognize during movement rather than waiting for finger release.
export function createSwipeJump() {
  const pointers = new Map();
  return {
    start(id, x, y, time) { pointers.set(id, { x, y, time, fired: false }); },
    move(id, x, y, time) {
      const p = pointers.get(id);
      if (!p || p.fired || time < p.time || time - p.time > 700) return false;
      const up = p.y - y, across = Math.abs(x - p.x);
      if (up >= 28 && up > across * 1.25) { p.fired = true; return true; }
      return false;
    },
    end(id) { pointers.delete(id); },
    clear() { pointers.clear(); },
  };
}
