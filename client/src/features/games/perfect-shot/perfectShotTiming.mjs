// Pure timing and geometry helpers. No score or prize decision is made here.
const DIFFICULTY = [0.82, 1, 1.15, 1.28, 1.4];
const SAMPLE_TTL_MS = 30000;
const MAX_LEAD_MS = 500;

export function targetAt(elapsedMs, shotIndex, motion = null) {
  const seconds = Math.max(0, elapsedMs) / 1000;
  if (motion && Number.isFinite(motion.phaseX) && Number.isFinite(motion.speedX)) {
    return {
      x: 50 + Math.sin(seconds * motion.speedX + motion.phaseX) * motion.amplitudeX,
      y: 45 + Math.sin(seconds * motion.speedY + motion.phaseY) * motion.amplitudeY,
    };
  }
  const speed = DIFFICULTY[Math.max(0, Math.min(shotIndex, 4))];
  return {
    x: 50 + Math.sin(seconds * 2.25 * speed + shotIndex * 1.12) * 35,
    y: 45 + Math.sin(seconds * 1.38 * speed + shotIndex * 0.89) * 22,
  };
}

export function createServerClock({ monotonic = () => performance.now(), wallNow = () => Date.now() } = {}) {
  let samples = [];
  let anchor = null;
  let networkRttMs = 0;
  let processingMs = 0;

  function record(data, sentAt, receivedAt) {
    if (data?.timingVersion !== 1 || !Number.isFinite(data.serverNow) ||
        !Number.isFinite(data.serverProcessingMs) || data.serverProcessingMs < 0 ||
        !Number.isFinite(sentAt) || !Number.isFinite(receivedAt) || receivedAt < sentAt) return false;
    const rtt = receivedAt - sentAt;
    // Two milliseconds tolerate integer server timestamp/transport rounding.
    if (rtt > 60000 || data.serverProcessingMs > rtt + 2) return false;
    const network = Math.max(0, rtt - data.serverProcessingMs);
    samples = samples.filter(sample => receivedAt - sample.receivedAt <= SAMPLE_TTL_MS);
    samples.push({ receivedAt, serverAtReceive: data.serverNow + network / 2, network, processing: data.serverProcessingMs });
    samples = samples.slice(-8);
    // The least uncertain recent observation anchors server time.
    anchor = samples.reduce((best, sample) => sample.network <= best.network ? sample : best);
    // A short median follows sustained connection changes without following one spike.
    const recent = samples.slice(-3).map(sample => sample.network).sort((a, b) => a - b);
    networkRttMs = recent[Math.floor((recent.length - 1) / 2)];
    processingMs = data.serverProcessingMs;
    return true;
  }

  return {
    record,
    now: () => anchor ? anchor.serverAtReceive + monotonic() - anchor.receivedAt : wallNow(),
    leadMs: () => Math.min(MAX_LEAD_MS, networkRttMs / 2),
    stats: () => ({ synchronized: Boolean(anchor), networkRttMs, processingMs, predictionMs: Math.min(MAX_LEAD_MS, networkRttMs / 2) }),
  };
}

// The absolute target's coordinate system is the arena padding box, not its outer border.
export function arenaPoint(clientX, clientY, geometry) {
  if (!geometry || !Number.isFinite(clientX) || !Number.isFinite(clientY) ||
      !Number.isFinite(geometry.width) || !Number.isFinite(geometry.height) ||
      geometry.width <= 0 || geometry.height <= 0 ||
      !Number.isFinite(geometry.left) || !Number.isFinite(geometry.top)) return null;
  const x = (clientX - geometry.left) * 100 / geometry.width;
  const y = (clientY - geometry.top) * 100 / geometry.height;
  // Ignore taps on/outside the border rather than turning them into edge shots.
  if (x < 0 || x > 100 || y < 0 || y > 100) return null;
  return { x, y };
}

export function readArenaGeometry(element) {
  const rect = element.getBoundingClientRect();
  const css = getComputedStyle(element);
  const borderLeft = parseFloat(css.borderLeftWidth) || 0;
  const borderRight = parseFloat(css.borderRightWidth) || 0;
  const borderTop = parseFloat(css.borderTopWidth) || 0;
  const borderBottom = parseFloat(css.borderBottomWidth) || 0;
  // The game layout has no rotated/scaled ancestors. CSS zoom is represented by this ratio.
  const localOuterWidth = parseFloat(css.width) || element.offsetWidth;
  const localOuterHeight = parseFloat(css.height) || element.offsetHeight;
  const scaleX = localOuterWidth ? rect.width / localOuterWidth : 1;
  const scaleY = localOuterHeight ? rect.height / localOuterHeight : 1;
  return {
    left: rect.left + borderLeft * scaleX,
    top: rect.top + borderTop * scaleY,
    width: Math.max(0, rect.width - (borderLeft + borderRight) * scaleX),
    height: Math.max(0, rect.height - (borderTop + borderBottom) * scaleY),
    localWidth: Math.max(0, localOuterWidth - borderLeft - borderRight),
    localHeight: Math.max(0, localOuterHeight - borderTop - borderBottom),
  };
}
