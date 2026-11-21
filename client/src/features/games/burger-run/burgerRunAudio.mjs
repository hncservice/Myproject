// One Web Audio context per mounted game. No audio starts before a user action.
export function createBurgerRunAudio(urls, environment = {}) {
  const makeContext = environment.makeContext || (() => {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  });
  const fetchAudio = environment.fetch || ((...args) => globalThis.fetch(...args));
  let context = null, enabled = true, active = false, disposed = false;
  let music = null, musicLoading = false, generation = 0;
  const buffers = new Map(), sources = new Set();
  function stopMusic() {
    if (music) { try { music.stop(); } catch { /* Already stopped. */ } music = null; }
  }
  function stopEffects() { for (const source of sources) { try { source.stop(); } catch { /* Ended. */ } } sources.clear(); }
  function ensureContext() {
    if (disposed) return null;
    try { context ||= makeContext(); return context; } catch { return null; }
  }
  async function buffer(name) {
    if (!urls[name] || !context) return null;
    if (!buffers.has(name)) {
      const pending = fetchAudio(urls[name]).then(response => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes));
      buffers.set(name, pending);
      pending.catch(() => { if (buffers.get(name) === pending) buffers.delete(name); });
    }
    return buffers.get(name);
  }
  async function syncMusic() {
    if (!context || disposed || !enabled || !active || music || musicLoading) return;
    musicLoading = true;
    try {
      const decoded = await buffer('background');
      if (!decoded || disposed || !enabled || !active || context.state !== 'running' || music) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = decoded; source.loop = true; gain.gain.value = 0.30;
      source.connect(gain); gain.connect(context.destination); music = source;
      source.onended = () => { source.disconnect(); gain.disconnect(); if (music === source) music = null; };
      source.start();
    } catch { /* Missing audio must never interrupt gameplay. */ }
    finally { musicLoading = false; }
  }
  function resumeFromGesture() {
    const ctx = ensureContext();
    if (!ctx || !enabled) return;
    try {
      void Promise.resolve(ctx.resume()).then(() => { if (!disposed) void syncMusic(); }).catch(() => {});
      for (const name of Object.keys(urls)) void buffer(name).catch(() => {});
    } catch { /* Audio is optional. */ }
  }
  async function play(name) {
    if (!context || !enabled || disposed) return;
    const requestGeneration = generation;
    try {
      const decoded = await buffer(name);
      if (!decoded || disposed || !enabled || requestGeneration !== generation || context.state !== 'running') return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = decoded; gain.gain.value = name === 'hit' ? 0.45 : 0.55;
      source.connect(gain); gain.connect(context.destination); sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); };
      source.start();
    } catch { /* Audio failures must never affect session or score. */ }
  }
  function jump() {
    if (!context || !enabled || !active || disposed || context.state !== 'running') return;
    try {
      const source = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
      source.type = 'sine'; source.frequency.setValueAtTime(330, now); source.frequency.exponentialRampToValueAtTime(720, now + 0.10);
      gain.gain.setValueAtTime(0.001, now); gain.gain.exponentialRampToValueAtTime(0.10, now + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      source.connect(gain); gain.connect(context.destination); sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(now); source.stop(now + 0.14);
    } catch { /* Audio is optional. */ }
  }
  return {
    begin() { generation++; stopEffects(); active = true; resumeFromGesture(); void play('start'); },
    setActive(value) { active = Boolean(value); if (!active) stopMusic(); else void syncMusic(); },
    setEnabled(value) {
      enabled = Boolean(value); generation++;
      if (!enabled) { stopMusic(); stopEffects(); }
      else resumeFromGesture();
    },
    unlock: resumeFromGesture,
    play,
    jump,
    dispose() {
      disposed = true; generation++; stopMusic(); stopEffects(); buffers.clear();
      if (context) { try { void Promise.resolve(context.close()).catch(() => {}); } catch { /* Closed. */ } }
    },
  };
}
