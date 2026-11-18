import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../authentication/context/AuthContext';
import axiosInstance from '../../../shared/api/axiosInstance';
import PrizeDecisionPanel from '../components/PrizeDecisionPanel';
import '../styles/PerfectShotGame.css';
import perfectShotBg from '../../../assets/sounds/perfectshotbg.mp3';
import tapSound from '../../../assets/sounds/tap.mp3';

const PERFECT_SHOT_STYLES = String.raw`
  .ps-page, .ps-page * { box-sizing: border-box; }

  .ps-page {
    min-height: 100vh;
    min-height: 100dvh;
    padding: 20px 14px 32px;
    background: radial-gradient(ellipse at 50% 0%, #1b2747, #090f21 54%, #050916);
    color: #eef4ff;
    font-family: Inter, system-ui, sans-serif;
    display: flex;
    justify-content: center;
  }

  .ps-shell { width: min(100%, 550px); }
  .ps-header, .ps-brand { display: flex; align-items: center; }
  .ps-header { justify-content: space-between; margin-bottom: 18px; }
  .ps-brand { gap: 12px; }

  .ps-brand-emblem {
    display: grid;
    place-items: center;
    font-size: 17px;
    font-weight: 1000;
    background: #f0443e;
    border: 2px solid #ff8580;
    color: #fff;
    width: 57px;
    height: 57px;
    border-radius: 17px;
    box-shadow: 0 6px 28px #ed3c3750;
  }

  .ps-brand-title {
    display: flex;
    flex-direction: column;
    font-size: 23px;
    line-height: 1.07;
    letter-spacing: 1.2px;
    font-weight: 950;
  }

  .ps-brand-title strong { color: #fb554b; }

  .ps-brand-title small {
    font-size: 10px;
    color: #9daecb;
    letter-spacing: 2.2px;
    margin-top: 6px;
  }

  .ps-sound {
    border: 1px solid #314268;
    background: #18233a;
    border-radius: 13px;
    width: 47px;
    height: 47px;
    cursor: pointer;
    font-size: 20px;
    color: #fff;
  }

  .ps-sound:focus-visible, .ps-primary:focus-visible, .ps-arena:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 3px;
  }

  .ps-status {
    display: grid;
    grid-template-columns: 1.2fr 1fr .8fr;
    gap: 9px;
    margin-bottom: 19px;
  }

  .ps-stat {
    padding: 13px 10px 12px;
    border: 1px solid #2a3754;
    background: #121d34;
    border-radius: 15px;
    min-width: 0;
  }

  .ps-stat > span {
    display: block;
    color: #a2b0cc;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.2px;
    margin-bottom: 5px;
  }

  .ps-stat > strong {
    display: block;
    font-size: 24px;
    color: #fff;
    font-weight: 900;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ps-stat .ps-player { font-size: 17px; }
  .ps-stat strong small { font-size: 12px; color: #8699b9; }

  .ps-headline {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 9px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
    margin-bottom: 11px;
    color: #bfcee7;
  }

  .ps-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #fb574e;
    box-shadow: 0 0 15px #f54c46;
  }

  .ps-arena {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 1;
    max-height: 520px;
    border: 2px solid #354565;
    border-radius: 26px;
    background: radial-gradient(ellipse at center, #152b4d, #0d1931 70%);
    box-shadow: 0 16px 45px #0007, inset 0 0 80px #09182b;
    user-select: none;
    touch-action: manipulation;
  }

  .ps-arena--aiming { cursor: crosshair; }

  .ps-grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(#4e709f1a 1px, transparent 1px),
      linear-gradient(90deg, #4e709f1a 1px, transparent 1px);
    background-size: 38px 38px;
  }

  .ps-arena::after {
    content: '';
    position: absolute;
    pointer-events: none;
    inset: 11px;
    border: 1px solid #698ab52b;
    border-radius: 19px;
  }

  .ps-arena-label {
    position: absolute;
    color: #55759e;
    font-size: 9px;
    letter-spacing: 2px;
    font-weight: 900;
    left: 20px;
    top: 22px;
  }

  .ps-target {
    position: absolute;
    z-index: 2;
    transform: translate(-50%, -50%);
    width: 15.2%;
    height: 15.2%;
    filter: drop-shadow(0 0 17px #f74e6070);
    will-change: left, top;
    pointer-events: none;
  }

  .ps-target-ring { border-radius: 100%; display: grid; place-items: center; }

  .ps-target-ring--outer {
    width: 100%;
    height: 100%;
    background: #f5f9ff;
    border: 4px solid #f4433d;
    box-shadow: 0 0 0 5px #f3474e35;
  }

  .ps-target-ring--middle {
    width: 67%;
    height: 67%;
    background: #f44842;
    border: 4px solid #fff;
  }

  .ps-target-ring--inner {
    width: 55%;
    height: 55%;
    background: #f6c846;
    box-shadow: 0 0 9px #f6c846;
  }

  .ps-marker {
    position: absolute;
    z-index: 4;
    transform: translate(-50%, -50%);
    font-size: 39px;
    font-weight: 1000;
    line-height: 1;
    text-shadow: 0 0 10px #000;
    pointer-events: none;
  }

  .ps-marker--miss { color: #8296af; }
  .ps-marker--perfect { color: #ffd45b; }
  .ps-marker--great, .ps-marker--hit { color: #fff; }

  .ps-overlay {
    position: absolute;
    z-index: 6;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 22px;
    text-align: center;
    background: linear-gradient(180deg, #061126bd, #071025e6);
    backdrop-filter: blur(4px);
  }

  .ps-overlay-icon { font-size: 76px; filter: drop-shadow(0 0 35px #f4444555); }

  .ps-overlay h1 {
    font-size: clamp(33px, 8vw, 51px);
    font-weight: 1000;
    line-height: 1.05;
    letter-spacing: -1px;
    margin: 14px 0;
  }

  .ps-overlay h1 em { font-style: normal; color: #ff645a; }
  .ps-overlay p { font-size: 15px; line-height: 1.55; color: #b9c8e0; margin: 0 0 24px; }

  .ps-primary {
    min-width: 205px;
    border: 0;
    border-radius: 14px;
    padding: 16px 23px;
    background: linear-gradient(130deg, #fa594a, #d82429);
    color: #fff;
    font-size: 14px;
    font-weight: 950;
    letter-spacing: 1px;
    cursor: pointer;
    box-shadow: 0 12px 36px #ed403959;
    transition: transform .2s, filter .2s;
  }

  .ps-primary:hover { transform: translateY(-2px); filter: brightness(1.1); }
  .ps-primary:disabled { opacity: .55; cursor: not-allowed; transform: none; }
  .ps-primary span { margin-left: 12px; font-size: 19px; }

  .ps-feedback {
    position: absolute;
    z-index: 5;
    top: 40%;
    left: 0;
    right: 0;
    text-align: center;
    color: #fff;
    font-size: clamp(22px, 6vw, 34px);
    font-weight: 950;
    text-shadow: 0 3px 15px #000b;
    pointer-events: none;
    animation: ps-pop .25s ease-out;
  }

  .ps-feedback small { display: block; color: #ffc85e; font-size: 15px; margin-top: 5px; }
  .ps-trophy { font-size: 60px; }
  .ps-finish-caption { letter-spacing: 3px; font-size: 11px !important; margin: 7px 0 !important; }
  .ps-finish h1 { font-size: 70px; color: #fff; margin: 2px 0 8px; }
  .ps-finish h1 small { font-size: 18px; color: #8ea4c9; }
  .ps-finish-stats { display: flex; gap: 28px; margin: 0 0 20px; color: #c1cde0; }

  .ps-finish-stats span {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .ps-finish-stats strong { font-size: 27px; color: #fff; }
  .ps-finish .ps-small { font-size: 13px; color: #a2b8d7; margin-bottom: 16px; }
  .ps-timer-row { margin-top: 18px; }

  .ps-timer-label {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    letter-spacing: 1.6px;
    font-weight: 850;
    color: #aebed9;
  }

  .ps-timer-label strong { font-size: 20px; letter-spacing: 0; color: #fff; }

  .ps-time-track {
    height: 7px;
    margin-top: 8px;
    overflow: hidden;
    border-radius: 10px;
    background: #2b3853;
  }

  .ps-time-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59647, #fa4d42);
    border-radius: 10px;
    transition: width .05s linear;
  }

  .ps-shot-dots { display: flex; justify-content: center; gap: 12px; margin: 21px 0; }

  .ps-shot-dot {
    width: 39px;
    height: 39px;
    border: 1px solid #34415d;
    color: #7186a8;
    background: #17233b;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 900;
  }

  .ps-shot-dot--active { border-color: #f34d44; color: #fff; box-shadow: 0 0 0 4px #f4494224; }
  .ps-shot-dot--hit { background: #168954; border-color: #44df88; color: #fff; }
  .ps-shot-dot--miss { background: #753543; border-color: #fa697e; color: #fff; }

  .ps-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 16px;
    border: 1px solid #283857;
    border-radius: 15px;
    background: #111c32;
  }

  .ps-footer strong { font-size: 11px; color: #fff; letter-spacing: 1px; }

  .ps-footer p {
    margin: 5px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #a1b1cb;
    max-width: 300px;
  }

  .ps-point-legend {
    display: flex;
    gap: 10px;
    white-space: nowrap;
    color: #bac8dc;
    font-size: 11px;
    font-weight: 800;
  }

  .ps-point-legend span { display: flex; align-items: center; gap: 4px; }
  .ps-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .ps-dot--gold { background: #ffc94e; }
  .ps-dot--red { background: #f54e47; }
  .ps-dot--blue { background: #aec7ff; }
  .ps-notice { color: #7184a5; text-align: center; font-size: 11px; margin: 14px 0 0; }
  .ps-attempts { margin: 0 0 12px; font-size: 12px; color: #c2cfe6; text-align: center; }

  .ps-error {
    margin: 10px 0;
    padding: 12px;
    border: 1px solid #e45e64;
    border-radius: 10px;
    color: #ffd4d4;
    background: #501a2980;
  }

  @keyframes ps-pop {
    from { transform: scale(.7); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @media (max-width: 480px) {
    .ps-page { padding: 12px 10px 24px; }
    .ps-header { margin-bottom: 12px; }
    .ps-brand-emblem { height: 45px; width: 45px; font-size: 14px; border-radius: 12px; }
    .ps-brand-title { font-size: 19px; }
    .ps-brand-title small { font-size: 8px; letter-spacing: 1.4px; }
    .ps-sound { width: 43px; height: 43px; }
    .ps-status { gap: 7px; margin-bottom: 15px; }
    .ps-stat { padding: 10px 9px; }
    .ps-stat > strong { font-size: 20px; }
    .ps-stat .ps-player { font-size: 14px; }
    .ps-headline { font-size: 10px; letter-spacing: 1.4px; }
    .ps-arena { border-radius: 20px; }
    .ps-footer { align-items: flex-start; flex-direction: column; }
    .ps-overlay-icon { font-size: 60px; }
    .ps-overlay p { font-size: 13px; }
    .ps-primary { padding: 13px 17px; }
    .ps-finish h1 { font-size: 57px; }
  }

  @media (max-width: 360px) {
    .ps-brand-title { font-size: 17px; }
    .ps-shot-dots { gap: 9px; }
    .ps-shot-dot { width: 33px; height: 33px; }
    .ps-overlay-icon { font-size: 48px; }
    .ps-overlay h1 { margin: 7px 0; font-size: 32px; }
    .ps-overlay p { margin-bottom: 13px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ps-page * { animation: none !important; transition: none !important; }
  }
`;

const DIFFICULTY = [0.82, 1, 1.15, 1.28, 1.4];
const SHOTS = 5;
const TIME_MS = 3500;
const POLL_MS = 150;
const DEFAULT_SCORE_TO_QUALIFY = 320;

const api = {
  status: () => axiosInstance.get('/games/status'),
  session: () => axiosInstance.get('/games/perfect-shot/session'),
  history: () => axiosInstance.get('/games/perfect-shot/history'),
  start: () => axiosInstance.post('/games/perfect-shot/start', {}),
  next: (credentials) => axiosInstance.post('/games/perfect-shot/next', credentials),
  shoot: (payload) => axiosInstance.post('/games/perfect-shot/shoot', payload),
};

const initial = {
  phase: 'ready',
  status: 'idle',
  shot: 0,
  score: 0,
  hits: 0,
  perfects: 0,
  history: [],
  outcome: null,
  shotStartedAt: null,
  shotExpiresAt: null,
  nextShotAt: null,
  shotTimeMs: TIME_MS,
  motion: null,
  totalShots: SHOTS,
  scoreToQualify: DEFAULT_SCORE_TO_QUALIFY,
};

function targetAt(elapsedMs, shotIndex, motion = null) {
  const t = Math.max(0, elapsedMs) / 1000;

  if (motion && Number.isFinite(motion.phaseX) && Number.isFinite(motion.speedX)) {
    return {
      x: 50 + Math.sin(t * motion.speedX + motion.phaseX) * motion.amplitudeX,
      y: 45 + Math.sin(t * motion.speedY + motion.phaseY) * motion.amplitudeY,
    };
  }

  // Support sessions created before randomized motion.
  const speed = DIFFICULTY[Math.max(0, Math.min(shotIndex, 4))];

  return {
    x: 50 + Math.sin(t * 2.25 * speed + shotIndex * 1.12) * 35,
    y: 45 + Math.sin(t * 1.38 * speed + shotIndex * 0.89) * 22,
  };
}

function errInfo(error) {
  return {
    code: error?.response?.data?.code || '',
    message: error?.response?.data?.message || error?.message || 'Request failed',
  };
}

export default function PerfectShotGame({ playerName, onFinish }) {
  const { profile } = useAuth();
  const name = profile?.name || playerName || 'Player';

  const [game, setGame] = useState(initial);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [locked, setLocked] = useState(false);
  const [hasPrize, setHasPrize] = useState(false);
  const [hasActive, setHasActive] = useState(false);
  const [completedPrizeSession, setCompletedPrizeSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [target, setTarget] = useState({ x: 50, y: 45 });
  const [timeLeft, setTimeLeft] = useState(TIME_MS / 1000);
  const [marker, setMarker] = useState(null);
  const [muted, setMuted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [practiceMode, setPracticeMode] = useState(false);
  const [practicePosition, setPracticePosition] = useState({ x: 50, y: 45 });

  const practiceFrameRef = useRef(null);
  const practiceOriginRef = useRef(0);
  const practiceMotionRef = useRef({
    phaseX: 0.4,
    phaseY: 1.8,
    speedX: 2.1,
    speedY: 1.4,
    amplitudeX: 34,
    amplitudeY: 20,
  });

  const arenaRef = useRef(null);
  const targetRef = useRef(null);
  const serverClockOffsetRef = useRef(0);
  const clockSyncedRef = useRef(false);
  const recentLatencyRef = useRef(0);
  const sessionRef = useRef(null);
  const liveRef = useRef(false);
  const busyRef = useRef(false);
  const startBusyRef = useRef(false);
  const pollingRef = useRef(false);
  const revisionRef = useRef(0);
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const tapSoundRef = useRef(null);
  const backgroundMusicRef = useRef(null);
  const latestRef = useRef(initial);
  const onFinishRef = useRef(onFinish);
  const pollRef = useRef(null);

  const serverNowMs = useCallback(
    () => Date.now() + serverClockOffsetRef.current,
    []
  );

  const calibrateClock = useCallback((serverNow, sentAt, receivedAt) => {
    if (!Number.isFinite(serverNow)) return;

    const rtt = Math.max(0, receivedAt - sentAt);
    const measuredOffset = serverNow - receivedAt;

    if (
      !clockSyncedRef.current ||
      rtt < recentLatencyRef.current ||
      recentLatencyRef.current === 0
    ) {
      serverClockOffsetRef.current = measuredOffset;
      recentLatencyRef.current = rtt;
      clockSyncedRef.current = true;
    }

    if (import.meta.env.DEV) {
      console.debug('PERFECT SHOT CLOCK', {
        offsetMs: Math.round(serverClockOffsetRef.current),
        rttMs: rtt,
      });
    }
  }, []);

  useEffect(() => {
    if (!practiceMode) return undefined;

    practiceOriginRef.current = performance.now();

    const tick = () => {
      setPracticePosition(
        targetAt(performance.now() - practiceOriginRef.current, 0, practiceMotionRef.current)
      );
      practiceFrameRef.current = requestAnimationFrame(tick);
    };

    practiceFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (practiceFrameRef.current != null) {
        cancelAnimationFrame(practiceFrameRef.current);
      }
    };
  }, [practiceMode]);

  const practiceClick = (event) => {
    const arena = arenaRef.current?.getBoundingClientRect();
    const element = targetRef.current?.getBoundingClientRect();

    if (!arena || !element) return;

    const x = ((event.clientX - arena.left) / arena.width) * 100;
    const y = ((event.clientY - arena.top) / arena.height) * 100;
    const renderedTarget = {
      x: ((element.left + element.width / 2 - arena.left) / arena.width) * 100,
      y: ((element.top + element.height / 2 - arena.top) / arena.height) * 100,
    };

    const distancePixels = Math.hypot(x - renderedTarget.x, y - renderedTarget.y) * 5;
    const points = distancePixels <= 11 ? 100 : distancePixels <= 23 ? 70 : distancePixels <= 38 ? 40 : 0;
    const category = points === 100 ? 'perfect' : points === 70 ? 'great' : points === 40 ? 'hit' : 'miss';
    const label = {
      perfect: 'PERFECT!',
      great: 'GREAT SHOT!',
      hit: 'NICE HIT!',
      miss: 'MISSED!',
    }[category];

    console.info('PERFECT SHOT PRACTICE (NO API, NO ATTEMPT)', {
      click: { x, y },
      renderedTarget,
      distancePixels,
      points,
      category,
    });

    setMarker({ x, y, category });
    setFeedback(`${label} +${points}`);
  };

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const apply = useCallback((incoming) => {
    if (!incoming) return;
    latestRef.current = incoming;
    setGame(incoming);
  }, []);

  const clearTimers = useCallback(() => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    if (timerRef.current != null) clearTimeout(timerRef.current);
    frameRef.current = null;
    timerRef.current = null;
  }, []);

  const sound = useCallback((success) => {
    if (muted) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = audioRef.current || new AudioCtx();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(success ? 650 : 210, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(success ? 980 : 140, ctx.currentTime + 0.13);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio is optional.
    }
  }, [muted]);

  const applyStatus = useCallback((data) => {
    const thisGame = data?.games?.find((entry) => entry.id === 'perfect-shot');

    if (!thisGame) throw new Error('Perfect Shot is not configured');

    setAttemptsLeft(thisGame.attemptsLeft);
    setLocked(Boolean(thisGame.locked || data.gamesLockedAfterPrize));
    setHasPrize(Boolean(data.hasPrize));
  }, []);

  const refreshStatus = useCallback(async () => {
    const { data } = await api.status();
    applyStatus(data);
  }, [applyStatus]);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.status(),
      api.session(),
      api.history().catch(() => null),
    ])
      .then(([status, session, history]) => {
        if (!active) return;

        applyStatus(status.data);
        setHasActive(Boolean(session.data?.activeSession));

        const items = history?.data?.items;
        const qualifiedSession = Array.isArray(items)
          ? items.find(
              (entry) =>
                entry?.status === 'completed' &&
                entry.outcome === 'qualified' &&
                typeof entry.sessionId === 'string' &&
                /^[a-f0-9]{24}$/i.test(entry.sessionId)
            )
          : null;

        if (qualifiedSession) {
          setCompletedPrizeSession({
            id: qualifiedSession.sessionId,
            restored: true,
          });
        }
      })
      .catch((failure) => {
        if (active) setError(errInfo(failure).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      liveRef.current = false;
      revisionRef.current += 1;
      clearTimers();
    };
  }, [applyStatus, clearTimers]);

  const finished = useCallback(async (data, id) => {
    if (revisionRef.current !== id) return;

    liveRef.current = false;
    clearTimers();

    const completedSessionId = data.sessionId || sessionRef.current?.sessionId;

    setCompletedPrizeSession(
      data.status === 'completed' && data.outcome === 'qualified' && completedSessionId
        ? { id: completedSessionId, restored: false }
        : null
    );

    sessionRef.current = null;
    setHasActive(false);
    setFeedback('');
    setMarker(null);
    apply(data);

    onFinishRef.current?.({
      score: data.score,
      hits: data.hits,
      shots: data.totalShots,
      attempts: data.history,
      outcome: data.outcome,
    });

    try {
      await refreshStatus();
    } catch (failure) {
      setError(errInfo(failure).message);
    }
  }, [apply, clearTimers, refreshStatus]);

  const schedule = useCallback((id, delay = POLL_MS) => {
    if (!liveRef.current || revisionRef.current !== id) return;

    if (timerRef.current != null) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      void pollRef.current?.(id);
    }, Math.max(0, delay));
  }, []);

  const poll = useCallback(async (id) => {
    if (!liveRef.current || revisionRef.current !== id) return;

    if (busyRef.current || pollingRef.current) {
      schedule(id, 100);
      return;
    }

    const credentials = sessionRef.current;
    if (!credentials) return;

    pollingRef.current = true;

    try {
      const sentAt = Date.now();
      const { data } = await api.next(credentials);

      if (!Number.isFinite(data.serverNow) && import.meta.env.DEV) {
        console.warn('Perfect Shot backend /next does not return serverNow.');
      }

      calibrateClock(data.serverNow, sentAt, Date.now());
      if (!liveRef.current || revisionRef.current !== id) return;

      apply(data);

      if (['completed', 'expired', 'cancelled'].includes(data.status)) {
        await finished(data, id);
        return;
      }

      if (data.phase === 'aiming') {
        const wait = new Date(data.shotExpiresAt).getTime() - serverNowMs();
        schedule(id, Math.max(90, wait + 30));
      } else if (data.phase === 'ready') {
        const wait = data.nextShotAt
          ? new Date(data.nextShotAt).getTime() - serverNowMs()
          : 0;

        schedule(id, Math.max(80, wait + 20));
      } else {
        schedule(id, POLL_MS);
      }
    } catch (failure) {
      if (revisionRef.current !== id) return;

      const info = errInfo(failure);
      console.error('PERFECT SHOT NEXT ERROR:', info);

      if (info.code === 'SHOT_CONFLICT') {
        schedule(id, 200);
      } else if (['SESSION_EXPIRED', 'SESSION_NOT_ACTIVE', 'PRIZE_ALREADY_AWARDED'].includes(info.code)) {
        liveRef.current = false;
        sessionRef.current = null;
        setHasActive(false);
        setError('Session expired. The attempt has ended.');

        try {
          await refreshStatus();
        } catch {
          // Retain the expiry message.
        }
      } else {
        liveRef.current = false;
        setError(info.message);
      }
    } finally {
      pollingRef.current = false;
    }
  }, [apply, finished, schedule, refreshStatus, calibrateClock, serverNowMs]);

  pollRef.current = poll;
function playBackgroundMusic() {
  const music = backgroundMusicRef.current;
  if (!music || !music.paused) return;

  music.volume = 0.25;
  void music.play().catch(() => {});
}

function toggleSounds() {
  const nextMuted = !muted;
  const music = backgroundMusicRef.current;

  if (music) {
    music.muted = nextMuted;
  }

  setMuted(nextMuted);

  if (!nextMuted && (liveRef.current || startBusyRef.current)) {
    playBackgroundMusic();
  }
}
  const start = async () => {
    if (startBusyRef.current || liveRef.current || loading || hasPrize || (locked && !hasActive)) {
      return;
    }

    startBusyRef.current = true;
    if (!muted) playBackgroundMusic();
    setStarting(true);
    setError('');
    setFeedback('');
    setMarker(null);

    try {
      const { data } = await api.start();

      if (!data.sessionId || !data.sessionToken) {
        throw new Error('Missing session credentials');
      }

      sessionRef.current = {
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
      };

      setCompletedPrizeSession(null);
      setAttemptsLeft(data.attemptsLeft);
      setHasActive(true);
      apply({ ...initial, status: 'active', phase: 'ready' });
      liveRef.current = true;

      const id = ++revisionRef.current;
      schedule(id, 0);
    } catch (failure) {
      setError(errInfo(failure).message);

      try {
        await refreshStatus();
      } catch {
        // Retain the start error.
      }
    } finally {
      startBusyRef.current = false;
      setStarting(false);
    }
  };

  useEffect(() => {
    if (game.phase !== 'aiming' || game.status !== 'active') return undefined;

    const shotIndex = game.shot - 1;
    const startMs = new Date(game.shotStartedAt).getTime();
    const endMs = new Date(game.shotExpiresAt).getTime();

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;

    const tick = () => {
      const now = serverNowMs();
      const elapsed = Math.min(game.shotTimeMs, Math.max(0, now - startMs));

      setTarget(targetAt(elapsed, shotIndex, game.motion));
      setTimeLeft(Math.max(0, (endMs - now) / 1000));

      if (now < endMs && liveRef.current) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [
    game.phase,
    game.shot,
    game.shotStartedAt,
    game.shotExpiresAt,
    game.status,
    game.shotTimeMs,
    game.motion,
    serverNowMs,
  ]);

  const shoot = async (event) => {
    const current = latestRef.current;

    if (busyRef.current || !liveRef.current || current.phase !== 'aiming') return;

    const credentials = sessionRef.current;
    const rect = arenaRef.current?.getBoundingClientRect();

    if (!credentials || !rect?.width || !rect.height) return;

    const isKeyboard = event.type === 'keydown';
    const x = isKeyboard ? rect.width / 2 : event.clientX - rect.left;
    const y = isKeyboard ? rect.height / 2 : event.clientY - rect.top;
    const px = Math.min(100, Math.max(0, (x / rect.width) * 100));
    const py = Math.min(100, Math.max(0, (y / rect.height) * 100));
    const shotAt = serverNowMs();

    if (shotAt >= new Date(current.shotExpiresAt).getTime()) return;

    const shotStartedMs = new Date(current.shotStartedAt).getTime();
    const visualTarget = targetAt(
      Math.max(0, shotAt - shotStartedMs),
      current.shot - 1,
      current.motion
    );

    const targetRect = targetRef.current?.getBoundingClientRect();
    const renderedTarget = targetRect
      ? {
          x: ((targetRect.left + targetRect.width / 2 - rect.left) / rect.width) * 100,
          y: ((targetRect.top + targetRect.height / 2 - rect.top) / rect.height) * 100,
        }
      : null;

    const localClickDifference = renderedTarget
      ? Math.hypot(px - renderedTarget.x, py - renderedTarget.y) * 5
      : null;

    if (import.meta.env.DEV) {
      console.info('PERFECT SHOT CLICK SNAPSHOT', {
        click: { x: px, y: py },
        renderedTarget,
        formulaTarget: visualTarget,
        localClickDifference,
        shotAt,
        shotStartedAt: current.shotStartedAt,
        shot: current.shot,
        motion: current.motion,
        clockOffsetMs: serverClockOffsetRef.current,
      });
    }

    busyRef.current = true;
    const tap = tapSoundRef.current;

if (!muted && tap) {
  tap.currentTime = 0;
  void tap.play().catch(() => {});
}

    const id = revisionRef.current;
    setMarker({ x: px, y: py, category: 'hit' });

    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      const { data } = await api.shoot({
        ...credentials,
        shot: current.shot,
        x: px,
        y: py,
        ...(import.meta.env.DEV ? { shotAt } : {}),
      });

      if (id !== revisionRef.current) return;

      apply(data);

      if (import.meta.env.DEV) {
        const serverMotion = data.result?.debugTiming?.motion ?? null;
        const serverScoredAt = data.result?.debugTiming?.scoredAtMs;
        const reconstructedTarget = Number.isFinite(serverScoredAt)
          ? targetAt(serverScoredAt - shotStartedMs, current.shot - 1, serverMotion)
          : null;

        const positionErrorPixels = reconstructedTarget && data.result
          ? Math.hypot(
              reconstructedTarget.x - data.result.targetX,
              reconstructedTarget.y - data.result.targetY
            ) * 5
          : null;

        console.debug('PERFECT SHOT DIAGNOSTIC', {
          click: { x: px, y: py },
          visualTarget,
          renderedTarget,
          motionMatches: JSON.stringify(current.motion) === JSON.stringify(serverMotion),
          scoredAtDifferenceMs: Number.isFinite(serverScoredAt) ? serverScoredAt - shotAt : null,
          positionErrorPixels,
          reconstructedTarget,
          localClickDifference,
          frontendMotion: current.motion,
          serverTiming: data.result?.debugTiming || null,
          serverTarget: data.result ? { x: data.result.targetX, y: data.result.targetY } : null,
          distance: data.result?.distance,
          points: data.result?.points,
          clockOffsetMs: serverClockOffsetRef.current,
        });
      }

      setMarker({ x: px, y: py, category: data.result?.category || 'miss' });
      setFeedback(`${data.result?.label || 'SHOT RECORDED'} +${data.result?.points ?? 0}`);
      sound((data.result?.points || 0) > 0);

      if (data.status === 'completed') {
        await finished(data, id);
      } else {
        const wait = new Date(data.nextShotAt).getTime() - serverNowMs();
        schedule(id, Math.max(80, wait + 20));
      }
    } catch (failure) {
      if (id !== revisionRef.current) return;

      const info = errInfo(failure);
      console.error('PERFECT SHOT SHOOT ERROR:', info);

      if (['TOO_LATE', 'TOO_FAST', 'SHOT_NOT_ACTIVE', 'SHOT_CONFLICT'].includes(info.code)) {
        setFeedback('Shot not accepted. Waiting for server...');
        schedule(id, 100);
      } else if (['SESSION_EXPIRED', 'SESSION_NOT_ACTIVE', 'PRIZE_ALREADY_AWARDED'].includes(info.code)) {
        liveRef.current = false;
        setHasActive(false);
        sessionRef.current = null;
        setError('Session expired.');

        try {
          await refreshStatus();
        } catch {
          // Retain the expiry message.
        }
      } else {
        setError(info.message);
        schedule(id, 300);
      }
    } finally {
      busyRef.current = false;
    }
  };
  const backgroundMusicActive = starting || liveRef.current;

useEffect(() => {
  if (backgroundMusicActive) return;

  const music = backgroundMusicRef.current;
  if (!music) return;

  music.pause();
  music.currentTime = 0;
}, [backgroundMusicActive]);

useEffect(() => {
  const music = backgroundMusicRef.current;
  return () => music?.pause();
}, []);

  const phase = game.phase;
  const aiming = phase === 'aiming';
  const completed = game.status === 'completed';
  const qualified = game.outcome === 'qualified';
  const canStart = !loading && !starting && !liveRef.current && !hasPrize && (!locked || hasActive);
  const displayedTarget = practiceMode ? practicePosition : target;
  const timePercent = aiming ? Math.min(100, (timeLeft / (game.shotTimeMs / 1000)) * 100) : 0;

  let headline = 'READY FOR THE CHALLENGE?';
  if (completed) headline = 'CHALLENGE COMPLETE';
  else if (aiming) headline = 'AIM FOR THE BULLSEYE';
  else if (liveRef.current) headline = 'GET READY FOR NEXT SHOT';

  let startLabel = 'START GAME';
  if (loading) startLabel = 'LOADING...';
  else if (starting) startLabel = 'STARTING...';
  else if (hasPrize) startLabel = 'GAMES LOCKED';
  else if (locked && !hasActive) startLabel = 'NO MORE ATTEMPTS';
  else if (hasActive) startLabel = 'RESUME GAME';

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (practiceMode) practiceClick(event);
    else void shoot(event);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void shoot(event);
    }
  };

  return (
    
    <main className="ps-page hnc-game-page">
      <audio
  ref={backgroundMusicRef}
  src={perfectShotBg}
  loop
  preload="metadata"
/>
<audio ref={tapSoundRef} src={tapSound} preload="auto" muted={muted} />
      <style>{PERFECT_SHOT_STYLES}</style>

      <section className="ps-shell" aria-label="HNC Perfect Shot game">
        <header className="ps-header">
          <div className="ps-brand">
            <span className="ps-brand-emblem">HNC</span>
            <span className="ps-brand-title">
              PERFECT <strong>SHOT</strong>
              <small>HIT &amp; WIN CHALLENGE</small>
            </span>
          </div>

          <button
            className="ps-sound"
            type="button"
            onClick={toggleSounds}
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </header>

        <div className="ps-status" aria-label="Game statistics">
          <div className="ps-stat">
            <span>PLAYER</span>
            <strong className="ps-player">{name}</strong>
          </div>
          <div className="ps-stat">
            <span>SCORE</span>
            <strong>{game.score}<small> / 500</small></strong>
          </div>
          <div className="ps-stat">
            <span>SHOTS</span>
            <strong>{game.shot}<small> / {SHOTS}</small></strong>
          </div>
        </div>

        <p className="ps-attempts">
          Perfect Shot attempts remaining: <strong>{attemptsLeft ?? '...'}/3</strong>
          {hasPrize ? ' · Prize already awarded. Games locked.' : ''}
        </p>

        {error && <div className="ps-error" role="alert">{error}</div>}

        <div className="ps-headline">
          <span className="ps-live-dot" />
          {headline}
        </div>

        <div
          ref={arenaRef}
          className={`ps-arena ps-arena--${phase}`}
          onPointerDown={practiceMode || aiming ? handlePointerDown : undefined}
          onKeyDown={aiming ? handleKeyDown : undefined}
          role={aiming ? 'button' : 'img'}
          tabIndex={aiming ? 0 : -1}
          aria-label={aiming ? 'Tap moving target to shoot' : 'Perfect Shot playfield'}
        >
          <div className="ps-grid" />
          <div className="ps-arena-label">HNC // SKILL ZONE</div>

          {(aiming || practiceMode) && (
            <div
              ref={targetRef}
              className="ps-target"
              style={{ left: `${displayedTarget.x}%`, top: `${displayedTarget.y}%` }}
              aria-hidden="true"
            >
              <div className="ps-target-ring ps-target-ring--outer">
                <div className="ps-target-ring ps-target-ring--middle">
                  <div className="ps-target-ring ps-target-ring--inner" />
                </div>
              </div>
            </div>
          )}

          {marker && (
            <div
              className={`ps-marker ps-marker--${marker.category}`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              aria-hidden="true"
            >
              ×
            </div>
          )}

          {!liveRef.current && !completed && !practiceMode && (
            <div className="ps-overlay">
              <div className="ps-overlay-icon">🎯</div>
              <h1>YOUR AIM.<br /><em>YOUR GAME.</em></h1>
              <p>
                5 shots. Moving targets.<br />
                Score at least {game.scoreToQualify ?? DEFAULT_SCORE_TO_QUALIFY} points to qualify.
              </p>
              <button className="ps-primary" type="button" disabled={!canStart} onClick={() => void start()}>
                {startLabel} <span>→</span>
              </button>
            </div>
          )}

          {completed && !practiceMode && (
            <div className="ps-overlay ps-finish">
              <div className="ps-trophy">{qualified ? '🏆' : '🎯'}</div>
              <p className="ps-finish-caption">SERVER-VERIFIED FINAL SCORE</p>
              <h1>{game.score}<small> / 500</small></h1>
              <p>{qualified ? 'Qualified for prize assessment.' : 'Not qualified this time.'}</p>
              <div className="ps-finish-stats">
                <span><strong>{game.hits}</strong> hits</span>
                <span><strong>{game.perfects}</strong> perfect</span>
              </div>
              <p className="ps-small">{attemptsLeft ?? '...'} attempts remaining</p>
              <button
                className="ps-primary"
                type="button"
                disabled={!canStart || (attemptsLeft ?? 0) <= 0}
                onClick={() => void start()}
              >
                PLAY AGAIN <span>↻</span>
              </button>
            </div>
          )}

          {(practiceMode || (liveRef.current && phase === 'ready')) && feedback && (
            <div className="ps-feedback" role="status">{feedback}</div>
          )}
        </div>

        {completedPrizeSession && (
          <PrizeDecisionPanel
            key={completedPrizeSession.id}
            gameSessionId={completedPrizeSession.id}
            allowDecisionRecovery={!completedPrizeSession.restored}
          />
        )}

        <div className="ps-timer-row">
          <div className="ps-timer-label">
            <span>⏱ TIME LEFT</span>
            <strong>{aiming ? `${timeLeft.toFixed(1)}s` : '—'}</strong>
          </div>
          <div className="ps-time-track">
            <div className="ps-time-fill" style={{ width: `${timePercent}%` }} />
          </div>
        </div>

        <div className="ps-shot-dots" aria-label="Shot results">
          {Array.from({ length: SHOTS }, (_, index) => {
            const result = game.history?.[index];
            const activeShot = game.shot === index + 1 && aiming;

            let dotClass = 'ps-shot-dot';
            if (result) dotClass += result.points ? ' ps-shot-dot--hit' : ' ps-shot-dot--miss';
            else if (activeShot) dotClass += ' ps-shot-dot--active';

            return (
              <span key={index} className={dotClass}>
                {result ? (result.points ? '✓' : '×') : index + 1}
              </span>
            );
          })}
        </div>

        <footer className="ps-footer">
          <div>
            <strong>HOW TO PLAY</strong>
            <p>Tap the moving target. Center = 100 points. Five shots per attempt, 3.5 seconds each.</p>
          </div>
          <div className="ps-point-legend">
            <span><i className="ps-dot ps-dot--gold" />100</span>
            <span><i className="ps-dot ps-dot--red" />70</span>
            <span><i className="ps-dot ps-dot--blue" />40</span>
          </div>
        </footer>

        <p className="ps-notice">Test mode: server-calculated scores. No prizes or QR codes are issued.</p>

        {import.meta.env.DEV && !liveRef.current && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              type="button"
              className="ps-primary"
              onClick={() => {
                setPracticeMode((value) => !value);
                setMarker(null);
                setFeedback('');
              }}
            >
              {practiceMode ? 'EXIT PRACTICE' : 'OFFLINE MOUSE PRACTICE (0 ATTEMPTS)'}
            </button>

            {practiceMode && (
              <p className="ps-notice">
                Click the moving target. Diagnostics appear instantly in Console.
                No API requests, attempt usage, or server scores.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}