// client/src/pages/user/MonkeyGamePage.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Alert } from 'react-bootstrap';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Chip,
  Paper,
  Fade,
  Slide,
  Dialog,
  DialogContent,
  Stack,
  IconButton,
  Grow,
  LinearProgress,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import { useAuth } from '../../context/AuthContext';
import { spinOnce, getWheelConfig, getMonkeyStatus, requestMonkeyAttempt } from '../../api/spinApi';
import NewYearPopup from '../../components/NewYearPopup';

// ======== SOUND IMPORTS ========
import hitSfx from '../../assets/sounds/monkey-hit.mp3';
import missSfx from '../../assets/sounds/monkey-miss.mp3';
import startSfx from '../../assets/sounds/game-start.mp3';
import winSfx from '../../assets/sounds/game-win.mp3';
import loseSfx from '../../assets/sounds/game-lose.mp3';
import bgLoopSfx from '../../assets/sounds/game-bg-loop.mp3';

// ============ BRANDING ============
const HNC_RED = '#dc2626';
const HNC_RED_DARK = '#7c2d12';
const HNC_BG = '#020617';

// ============ NEW YEAR ============
const HNC_APP_DOWNLOAD_URL = 'https://onelink.to/c8p8b8';

// ============ GAME CONSTANTS ============
const REQUIRED_HITS = 7;
const MAX_ROUNDS = 20;
const MONKEY_INTERVAL_MS = 800;
const MONKEY_VISIBLE_MS = 420;
const FALLBACK_MAX_CHANCES = 3; // must match server MONKEY_MAX_CHANCES

// ============ Animations ============
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
`;
const floaty = keyframes`
  0% { transform: translateY(0); opacity: .85; }
  100% { transform: translateY(-18px); opacity: 0; }
`;

// ============ Styled Components ============
const MobileContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: HNC_BG,
  padding: 0,
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(900px 420px at 10% 0%, rgba(220,38,38,.18) 0%, rgba(2,6,23,0) 60%), radial-gradient(900px 420px at 90% 20%, rgba(124,45,18,.14) 0%, rgba(2,6,23,0) 60%)',
    pointerEvents: 'none',
  },
  [theme.breakpoints.down('sm')]: {
    '&::before': {
      background:
        'radial-gradient(700px 360px at 0% 0%, rgba(220,38,38,.18) 0%, rgba(2,6,23,0) 60%), radial-gradient(700px 360px at 100% 10%, rgba(124,45,18,.14) 0%, rgba(2,6,23,0) 60%)',
    },
  },
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  background: 'rgba(15, 23, 42, 0.96)',
  borderBottom: '1px solid rgba(148, 163, 184, 0.28)',
  padding: '14px 18px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  backdropFilter: 'blur(10px)',
  [theme.breakpoints.down('sm')]: { padding: '10px 12px' },
}));

const StatusBadge = styled(Chip)(({ locked }) => ({
  height: 30,
  borderRadius: 16,
  fontSize: '0.7rem',
  fontWeight: 800,
  padding: '0 10px',
  background: locked
    ? 'linear-gradient(135deg, #4b5563 0%, #111827 100%)'
    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
  color: '#fff',
  border: 'none',
}));

const GameButton = styled(Button)(({ disabled, theme }) => ({
  width: '100%',
  maxWidth: 360,
  height: 56,
  borderRadius: 32,
  fontSize: '0.95rem',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  background: disabled
    ? 'linear-gradient(135deg, #374151 0%, #111827 100%)'
    : `linear-gradient(135deg, ${HNC_RED} 0%, ${HNC_RED_DARK} 100%)`,
  color: '#fff',
  border: 'none',
  boxShadow: disabled ? '0 4px 10px rgba(15, 23, 42, 0.8)' : '0 10px 25px rgba(220, 38, 38, 0.6)',
  transition: 'all 0.2s ease',
  '&:hover': disabled
    ? {}
    : { transform: 'translateY(-2px)', boxShadow: '0 14px 32px rgba(220, 38, 38, 0.75)' },
  [theme.breakpoints.down('sm')]: { height: 52, fontSize: '0.9rem', maxWidth: 340 },
}));

const InfoCard = styled(Paper)(() => ({
  background: 'rgba(15, 23, 42, 0.98)',
  borderRadius: 18,
  border: '1px solid rgba(55, 65, 81, 0.85)',
  padding: '12px 14px',
}));

const GridWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: 380,
  margin: '0 auto',
  padding: '10px',
  borderRadius: 22,
  background: 'radial-gradient(circle at top, #020617, #020617)',
  border: '1px solid rgba(31, 41, 55, 0.9)',
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9)',
  [theme.breakpoints.down('sm')]: { maxWidth: 340, padding: '8px', borderRadius: 18 },
  '@media (max-width:360px)': { maxWidth: 320, padding: '7px' },
}));

const MonkeyGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  [theme.breakpoints.down('sm')]: { gap: 7 },
  '@media (max-width:360px)': { gap: 6 },
}));

// ✅ Mobile tap-safe Hole (pointer events only; prevents double fire)
const Hole = styled(Box)(({ active, disabled }) => ({
  position: 'relative',
  aspectRatio: '1 / 1',
  borderRadius: 14,
  overflow: 'hidden',
  background: 'radial-gradient(circle at 30% 10%, #1f2937 0%, #020617 60%)',
  border: '2px solid #020617',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  cursor: disabled ? 'default' : 'pointer',
  transform: active ? 'translateY(-4px)' : 'translateY(0)',
  transition: 'all 0.15s ease-out',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',

  // ✅ key for mobile tapping reliability
  touchAction: 'manipulation', // allow taps, prevent delay/zoom
  WebkitUserSelect: 'none',

  // block clicks when disabled
  pointerEvents: disabled ? 'none' : 'auto',
}));

const Monkey = styled(Box)(({ active }) => ({
  position: 'relative',
  transform: active ? 'translateY(0)' : 'translateY(80%)',
  opacity: active ? 1 : 0,
  transition: 'all 0.15s ease-out',
  fontSize: '2.4rem',
  userSelect: 'none',
  pointerEvents: 'none', // ✅ emoji never steals touch/click
}));

const ScoreBadge = styled(Box)(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '3px 9px',
  background: '#020617',
  border: '1px solid rgba(55, 65, 81, 0.9)',
  fontSize: 11,
  color: 'rgba(209,213,219,0.9)',
  gap: 4,
}));

const ResultChip = styled(Chip)(({ iswin }) => ({
  height: 50,
  borderRadius: 26,
  fontSize: '0.9rem',
  fontWeight: 900,
  padding: '0 18px',
  maxWidth: '100%',
  background: iswin
    ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
    : 'linear-gradient(135deg, #4b5563 0%, #111827 100%)',
  color: '#fff',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
}));

const PrizeListCard = styled(Paper)(() => ({
  background: 'rgba(15, 23, 42, 0.98)',
  borderRadius: 18,
  border: '1px solid rgba(75, 85, 99, 0.9)',
  padding: '12px 14px',
}));

// ===== helper =====
const makeSessionId = () => {
  try {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch (e) {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const MonkeyGamePage = () => {
  const { profile } = useAuth();

  // ✅ New Year popup state (NO localStorage)
  const [openNY, setOpenNY] = useState(false);
  const nyShownRef = useRef(false);

  // Prize config
  const [prizeItems, setPrizeItems] = useState([]);
  const [wheelLoading, setWheelLoading] = useState(true);
  const [wheelError, setWheelError] = useState(null);

  // Game state
  const [activeIndex, setActiveIndex] = useState(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [roundCount, setRoundCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Chances
  const [chancesLeft, setChancesLeft] = useState(null);
  const [maxChances, setMaxChances] = useState(FALLBACK_MAX_CHANCES);

  // Prevent double consuming attempt
  const [isStarting, setIsStarting] = useState(false);
  const startLockRef = useRef(false);
  const sessionIdRef = useRef(null);

  // lock after last game ends
  const lockAfterThisGameRef = useRef(false);

  // Locking / errors
  const [locked, setLocked] = useState(false);
  const [spinError, setSpinError] = useState(null);

  // Result
  const [resultMessage, setResultMessage] = useState('');
  const [isWin, setIsWin] = useState(false);

  // Prize dialog
  const [prizePopupOpen, setPrizePopupOpen] = useState(false);
  const [wonPrizeText, setWonPrizeText] = useState('');
  const [wonPrize, setWonPrize] = useState(null);

  // Timers
  const intervalRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  // Round click protection
  const hasHitThisRoundRef = useRef(false);

  // SOUND REFS
  const bgLoopRef = useRef(null);
  const startRef = useRef(null);
  const hitRef = useRef(null);
  const missRef = useRef(null);
  const winRef = useRef(null);
  const loseRef = useRef(null);

  // ✅ show NY popup once per session after profile loads
  useEffect(() => {
    if (!profile) return;
    if (nyShownRef.current) return;
    nyShownRef.current = true;
    setOpenNY(true);
  }, [profile]);

  // Preload sounds
  useEffect(() => {
    if (typeof Audio === 'undefined') return;

    bgLoopRef.current = new Audio(bgLoopSfx);
    bgLoopRef.current.loop = true;
    bgLoopRef.current.volume = 0.25;

    startRef.current = new Audio(startSfx);
    startRef.current.volume = 0.7;

    hitRef.current = new Audio(hitSfx);
    hitRef.current.volume = 0.7;

    missRef.current = new Audio(missSfx);
    missRef.current.volume = 0.5;

    winRef.current = new Audio(winSfx);
    winRef.current.volume = 0.8;

    loseRef.current = new Audio(loseSfx);
    loseRef.current.volume = 0.7;

    return () => {
      [bgLoopRef, startRef, hitRef, missRef, winRef, loseRef].forEach((ref) => {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      });
    };
  }, []);

  const playSound = (ref, { loop = false } = {}) => {
    try {
      if (!ref.current) return;
      ref.current.loop = loop;
      ref.current.currentTime = 0;
      ref.current.play().catch(() => {});
    } catch (e) {}
  };

  const stopSound = (ref) => {
    if (!ref.current) return;
    try {
      ref.current.pause();
      ref.current.currentTime = 0;
    } catch (e) {}
  };

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const loadPrizeConfig = useCallback(async () => {
    setWheelError(null);
    setWheelLoading(true);
    try {
      const res = await getWheelConfig();
      setPrizeItems(res?.data || []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load prize configuration';
      setWheelError(msg);
    } finally {
      setWheelLoading(false);
    }
  }, []);

  const loadMonkeyStatus = useCallback(async () => {
    try {
      const res = await getMonkeyStatus();
      const { chancesLeft, maxChances, locked } = res?.data || {};

      setChancesLeft(typeof chancesLeft === 'number' ? chancesLeft : FALLBACK_MAX_CHANCES);
      setMaxChances(typeof maxChances === 'number' ? maxChances : FALLBACK_MAX_CHANCES);

      // keep unlocked while playing
      setLocked(isRunning ? false : !!locked);
    } catch (err) {
      console.error('getMonkeyStatus error:', err);
      setChancesLeft(FALLBACK_MAX_CHANCES);
      setMaxChances(FALLBACK_MAX_CHANCES);
    }
  }, [isRunning]);

  useEffect(() => {
    loadPrizeConfig();
    loadMonkeyStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetGameState = () => {
    setHits(0);
    setMisses(0);
    setRoundCount(0);
    setResultMessage('');
    setIsWin(false);
    setWonPrize(null);
    setWonPrizeText('');
    setPrizePopupOpen(false);
    hasHitThisRoundRef.current = false;
  };

  const startGame = async () => {
    if (locked || isRunning || isStarting) return;
    if (startLockRef.current) return;

    setSpinError(null);

    if (wheelLoading) {
      setSpinError('Prizes are still loading. Please wait.');
      return;
    }
    if (!prizeItems || prizeItems.length === 0) {
      setSpinError('Prizes are not configured yet. Please try again later.');
      return;
    }
    if (typeof chancesLeft === 'number' && chancesLeft <= 0 && locked) {
      setSpinError('You have used all your chances.');
      return;
    }

    startLockRef.current = true;
    setIsStarting(true);

    const sessionId = makeSessionId();
    sessionIdRef.current = sessionId;

    try {
      const res = await requestMonkeyAttempt(sessionId);
      const { chancesLeft: serverChances, maxChances: serverMax, locked: serverLocked, allowed } = res?.data || {};

      if (typeof serverChances === 'number') setChancesLeft(serverChances);
      if (typeof serverMax === 'number') setMaxChances(serverMax);

      if (allowed === false) {
        setLocked(true);
        setSpinError('You have used all your chances.');
        return;
      }

      lockAfterThisGameRef.current = !!serverLocked;

      // unlock while playing so taps work
      setLocked(false);

      resetGameState();
      setIsRunning(true);
      playSound(startRef);
      playSound(bgLoopRef, { loop: true });
    } catch (err) {
      const data = err?.response?.data;
      const msg = data?.message || err?.message || 'Unable to start game. Please contact staff.';
      setSpinError(msg);

      if (data?.locked) {
        setLocked(true);
        setChancesLeft(typeof data.chancesLeft === 'number' ? data.chancesLeft : 0);
      }
    } finally {
      setIsStarting(false);
      startLockRef.current = false;
    }
  };

  // ✅ No minus points
  const handleHoleTap = useCallback(
    (index) => {
      if (!isRunning) return;
      if (hasHitThisRoundRef.current) return;

      if (index === activeIndex && activeIndex !== null) {
        hasHitThisRoundRef.current = true;
        setHits((prev) => prev + 1);
        playSound(hitRef);
      } else {
        setMisses((prev) => prev + 1);
        playSound(missRef);
      }
    },
    [activeIndex, isRunning]
  );

  const endGame = useCallback(
    async (didWin) => {
      setIsRunning(false);
      clearTimers();
      setActiveIndex(null);
      stopSound(bgLoopRef);

      if (lockAfterThisGameRef.current) setLocked(true);
      lockAfterThisGameRef.current = false;

      const noChancesLeft = locked || (typeof chancesLeft === 'number' && chancesLeft <= 0);

      if (!didWin) {
        setIsWin(false);
        setResultMessage(
          noChancesLeft
            ? 'No more chances left. Better luck next time 🐒'
            : `Round over. You still have ${typeof chancesLeft === 'number' ? chancesLeft : maxChances} chance(s) left.`
        );
        playSound(loseRef);
        await loadMonkeyStatus();
        return;
      }

      try {
        const res = await spinOnce();
        const { status, prize } = res?.data || {};
        const reallyWon = status === 'won' || (!!prize && status !== 'lost' && status !== 'error');

        if (reallyWon) {
          setLocked(true);

          const prizeTitle = typeof prize === 'string' ? prize : prize?.title || prize?.name || 'Special Prize';

          let prizeObj = null;
          if (prize && typeof prize === 'object') prizeObj = prize;
          else if (typeof prize === 'string') {
            const normalized = prize.trim().toLowerCase();
            prizeObj = prizeItems.find((item) => item?.title && item.title.trim().toLowerCase() === normalized) || null;
          }

          setIsWin(true);
          setResultMessage(`You won: ${prizeTitle}`);
          setWonPrizeText(prizeTitle);
          setWonPrize(prizeObj);
          setPrizePopupOpen(true);

          playSound(winRef);
        } else {
          setIsWin(false);
          setResultMessage('Great tapping, but no prize this time.');
          playSound(loseRef);
        }
      } catch (err) {
        setIsWin(false);
        const msg = err?.response?.data?.message || err?.message || 'Game result failed. Please contact staff.';
        setSpinError(msg);
        setResultMessage('We could not confirm your prize. Please contact staff.');
        playSound(loseRef);
      } finally {
        await loadMonkeyStatus();
      }
    },
    [clearTimers, locked, chancesLeft, maxChances, prizeItems, loadMonkeyStatus]
  );

  // game loop
  useEffect(() => {
    if (!isRunning) {
      clearTimers();
      setActiveIndex(null);
      stopSound(bgLoopRef);
      return;
    }

    const setRandomHole = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      const idx = Math.floor(Math.random() * 9);
      setActiveIndex(idx);
      hasHitThisRoundRef.current = false;
      setRoundCount((prev) => prev + 1);

      hideTimeoutRef.current = setTimeout(() => setActiveIndex(null), MONKEY_VISIBLE_MS);
    };

    setRandomHole();
    intervalRef.current = setInterval(setRandomHole, MONKEY_INTERVAL_MS);

    return () => clearTimers();
  }, [isRunning, clearTimers]);

  // win/lose
  useEffect(() => {
    if (!isRunning) return;
    if (hits >= REQUIRED_HITS) endGame(true);
    else if (roundCount >= MAX_ROUNDS) endGame(false);
  }, [hits, roundCount, isRunning, endGame]);

  const displayChances = typeof chancesLeft === 'number' ? chancesLeft : maxChances;

  const gameDisabled =
    locked ||
    isRunning ||
    isStarting ||
    wheelLoading ||
    !!wheelError ||
    (typeof chancesLeft === 'number' && chancesLeft <= 0 && locked);

  const progress = MAX_ROUNDS > 0 ? Math.min(100, (roundCount / MAX_ROUNDS) * 100) : 0;

  return (
    <MobileContainer>
      {/* ✅ Happy New Year popup */}
      <NewYearPopup
        open={openNY}
        onClose={() => setOpenNY(false)}
        name={profile?.name || 'Guest'}
        downloadUrl={HNC_APP_DOWNLOAD_URL}
      />

      {/* floating particles */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.6 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${(i * 11) % 100}%`,
              top: `${(i * 13) % 100}%`,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: i % 2 === 0 ? 'rgba(220,38,38,.55)' : 'rgba(148,163,184,.28)',
              animation: `${floaty} ${2.4 + (i % 5) * 0.4}s ease-in-out infinite`,
            }}
          />
        ))}
      </Box>

      {/* Header */}
      <HeaderSection>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.1}>
          <Stack direction="row" spacing={1.3} alignItems="center">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${HNC_RED} 0%, ${HNC_RED_DARK} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `${pulse} 2.2s ease-in-out infinite`,
                boxShadow: '0 10px 26px rgba(220,38,38,.35)',
              }}
            >
              <LocalFireDepartmentIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>

            <Box>
              <Typography
                variant="h6"
                fontWeight={900}
                sx={{ color: '#fff', letterSpacing: 0.5, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}
              >
                Tap The Monkey
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.9)', fontSize: '0.7rem' }}>
                Hit {REQUIRED_HITS} times in max {MAX_ROUNDS} rounds
              </Typography>
            </Box>
          </Stack>

          <StatusBadge
            locked={locked ? 1 : 0}
            icon={locked ? <LockIcon sx={{ fontSize: 16 }} /> : <StarIcon sx={{ fontSize: 16 }} />}
            label={locked ? 'Locked' : 'Ready'}
          />
        </Stack>

        <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.75)', fontSize: '0.8rem' }}>
          Hey <strong style={{ color: HNC_RED, fontWeight: 800 }}>{profile?.name || 'Guest'}</strong>, you have{' '}
          <strong>
            {displayChances}/{maxChances}
          </strong>{' '}
          chance{displayChances === 1 ? '' : 's'} left.
        </Typography>
      </HeaderSection>

      {/* Main */}
      <Box sx={{ position: 'relative', zIndex: 1, pb: { xs: 3, sm: 4 }, flex: 1 }}>
        {/* Hero */}
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2.6, sm: 3 }, pb: 2, textAlign: 'center' }}>
          <Fade in timeout={600}>
            <Typography
              variant="h4"
              fontWeight={900}
              sx={{
                color: '#fff',
                mb: 1,
                background: 'linear-gradient(135deg, #ffffff 0%, #dc2626 40%, #991b1b 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '1.35rem', sm: '1.7rem' },
              }}
            >
              Whack the Monkey 🐒
            </Typography>
          </Fade>
          <Fade in timeout={900}>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(203, 213, 225, 0.85)',
                maxWidth: 420,
                mx: 'auto',
                lineHeight: 1.6,
                fontSize: { xs: '0.85rem', sm: '0.92rem' },
              }}
            >
              Tap only when the monkey pops up. Get <strong>{REQUIRED_HITS}</strong> hits within{' '}
              <strong>{MAX_ROUNDS}</strong> rounds. Wrong taps count as a miss.
            </Typography>
          </Fade>
        </Box>

        {/* Errors */}
        {wheelError && (
          <Slide direction="down" in={!!wheelError}>
            <Box sx={{ px: { xs: 2, sm: 3 }, mb: 2 }}>
              <Alert variant="warning" style={{ borderRadius: 12 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <span>
                    <strong>Error:</strong> {wheelError}
                  </span>
                  <IconButton size="small" onClick={loadPrizeConfig} sx={{ color: HNC_RED }}>
                    <CasinoIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Alert>
            </Box>
          </Slide>
        )}

        {spinError && (
          <Slide direction="down" in={!!spinError}>
            <Box sx={{ px: { xs: 2, sm: 3 }, mb: 2 }}>
              <Alert variant="danger" style={{ borderRadius: 12 }}>
                {spinError}
              </Alert>
            </Box>
          </Slide>
        )}

        {/* Game Grid */}
        <Box sx={{ px: { xs: 2, sm: 3 }, mb: 3, display: 'flex', justifyContent: 'center' }}>
          <GridWrapper>
            {/* Timer */}
            <Box sx={{ mb: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(209, 213, 219, 0.9)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Game Progress
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.9)', fontSize: '0.7rem' }}>
                  {roundCount}/{MAX_ROUNDS} rounds
                </Typography>
              </Stack>

              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: '#0f172a',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${HNC_RED}, ${HNC_RED_DARK})`,
                  },
                }}
              />
            </Box>

            {/* Score */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <ScoreBadge>
                Hits:&nbsp;<strong style={{ color: '#4ade80' }}>{hits}</strong>/{REQUIRED_HITS}
              </ScoreBadge>
              <ScoreBadge>
                Miss:&nbsp;<strong style={{ color: '#f97373' }}>{misses}</strong>
              </ScoreBadge>
            </Stack>

            {/* Holes ✅ PERFECT mobile tap (Pointer Events ONLY) */}
            <MonkeyGrid>
              {Array.from({ length: 9 }).map((_, index) => {
                const isActive = index === activeIndex;

                const onPointerDown = (e) => {
                  // prevent ghost-click & scroll
                  e.preventDefault();
                  e.stopPropagation();
                  handleHoleTap(index);
                };

                return (
                  <Hole
                    key={index}
                    active={isActive ? 1 : 0}
                    disabled={!isRunning}
                    role="button"
                    tabIndex={0}
                    onPointerDown={onPointerDown}
                    onPointerUp={(e) => e.preventDefault()}
                    onPointerCancel={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onPointerDown(e);
                    }}
                  >
                    <Monkey active={isActive ? 1 : 0}>{isActive ? '🐵' : '🕳️'}</Monkey>
                  </Hole>
                );
              })}
            </MonkeyGrid>
          </GridWrapper>
        </Box>

        {/* Result */}
        {resultMessage && (
          <Grow in={!!resultMessage} timeout={400}>
            <Box sx={{ px: { xs: 2, sm: 3 }, mb: 2.5, display: 'flex', justifyContent: 'center' }}>
              <ResultChip
                iswin={isWin ? 1 : 0}
                icon={isWin ? <EmojiEventsIcon sx={{ fontSize: 18 }} /> : undefined}
                label={resultMessage}
              />
            </Box>
          </Grow>
        )}

        {/* Start */}
        <Box sx={{ px: { xs: 2, sm: 3 }, mb: 3, display: 'flex', justifyContent: 'center' }}>
          <GameButton
            disabled={gameDisabled}
            onClick={startGame}
            startIcon={
              locked ? (
                <LockIcon />
              ) : isRunning || isStarting ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : (
                <CasinoIcon />
              )
            }
          >
            {locked || (typeof chancesLeft === 'number' && chancesLeft <= 0 && locked)
              ? 'No More Games'
              : isRunning
              ? 'Game in Progress'
              : isStarting
              ? 'Starting...'
              : 'Start Game'}
          </GameButton>
        </Box>

        {/* Prize List (optional but nice) */}
        {prizeItems?.length > 0 && (
          <Box sx={{ px: { xs: 2, sm: 3 }, mb: 3 }}>
            <PrizeListCard elevation={0}>
              <Typography variant="subtitle2" sx={{ color: '#e5e7eb', fontWeight: 800, mb: 0.8, fontSize: '0.85rem' }}>
                Sample Prizes You Can Win
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'rgba(148, 163, 184, 0.9)', fontSize: '0.75rem', display: 'block', mb: 1 }}
              >
                Prize is selected securely after you win.
              </Typography>
              <Stack spacing={0.6}>
                {prizeItems.slice(0, 6).map((item, idx) => (
                  <Stack key={item._id || idx} direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: HNC_RED, flexShrink: 0 }} />
                    <Typography
                      variant="body2"
                      sx={{ color: 'rgba(209, 213, 219, 0.95)', fontSize: '0.8rem' }}
                      noWrap
                    >
                      {item.title || item.label || item.name || `Prize ${idx + 1}`}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </PrizeListCard>
          </Box>
        )}

        {/* Rules */}
        <Box sx={{ px: { xs: 2, sm: 3 }, mb: 3 }}>
          <InfoCard elevation={0}>
            <Typography variant="subtitle2" sx={{ color: '#e5e7eb', fontWeight: 800, mb: 0.6, fontSize: '0.85rem' }}>
              Game Rules
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(209, 213, 219, 0.9)', fontSize: '0.8rem', lineHeight: 1.6 }}>
              • You get <strong>{maxChances}</strong> chances total. <br />
              • Tap only when the monkey appears. <br />
              • Reach {REQUIRED_HITS} hits within {MAX_ROUNDS} rounds. <br />
              • Wrong tap counts as a miss (no minus points). <br />
              • If you win, prize is selected on server and emailed to you.
            </Typography>
          </InfoCard>
        </Box>
      </Box>

      {/* Prize Dialog */}
      <Dialog
        open={prizePopupOpen}
        onClose={() => setPrizePopupOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 5,
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)',
            border: '2px solid rgba(220, 38, 38, 0.5)',
            m: { xs: 1.5, sm: 2 },
            maxWidth: 380,
            '@media (max-width:400px)': { m: 0, width: '100%', maxWidth: '100%', borderRadius: 0 },
          },
        }}
        TransitionComponent={Grow}
        transitionDuration={400}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setPrizePopupOpen(false)}
            sx={{ position: 'absolute', right: 10, top: 10, color: 'rgba(209, 213, 219, 0.9)' }}
          >
            <CloseIcon />
          </IconButton>

          <DialogContent sx={{ textAlign: 'center', py: { xs: 4, sm: 5 }, px: { xs: 3, sm: 4 } }}>
            <Box sx={{ mb: 2.5 }}>
              <Box
                sx={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${HNC_RED} 0%, ${HNC_RED_DARK} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                }}
              >
                <EmojiEventsIcon sx={{ fontSize: 46, color: '#fff' }} />
              </Box>
            </Box>

            <Typography variant="h3" fontWeight={900} sx={{ color: '#f9fafb', mb: 1, fontSize: '1.6rem' }}>
              🎉 You Won!
            </Typography>

            <Typography variant="body1" sx={{ color: 'rgba(209, 213, 219, 0.9)', mb: 3, fontSize: '0.9rem' }}>
              Your quick reflexes unlocked this HotnCool reward:
            </Typography>

            <Box sx={{ background: '#020617', borderRadius: 16, border: '1px solid rgba(55, 65, 81, 0.9)', p: 2 }}>
              {wonPrize?.imageUrl && (
                <Box sx={{ mb: 1.4, borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(243, 244, 246, 0.8)' }}>
                  <img
                    src={wonPrize.imageUrl}
                    alt={wonPrize.title || wonPrizeText || 'Prize'}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </Box>
              )}

              <Typography variant="h5" fontWeight={900} sx={{ color: '#fecaca', mb: wonPrize?.description ? 0.5 : 0, fontSize: '1.1rem' }}>
                {wonPrize?.title || wonPrizeText || 'Mystery Prize'}
              </Typography>

              {wonPrize?.description && (
                <Typography variant="body2" sx={{ color: 'rgba(209, 213, 219, 0.9)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                  {wonPrize.description}
                </Typography>
              )}
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={() => setPrizePopupOpen(false)}
              sx={{
                mt: 3,
                height: 50,
                borderRadius: 4,
                fontSize: '0.95rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: `linear-gradient(135deg, ${HNC_RED} 0%, ${HNC_RED_DARK} 100%)`,
                boxShadow: '0 10px 28px rgba(220, 38, 38, 0.6)',
              }}
            >
              OK, Got It
            </Button>
          </DialogContent>
        </Box>
      </Dialog>
    </MobileContainer>
  );
};

export default MonkeyGamePage;
