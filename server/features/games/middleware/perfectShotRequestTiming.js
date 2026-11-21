'use strict';

const { performance } = require('node:perf_hooks');

function capturePerfectShotRequestTiming(req, _res, next) {
  const path = `${req.baseUrl || ''}${req.path || ''}`;
  const relevant = (req.method === 'POST' && /^\/api\/games\/perfect-shot\/(?:next|shoot)\/?$/i.test(path)) ||
    (req.method === 'GET' && /^\/api\/games\/perfect-shot\/timing\/?$/i.test(path));

  if (relevant) {
    if (!req.perfectShotRequestTiming) {
      Object.defineProperty(req, 'perfectShotRequestTiming', {
        value: Object.freeze({ receivedAtMs: Date.now(), monotonicStartedMs: performance.now() }),
        writable: false,
        configurable: false,
      });
    }
    // This is a server-created property; client JSON/headers are never consulted.
    req.perfectShotRouteEnteredMs = req.perfectShotRequestTiming.receivedAtMs;
  }
  return next();
}

function responseTiming(req) {
  const capture = req.perfectShotRequestTiming;
  return {
    timingVersion: 1,
    serverNow: Date.now(),
    serverProcessingMs: capture
      ? Math.max(0, performance.now() - capture.monotonicStartedMs)
      : null,
  };
}

module.exports = { capturePerfectShotRequestTiming, responseTiming };
