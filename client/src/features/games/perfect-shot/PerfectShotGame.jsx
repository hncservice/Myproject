import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../../authentication/context/AuthContext';
import axiosInstance from '../../../shared/api/axiosInstance';
import PrizeDecisionPanel from '../components/PrizeDecisionPanel';
import '../styles/PerfectShotGame.css';
import perfectShotBg from '../../../assets/sounds/perfectshotbg.mp3';
import tapSound from '../../../assets/sounds/tap.mp3';
import { createServerClock, targetAt, arenaPoint, readArenaGeometry } from './perfectShotTiming.mjs';
import { Link } from 'react-router-dom';
const SHOTS = 5;
const TIME_MS = 3500;
const POLL_MS = 150;
const DEFAULT_SCORE_TO_QUALIFY = 250;

const api = {
  status: () => axiosInstance.get('/games/status'),
  timing: () => axiosInstance.post('/games/perfect-shot/shoot', { timingProbe: true }, { timeout: 10000 }),
  nextTiming: () => axiosInstance.post('/games/perfect-shot/next', { timingProbe: true }, { timeout: 10000 }),
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
  const [marker, setMarker] = useState(null);
  const [muted, setMuted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [practiceMode, setPracticeMode] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [sendingShot, setSendingShot] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [timing, setTiming] = useState(null);
  const mountedRef = useRef(false);
  const clockRef = useRef(null);
  if (!clockRef.current) clockRef.current = createServerClock();
  const arenaSizeRef = useRef({ width: 0, height: 0 });
  const timerTextRef = useRef(null);
  const timerFillRef = useRef(null);

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

  const serverNowMs = useCallback(() => clockRef.current.now(), []);

  const calibrateClock = useCallback((data, sentAt, receivedAt) => {
    const accepted = clockRef.current.record(data, sentAt, receivedAt);
    if (accepted && mountedRef.current) setTiming(clockRef.current.stats());
    return accepted;
  }, []);

  // Only the small target element changes each frame, not the React tree.
  const paintTarget = useCallback((point) => {
    const element = targetRef.current;
    const size = arenaSizeRef.current;
    if (!element || !size.width || !size.height) return;
    element.style.transform = `translate3d(${point.x * size.width / 100}px, ${point.y * size.height / 100}px, 0) translate(-50%, -50%)`;
  }, []);

  useLayoutEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return undefined;
    const measure = () => {
      const geometry = readArenaGeometry(arena);
      arenaSizeRef.current = { width: geometry.localWidth, height: geometry.localHeight };
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(arena);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => {
    if (!practiceMode) return undefined;

    practiceOriginRef.current = performance.now();

    const tick = () => {
      paintTarget(targetAt(performance.now() - practiceOriginRef.current, 0, practiceMotionRef.current));
      practiceFrameRef.current = requestAnimationFrame(tick);
    };

    practiceFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (practiceFrameRef.current != null) {
        cancelAnimationFrame(practiceFrameRef.current);
      }
    };
  }, [practiceMode, paintTarget]);

  const practiceClick = (event) => {
    const arena = arenaRef.current;
    const targetRect = targetRef.current?.getBoundingClientRect();
    if (!arena || !targetRect) return;
    const geometry = readArenaGeometry(arena);
    const keyboard = event.type === 'keydown';
    const point = keyboard ? { x: 50, y: 50 } : arenaPoint(event.clientX, event.clientY, geometry);
    const renderedTarget = arenaPoint(targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2, geometry);
    if (!point || !renderedTarget) return;
    const { x, y } = point;
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
    setMaxAttempts(Number.isInteger(thisGame.maxAttempts) ? thisGame.maxAttempts : 5);
    setLocked(Boolean(thisGame.locked || data.gamesLockedAfterPrize));
    setHasPrize(Boolean(data.hasPrize));
  }, []);

  const refreshStatus = useCallback(async () => {
    const { data } = await api.status();
    if (mountedRef.current) applyStatus(data);
  }, [applyStatus]);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;

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
      mountedRef.current = false;
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
      if (!mountedRef.current || revisionRef.current !== id) return;
      setError(errInfo(failure).message);
    }
  }, [apply, clearTimers, refreshStatus]);

  const schedule = useCallback((id, delay = POLL_MS) => {
    if (!mountedRef.current || !liveRef.current || document.hidden || revisionRef.current !== id) return;

    if (timerRef.current != null) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      void pollRef.current?.(id);
    }, Math.max(0, delay));
  }, []);

  const poll = useCallback(async (id) => {
    if (!mountedRef.current || !liveRef.current || document.hidden || revisionRef.current !== id) return;

    if (busyRef.current || pollingRef.current) {
      schedule(id, 100);
      return;
    }

    const credentials = sessionRef.current;
    if (!credentials) return;

    pollingRef.current = true;

    try {
      const sentAt = performance.now();
      const { data } = await api.next(credentials);

      if (!mountedRef.current || !liveRef.current || revisionRef.current !== id) return;
      calibrateClock(data, sentAt, performance.now());

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
      if (!mountedRef.current || revisionRef.current !== id) return;

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
    const id = ++revisionRef.current;
    setPracticeMode(false);
    if (!muted) playBackgroundMusic();
    setStarting(true);
    setError('');
    setFeedback('');
    setMarker(null);

    try {
      // Probe the same request paths/headers used by play, before an attempt is consumed.
      // Discard warm-up samples that can include CORS preflight or cold-start overhead.
      const probes = [api.nextTiming, api.timing, api.timing];
      for (let probe = 0; probe < probes.length; probe += 1) {
        const sentAt = performance.now();
        const response = await probes[probe]();
        if (!mountedRef.current || revisionRef.current !== id) return;
        const receivedAt = performance.now();
        const accepted = probe < probes.length - 1
          ? createServerClock().record(response.data, sentAt, receivedAt)
          : calibrateClock(response.data, sentAt, receivedAt);
        if (!accepted) {
          throw new Error('Unable to prepare the game. Please refresh and try again.');
        }
      }
      if (document.hidden) throw new Error('Return to this page before starting the game.');
      const { data } = await api.start();
      if (!mountedRef.current || revisionRef.current !== id) return;

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

      schedule(id, 0);
    } catch (failure) {
      if (!mountedRef.current || revisionRef.current !== id) return;
      setError(errInfo(failure).message);

      try {
        await refreshStatus();
      } catch {
        // Retain the start error.
      }
    } finally {
      startBusyRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  };

  useEffect(() => {
    const visibilityChanged = () => {
      setPageVisible(!document.hidden);
      if (document.hidden) clearTimers();
      else if (liveRef.current) schedule(revisionRef.current, 0);
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => document.removeEventListener('visibilitychange', visibilityChanged);
  }, [clearTimers, schedule]);

  useLayoutEffect(() => {
    if (practiceMode || !pageVisible || game.phase !== 'aiming' || game.status !== 'active') {
      if (timerTextRef.current) timerTextRef.current.textContent = '—';
      if (timerFillRef.current) timerFillRef.current.style.transform = 'scaleX(0)';
      return undefined;
    }
    const startMs = Date.parse(game.shotStartedAt);
    const endMs = Date.parse(game.shotExpiresAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;

    const tick = () => {
      if (!mountedRef.current || !liveRef.current || document.hidden) return;
      const now = serverNowMs();
      const remainingMs = Math.max(0, endMs - now);
      if (!busyRef.current) {
        const elapsed = Math.min(game.shotTimeMs, Math.max(0, now + clockRef.current.leadMs() - startMs));
        paintTarget(targetAt(elapsed, game.shot - 1, game.motion));
      }
      if (timerTextRef.current) timerTextRef.current.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
      if (timerFillRef.current) timerFillRef.current.style.transform = `scaleX(${Math.min(1, remainingMs / game.shotTimeMs)})`;
      if (remainingMs > 0) frameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [game.phase, game.shot, game.shotStartedAt, game.shotExpiresAt, game.status, game.shotTimeMs, game.motion, pageVisible, practiceMode, paintTarget, serverNowMs]);

  const shoot = async (event) => {
    const current = latestRef.current;

    if (busyRef.current || !liveRef.current || current.phase !== 'aiming') return;

    if (!pageVisible || document.hidden || pollingRef.current) return;
    const credentials = sessionRef.current;
    const arena = arenaRef.current;
    if (!credentials || !arena) return;
    const keyboard = event.type === 'keydown';
    const point = keyboard ? { x: 50, y: 50 } : arenaPoint(event.clientX, event.clientY, readArenaGeometry(arena));
    if (!point) return;
    const { x: px, y: py } = point;
    const shotAt = serverNowMs();
    if (shotAt >= Date.parse(current.shotExpiresAt)) return;

    busyRef.current = true;
    setSendingShot(true);
    const sentAt = performance.now();

    const id = revisionRef.current;
    setMarker({ x: px, y: py, category: 'pending' });

    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      // Dispatch first; optional audio cannot prevent a shot from reaching the API.
      const request = api.shoot({
        ...credentials,
        shot: current.shot,
        x: px,
        y: py,
        ...(import.meta.env.DEV ? { shotAt: Math.round(shotAt) } : {}),
      });
      const tap = tapSoundRef.current;
      if (!muted && tap) {
        try {
          tap.currentTime = 0;
          void tap.play().catch(() => {});
        } catch { /* Sound is optional. */ }
      }
      const { data } = await request;
      if (!mountedRef.current || id !== revisionRef.current) return;
      calibrateClock(data, sentAt, performance.now());
      apply(data);

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
      if (!mountedRef.current || id !== revisionRef.current) return;

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
      if (mountedRef.current) setSendingShot(false);
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
  return () => {
    music?.pause();
    const context = audioRef.current;
    audioRef.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  };
}, []);

  const phase = game.phase;
  const aiming = phase === 'aiming' && liveRef.current && pageVisible;
  const completed = game.status === 'completed';
  const qualified = game.outcome === 'qualified';
  const canStart = !loading && !starting && !liveRef.current && !hasPrize && (!locked || hasActive);

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
  if (event.isPrimary === false) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  if (practiceMode) {
    event.preventDefault();
    practiceClick(event);
    return;
  }

  if (latestRef.current.phase !== 'aiming') return;

  event.preventDefault();
  void shoot(event);
};

  const handleKeyDown = (event) => {
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (practiceMode) practiceClick(event);
      else void shoot(event);
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
          <Link to="/user/home" className="hnc-back-home">
  <span aria-hidden="true">←</span>
  Back to Home
</Link>
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
          Perfect Shot attempts remaining: <strong>{attemptsLeft ?? '...'}/{maxAttempts}</strong>
          {hasPrize ? ' · Prize already awarded. Games locked.' : ''}
        </p>

        {error && <div className="ps-error" role="alert">{error}</div>}
        <p className={`ps-connection${timing?.networkRttMs > 400 ? ' ps-connection--slow' : ''}`}>
          {starting ? 'Synchronizing connection before play…' : timing
            ? `Connection ${Math.round(timing.networkRttMs)} ms${timing.networkRttMs > 400 ? ' — network delay may affect aim.' : ' · Timing synchronized'}`
            : 'Timing synchronizes when you start.'}
        </p>
        {!pageVisible && liveRef.current && <p className="ps-error" role="status">Return to this page to refresh your game. Server time continues while away.</p>}

        <div className="ps-headline">
          <span className="ps-live-dot" />
          {headline}
        </div>

        <div
          ref={arenaRef}
          className={`ps-arena ps-arena--${phase}`}
          onPointerDown={practiceMode || aiming ? handlePointerDown : undefined}
          onKeyDown={aiming || practiceMode ? handleKeyDown : undefined}
          role={aiming || practiceMode ? 'button' : undefined}
          aria-disabled={aiming ? sendingShot : undefined}
          tabIndex={aiming || practiceMode ? 0 : -1}
          aria-label={aiming ? 'Tap moving target to shoot' : 'Perfect Shot playfield'}
        >
          <div className="ps-grid" />
          <div className="ps-arena-label">HNC // SKILL ZONE</div>

          {(aiming || practiceMode) && (
            <div
              ref={targetRef}
              className="ps-target"
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

          {sendingShot && <div className="ps-pending" role="status">Checking shot…</div>}

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
            <strong ref={timerTextRef}>—</strong>
          </div>
          <div className="ps-time-track">
            <div ref={timerFillRef} className="ps-time-fill" />
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

        <p className="ps-notice">Scores are verified by the server. Qualifying results follow the prize review and draw process.</p>

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