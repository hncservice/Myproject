import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../authentication/context/AuthContext';
import {
  getGamesStatus,
  getMonkeySession,
  getMonkeyHistory,
  startMonkey,
  nextMonkeyRound,
  hitMonkey,
} from '../api/gameApi';

import NewYearPopup from '../components/NewYearPopup';
import PrizeDecisionPanel from '../components/PrizeDecisionPanel';

import hitSfx from '../../../assets/sounds/monkey-hit.mp3';
import missSfx from '../../../assets/sounds/monkey-miss.mp3';
import startSfx from '../../../assets/sounds/game-start.mp3';
import winSfx from '../../../assets/sounds/game-win.mp3';
import loseSfx from '../../../assets/sounds/game-lose.mp3';
import bgLoopSfx from '../../../assets/sounds/game-bg-loop.mp3';
import '../styles/MonkeyGamePage.css';

const REQUIRED_HITS = 7;
const MAX_ROUNDS = 20;
const MAX_ATTEMPTS = 3;
const POLL_RETRY_MS = 175;
const HNC_APP_DOWNLOAD_URL = 'https://onelink.to/c8p8b8';

function getErrorDetails(error) {
  return {
    httpStatus: error?.response?.status || null,
    code: error?.response?.data?.code || null,
    message:
      error?.response?.data?.message ||
      error?.message ||
      'Unknown error',
  };
}

function millisecondsUntil(dateValue) {
  if (!dateValue) return 0;

  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return 0;

  return Math.max(0, timestamp - Date.now());
}

export default function MonkeyGamePage() {
  const { profile } = useAuth();
  const [completedPrizeSession, setCompletedPrizeSession] = useState(null);
  const [openNY, setOpenNY] = useState(false);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);

  const [locked, setLocked] = useState(false);
  const [hasPrize, setHasPrize] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const [chancesLeft, setChancesLeft] = useState(null);
  const [maxChances, setMaxChances] = useState(MAX_ATTEMPTS);

  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);
  const [phase, setPhase] = useState('ready');
  const [requiredHits, setRequiredHits] = useState(REQUIRED_HITS);
  const [maxRounds, setMaxRounds] = useState(MAX_ROUNDS);

  const [deadline, setDeadline] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [qualified, setQualified] = useState(false);

  const mountedRef = useRef(false);
  const popupShownRef = useRef(false);
  const sessionRef = useRef(null);
  const playingRef = useRef(false);
  const startBusyRef = useRef(false);
  const pollBusyRef = useRef(false);
  const tapBusyRef = useRef(false);
  const epochRef = useRef(0);

  const pollTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const currentRoundRef = useRef(null);
  const visibleUntilRef = useRef(0);

  const bgLoopRef = useRef(null);
  const startRef = useRef(null);
  const hitRef = useRef(null);
  const missRef = useRef(null);
  const winRef = useRef(null);
  const loseRef = useRef(null);

  useEffect(() => {
    const sounds = [
      [bgLoopRef, bgLoopSfx, 0.25],
      [startRef, startSfx, 0.7],
      [hitRef, hitSfx, 0.7],
      [missRef, missSfx, 0.5],
      [winRef, winSfx, 0.8],
      [loseRef, loseSfx, 0.7],
    ];

    sounds.forEach(([ref, source, volume]) => {
      const audio = new Audio(source);
      audio.volume = volume;
      ref.current = audio;
    });

    return () => {
      sounds.forEach(([ref]) => {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      });
    };
  }, []);

  const playSound = useCallback((ref, loop = false) => {
    try {
      const sound = ref.current;
      if (!sound) return;

      sound.loop = loop;

      if (!loop) sound.currentTime = 0;

      sound.play().catch(() => {});
    } catch {
      // Audio playback is optional.
    }
  }, []);

  const stopBackgroundSound = useCallback(() => {
    const sound = bgLoopRef.current;
    if (!sound) return;

    sound.pause();
    sound.currentTime = 0;
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    playingRef.current = false;
    epochRef.current += 1;

    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    clearHideTimer();
    currentRoundRef.current = null;
    visibleUntilRef.current = 0;
  }, [clearHideTimer]);

  const refreshStatus = useCallback(async () => {
    const response = await getGamesStatus();
    const data = response.data;
    const monkey = data?.games?.find((game) => game.id === 'monkey');

    if (!monkey) {
      throw new Error('Monkey Game is not configured');
    }

    if (!mountedRef.current) return;

    setChancesLeft(monkey.attemptsLeft);
    setMaxChances(monkey.maxAttempts);
    setLocked(Boolean(monkey.locked || data.gamesLockedAfterPrize));
    setHasPrize(Boolean(data.hasPrize));

    return monkey;
  }, []);

  // Restore the most recent qualified attempt from the player's history.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function initialize() {
      try {
        await refreshStatus();
        if (cancelled) return;

        const response = await getMonkeySession();
        if (cancelled) return;

        setHasActiveSession(Boolean(response.data?.activeSession));

        try {
          const history = await getMonkeyHistory();
          if (cancelled) return;

          const items = history.data?.items;
          const qualifiedSession = Array.isArray(items)
            ? items.find(
                (item) =>
                  item?.status === 'completed' &&
                  item.outcome === 'qualified'
              )
            : null;

          const sessionId =
            qualifiedSession?.sessionId ??
            qualifiedSession?.id ??
            qualifiedSession?._id;

          if (
            typeof sessionId === 'string' &&
            /^[a-f0-9]{24}$/i.test(sessionId)
          ) {
            setCompletedPrizeSession({
              id: sessionId,
              restored: true,
            });
          }
        } catch (error) {
          if (!cancelled) {
            console.error('MONKEY HISTORY ERROR:', getErrorDetails(error));
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('MONKEY INITIALIZATION ERROR:', getErrorDetails(error));
          setErrorMessage(getErrorDetails(error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      stopPolling();
    };
  }, [refreshStatus, stopPolling]);

  useEffect(() => {
    if (profile && !popupShownRef.current) {
      popupShownRef.current = true;
      setOpenNY(true);
    }
  }, [profile]);

  const applyRound = useCallback((data) => {
    if (!data || !mountedRef.current) return;

    if (typeof data.round === 'number') {
      setRoundCount(data.round);
    }

    if (typeof data.hits === 'number') {
      setHits(data.hits);
    }

    if (typeof data.misses === 'number') {
      setMisses(data.misses);
    }

    if (typeof data.maxRounds === 'number') {
      setMaxRounds(data.maxRounds);
    }

    if (typeof data.requiredHits === 'number') {
      setRequiredHits(data.requiredHits);
    }

    setPhase(data.phase || 'ready');
    clearHideTimer();

    const visible =
      data.status === 'active' &&
      data.phase === 'visible' &&
      Number.isInteger(data.targetIndex) &&
      millisecondsUntil(data.visibleUntil) > 0;

    if (!visible) {
      setActiveIndex(null);
      currentRoundRef.current = null;
      visibleUntilRef.current = 0;
      return;
    }

    currentRoundRef.current = data.round;
    visibleUntilRef.current = new Date(data.visibleUntil).getTime();
    setActiveIndex(data.targetIndex);

    const remaining = millisecondsUntil(data.visibleUntil);
    hideTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      setActiveIndex(null);
      currentRoundRef.current = null;
    }, remaining);
  }, [clearHideTimer]);

  const finishGame = useCallback(async (data) => {
    const finishedSessionId = sessionRef.current?.sessionId;

    stopPolling();
    sessionRef.current = null;

    if (!mountedRef.current) return;

    const qualifiedFinish =
      data?.status === 'completed' &&
      data.outcome === 'qualified';

    setCompletedPrizeSession(
      qualifiedFinish && finishedSessionId
        ? { id: finishedSessionId, restored: false }
        : null
    );

    setRunning(false);
    setHasActiveSession(false);
    setActiveIndex(null);
    stopBackgroundSound();

    if (data) {
      applyRound(data);
    }

    if (qualifiedFinish) {
      setQualified(true);
      setResultMessage('Qualified! Check your prize status.');
      playSound(winRef);
    } else {
      setQualified(false);
      setResultMessage('Game completed. You did not qualify this attempt.');
      playSound(loseRef);
    }

    try {
      await refreshStatus();
    } catch (error) {
      console.error('MONKEY STATUS REFRESH ERROR:', getErrorDetails(error));
    }
  }, [stopPolling, stopBackgroundSound, applyRound, playSound, refreshStatus]);

  const pollNextRef = useRef(null);

  const schedulePoll = useCallback((epoch, delay = POLL_RETRY_MS) => {
    if (!playingRef.current || epochRef.current !== epoch) return;

    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
    }

    pollTimerRef.current = setTimeout(() => {
      pollNextRef.current?.(epoch);
    }, Math.max(0, delay));
  }, []);

  const pollNext = useCallback(async (epoch) => {
    if (!playingRef.current || epochRef.current !== epoch) return;

    if (pollBusyRef.current || tapBusyRef.current) {
      schedulePoll(epoch, POLL_RETRY_MS);
      return;
    }

    const credentials = sessionRef.current;
    if (!credentials) return;

    pollBusyRef.current = true;

    try {
      const response = await nextMonkeyRound(credentials);

      if (!mountedRef.current || epochRef.current !== epoch) return;

      const data = response.data;
      applyRound(data);

      if (data.status !== 'active') {
        await finishGame(data);
        return;
      }

      if (data.phase === 'visible') {
        const remaining = millisecondsUntil(data.visibleUntil);
        schedulePoll(epoch, Math.max(75, remaining + 30));
        return;
      }

      if (data.phase === 'ready') {
        const remaining = millisecondsUntil(data.nextRoundAt);

        schedulePoll(
          epoch,
          remaining > 0 ? Math.max(75, remaining + 20) : POLL_RETRY_MS
        );
        return;
      }

      schedulePoll(epoch, POLL_RETRY_MS);
    } catch (error) {
      if (!mountedRef.current || epochRef.current !== epoch) return;

      const details = getErrorDetails(error);
      console.error('MONKEY ROUND ERROR:', details);

      if (details.code === 'ROUND_CONFLICT') {
        schedulePoll(epoch, POLL_RETRY_MS);
        return;
      }

      if (
        details.code === 'SESSION_EXPIRED' ||
        details.code === 'SESSION_NOT_ACTIVE'
      ) {
        await finishGame({ outcome: 'not-qualified' });
        setResultMessage('Your game session has ended or expired.');
        return;
      }

      stopPolling();
      setRunning(false);
      setActiveIndex(null);
      stopBackgroundSound();

      setErrorMessage(
        details.message ||
        'Gameplay connection failed. Refresh the page to resume.'
      );
    } finally {
      pollBusyRef.current = false;
    }
  }, [applyRound, finishGame, schedulePoll, stopPolling, stopBackgroundSound]);

  pollNextRef.current = pollNext;

  const startGame = async () => {
    if (startBusyRef.current || playingRef.current) return;
    if (loading || hasPrize) return;

    if (locked && !hasActiveSession) {
      setErrorMessage('No more attempts available.');
      return;
    }

    startBusyRef.current = true;

    setStarting(true);
    setErrorMessage('');
    setResultMessage('');
    setQualified(false);

    try {
      const response = await startMonkey();
      const started = response.data;

      if (!started.sessionId || !started.sessionToken) {
        throw new Error('Server did not return game session credentials');
      }

      sessionRef.current = {
        sessionId: started.sessionId,
        sessionToken: started.sessionToken,
      };

      setCompletedPrizeSession(null);
      setChancesLeft(started.attemptsLeft);
      setDeadline(started.expiresAt);
      setSecondsLeft(Math.ceil(millisecondsUntil(started.expiresAt) / 1000));

      setHits(0);
      setMisses(0);
      setRoundCount(0);
      setActiveIndex(null);
      setPhase('ready');

      setRunning(true);
      setHasActiveSession(true);
      playingRef.current = true;

      playSound(startRef);
      playSound(bgLoopRef, true);

      const epoch = ++epochRef.current;
      schedulePoll(epoch, 0);

      console.log('MONKEY GAME STARTED:', {
        attemptNumber: started.attemptNumber,
        attemptsLeft: started.attemptsLeft,
        resumed: started.resumed,
      });
    } catch (error) {
      const details = getErrorDetails(error);
      console.error('MONKEY START ERROR:', details);
      setErrorMessage(details.message);

      try {
        await refreshStatus();
      } catch {
        // Preserve the original start error.
      }
    } finally {
      startBusyRef.current = false;

      if (mountedRef.current) {
        setStarting(false);
      }
    }
  };

  const handleHoleTap = async (index, renderedRound) => {
    if (!playingRef.current || tapBusyRef.current) return;
    if (activeIndex === null) return;

    const credentials = sessionRef.current;

    if (
      !credentials ||
      !Number.isInteger(renderedRound) ||
      renderedRound !== currentRoundRef.current
    ) {
      return;
    }

    const remainingMs = visibleUntilRef.current - Date.now();
    if (remainingMs < 200) {
      setActiveIndex(null);
      currentRoundRef.current = null;
      return;
    }

    tapBusyRef.current = true;
    setActiveIndex(null);
    clearHideTimer();

    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const epoch = epochRef.current;
    let pollDelay = 80;

    try {
      const response = await hitMonkey({
        ...credentials,
        round: renderedRound,
        targetIndex: index,
      });

      if (!mountedRef.current || epochRef.current !== epoch) return;

      const data = response.data;
      setErrorMessage('');
      applyRound(data);

      if (data.status === 'active' && data.phase === 'visible') {
        pollDelay = Math.max(75, millisecondsUntil(data.visibleUntil) + 30);
      }

      if (data.hit) {
        playSound(hitRef);
      } else {
        playSound(missRef);
      }

      if (data.status !== 'active') {
        await finishGame(data);
      }
    } catch (error) {
      if (!mountedRef.current || epochRef.current !== epoch) return;

      const details = getErrorDetails(error);
      console.error('MONKEY HIT ERROR:', details);

      if (
        details.code === 'SESSION_EXPIRED' ||
        details.code === 'SESSION_NOT_ACTIVE'
      ) {
        await finishGame({ outcome: 'not-qualified' });
        setResultMessage('Your game session has expired or ended.');
        return;
      }

      if (details.code === 'TOO_LATE') {
        setErrorMessage('Too late! Wait for the next monkey.');
      } else if (details.code === 'TOO_FAST') {
        setErrorMessage('Too fast! Wait until the monkey appears.');
      } else if (
        details.code === 'ROUND_NOT_ACTIVE' ||
        details.code === 'ROUND_CONFLICT'
      ) {
        setErrorMessage('This round has already changed. Continue playing.');
      } else {
        setErrorMessage(details.message || 'Tap could not be confirmed.');
      }
    } finally {
      tapBusyRef.current = false;

      if (
        mountedRef.current &&
        playingRef.current &&
        epochRef.current === epoch
      ) {
        schedulePoll(epoch, pollDelay);
      }
    }
  };

  useEffect(() => {
    if (!running) return undefined;

    const updateCountdown = () => {
      setSecondsLeft(Math.ceil(millisecondsUntil(deadline) / 1000));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 250);

    return () => clearInterval(timer);
  }, [running, deadline]);

  const displayChances = chancesLeft !== null ? chancesLeft : maxChances;
  const gameDisabled =
    loading ||
    starting ||
    running ||
    hasPrize ||
    (locked && !hasActiveSession);

  const progress =
    maxRounds > 0 ? (Math.min(roundCount, maxRounds) / maxRounds) * 100 : 0;

  const canTap = running && activeIndex !== null;

  let startLabel = 'Start Game';
  if (loading) {
    startLabel = 'Checking Game...';
  } else if (starting) {
    startLabel = 'Starting...';
  } else if (running) {
    startLabel = 'Game In Progress';
  } else if (hasPrize) {
    startLabel = 'Prize Already Awarded';
  } else if (locked && !hasActiveSession) {
    startLabel = 'No More Games';
  } else if (hasActiveSession) {
    startLabel = 'Resume Game';
  }

  let roundStatus = 'Waiting for the next round';
  if (canTap) {
    roundStatus = 'Tap the monkey!';
  } else if (phase === 'ready') {
    roundStatus = 'Get ready';
  }

  return (
    <main className="monkey-page hnc-game-page">
      <NewYearPopup
        open={openNY}
        onClose={() => setOpenNY(false)}
        name={profile?.name || 'Guest'}
        downloadUrl={HNC_APP_DOWNLOAD_URL}
      />

      <div className="monkey-layout">
        <header className="monkey-header">
          <div>
            <h1>Whack the Monkey</h1>
            <p>
              Tap the monkey when it appears. Hit {requiredHits} within{' '}
              {maxRounds} rounds to qualify.
            </p>
            <Link to="/user/home" className="hnc-back-home">
  <span aria-hidden="true">←</span>
  Back to Home
</Link>
          </div>

          <div className="monkey-chances">
            <span>Chances left</span>
            <strong>{loading ? '…' : `${displayChances}/${maxChances}`}</strong>
          </div>
        </header>

        {hasPrize && (
          <p className="monkey-message">
            A prize has already been awarded for this campaign.
          </p>
        )}

        {errorMessage && (
          <div className="monkey-message monkey-message--error">
            <p role="alert">{errorMessage}</p>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setErrorMessage('')}
            >
              ×
            </button>
          </div>
        )}

        <div className="monkey-layout-grid">
          <section className="monkey-card" aria-label="Monkey game board">
            <div className="monkey-play">
              <div className="monkey-progress-label">
                <span>Game progress</span>
                <strong>{roundCount}/{maxRounds} rounds</strong>
              </div>

              <progress
                className="monkey-progress"
                aria-label="Game progress"
                max={100}
                value={progress}
              />

              <div className="monkey-score">
                <span>Hits <strong>{hits}/{requiredHits}</strong></span>
                <span>Misses <strong>{misses}</strong></span>
                {running && (
                  <span>Time <strong>{secondsLeft ?? '…'}s</strong></span>
                )}
              </div>

              {running && (
                <p className="monkey-round-status">{roundStatus}</p>
              )}

              <div className="monkey-board" role="group" aria-label="Nine holes">
                {Array.from({ length: 9 }, (_, index) => {
                  const isActive = canTap && index === activeIndex;

                  return (
                    <div
                      key={index}
                      className={`monkey-hole${isActive ? ' monkey-hole--active' : ''}`}
                      role="button"
                      tabIndex={canTap ? 0 : -1}
                      aria-disabled={!canTap}
                      aria-label={`Hole ${index + 1}`}
                      onPointerDown={(event) => {
                        if (!canTap || (event.pointerType === 'mouse' && event.button !== 0)) {
                          return;
                        }

                        event.preventDefault();
                        handleHoleTap(index, roundCount);
                      }}
                      onContextMenu={(event) => event.preventDefault()}
                      onKeyDown={(event) => {
                        if (!canTap || (event.key !== 'Enter' && event.key !== ' ')) {
                          return;
                        }

                        event.preventDefault();
                        if (!event.repeat) handleHoleTap(index, roundCount);
                      }}
                    >
                      <span aria-hidden="true">{isActive ? '🐵' : '🕳️'}</span>
                    </div>
                  );
                })}
              </div>

              {resultMessage && (
                <p
                  className={`monkey-result${qualified ? ' monkey-result--qualified' : ''}`}
                  role="status"
                >
                  {resultMessage}
                </p>
              )}

              <button
                type="button"
                className="monkey-start"
                disabled={gameDisabled}
                onClick={startGame}
              >
                {startLabel}
              </button>
            </div>
          </section>

          <aside className="monkey-sidebar">
            {completedPrizeSession && (
              <section className="monkey-card" aria-label="Prize decision">
                <PrizeDecisionPanel
                  key={completedPrizeSession.id}
                  gameSessionId={completedPrizeSession.id}
                  allowDecisionRecovery={!completedPrizeSession.restored}
                />
              </section>
            )}

            <section className="monkey-card" aria-labelledby="monkey-rules-title">
              <h2 id="monkey-rules-title">Game Rules</h2>
              <ul className="monkey-rules">
                <li>Maximum {maxChances} attempts per customer.</li>
                <li>Each game has up to {maxRounds} monkey appearances.</li>
                <li>Hit {requiredHits} monkeys to qualify.</li>
                <li>Incorrect taps count as misses.</li>
                <li>Missed appearances count as rounds.</li>
                <li>A session expires after two minutes.</li>
                <li>The server verifies each hit and result.</li>
                <li>Qualification does not award a prize during testing.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
    
  );
}