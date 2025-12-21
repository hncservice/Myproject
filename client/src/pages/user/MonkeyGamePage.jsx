// client/src/pages/user/MonkeyGamePage.jsx
import React, { useEffect, useRef, useState } from 'react';
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
import {
  spinOnce,
  getWheelConfig,
  getMonkeyStatus,
  requestMonkeyAttempt,
} from '../../api/spinApi';

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

// ============ GAME CONSTANTS ============
const REQUIRED_HITS = 7;
const MAX_ROUNDS = 20;
const MONKEY_INTERVAL_MS = 800;
const FALLBACK_MAX_CHANCES = 3; // used only if backend is not reachable

// ============ Animations ============
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
`;

// ============ Styled Components ============
const MobileContainer = styled(Box)({
  minHeight: '100vh',
  background: HNC_BG,
  padding: 0,
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

const HeaderSection = styled(Box)(({ theme }) => ({
  background: 'rgba(15, 23, 42, 0.96)',
  borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
  padding: '14px 18px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  [theme.breakpoints.down('sm')]: {
    padding: '10px 12px',
  },
}));

const StatusBadge = styled(Chip)(({ locked }) => ({
  height: 30,
  borderRadius: 16,
  fontSize: '0.7rem',
  fontWeight: 700,
  padding: '0 10px',
  background: locked
    ? 'linear-gradient(135deg, #4b5563 0%, #111827 100%)'
    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
  color: '#fff',
  border: 'none',
}));

const GameButton = styled(Button)(({ disabled, theme }) => ({
  width: '100%',
  maxWidth: 320,
  height: 56,
  borderRadius: 32,
  fontSize: '0.95rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  background: disabled
    ? 'linear-gradient(135deg, #374151 0%, #111827 100%)'
    : `linear-gradient(135deg, ${HNC_RED} 0%, ${HNC_RED_DARK} 100%)`,
  color: '#fff',
  border: 'none',
  boxShadow: disabled
    ? '0 4px 10px rgba(15, 23, 42, 0.8)'
    : '0 10px 25px rgba(220, 38, 38, 0.6)',
  transition: 'all 0.2s ease',
  '&:hover': disabled
    ? {}
    : {
        transform: 'translateY(-2px)',
        boxShadow: '0 14px 32px rgba(220, 38, 38, 0.75)',
      },
  [theme.breakpoints.down('sm')]: {
    height: 52,
    fontSize: '0.9rem',
  },
}));

const InfoCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(15, 23, 42, 0.98)',
  borderRadius: 18,
  border: '1px solid rgba(55, 65, 81, 0.9)',
  padding: '12px 14px',
}));

const GridWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: 360,
  margin: '0 auto',
  padding: '10px',
  borderRadius: 22,
  background: 'radial-gradient(circle at top, #020617, #020617)',
  border: '1px solid rgba(31, 41, 55, 0.9)',
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9)',
  [theme.breakpoints.down('sm')]: {
    maxWidth: 320,
    padding: '8px',
    borderRadius: 18,
  },
}));

const MonkeyGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
}));

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
}));

const Monkey = styled(Box)(({ active }) => ({
  position: 'relative',
  transform: active ? 'translateY(0)' : 'translateY(80%)',
  opacity: active ? 1 : 0,
  transition: 'all 0.15s ease-out',
  fontSize: '2.4rem',
}));

const ScoreBadge = styled(Box)(({ theme }) => ({
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
  fontWeight: 800,
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

const PrizeListCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(15, 23, 42, 0.98)',
  borderRadius: 18,
  border: '1px solid rgba(75, 85, 99, 0.9)',
  padding: '12px 14px',
}));

// ============ Component ============
const MonkeyGamePage = () => {
  const { profile } = useAuth();

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

  // Chances (from backend)
  const [chancesLeft, setChancesLeft] = useState(null);
  const [maxChances, setMaxChances] = useState(FALLBACK_MAX_CHANCES);

  // Locking / errors
  const [locked, setLocked] = useState(() => !!profile?.hasSpun);
  const [spinError, setSpinError] = useState(null);

  // Result
  const [resultMessage, setResultMessage] = useState('');
  const [isWin, setIsWin] = useState(false);

  const [prizePopupOpen, setPrizePopupOpen] = useState(false);
  const [wonPrizeText, setWonPrizeText] = useState('');
  const [wonPrize, setWonPrize] = useState(null);

  const timerRef = useRef(null);
  const hasHitThisRoundRef = useRef(false);

  // SOUND REFS
  const bgLoopRef = useRef(null);
  const startRef = useRef(null);
  const hitRef = useRef(null);
  const missRef = useRef(null);
  const winRef = useRef(null);
  const loseRef = useRef(null);

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

  // ===== Load prize config =====
  const loadPrizeConfig = async () => {
    setWheelError(null);
    setWheelLoading(true);
    try {
      const res = await getWheelConfig();
      setPrizeItems(res?.data || []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load prize configuration';
      setWheelError(msg);
    } finally {
      setWheelLoading(false);
    }
  };

  // ===== Load monkey status (chances + lock) from backend =====
  const loadMonkeyStatus = async () => {
    try {
      const res = await getMonkeyStatus();
      const { chancesLeft, maxChances, locked } = res?.data || {};

      if (typeof chancesLeft === 'number') {
        setChancesLeft(chancesLeft);
      } else {
        setChancesLeft(FALLBACK_MAX_CHANCES);
      }

      if (typeof maxChances === 'number') {
        setMaxChances(maxChances);
      } else {
        setMaxChances(FALLBACK_MAX_CHANCES);
      }

      setLocked(!!locked);
    } catch (err) {
      console.error('getMonkeyStatus error:', err);
      // fallback to local 3 chances if backend fails
      setChancesLeft(FALLBACK_MAX_CHANCES);
      setMaxChances(FALLBACK_MAX_CHANCES);
    }
  };

  useEffect(() => {
    loadPrizeConfig();
    loadMonkeyStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Game logic =====
  const resetGameState = () => {
    setHits(0);
    setMisses(0);
    setRoundCount(0);
    setResultMessage('');
    setIsWin(false);
    setPrizePopupOpen(false);
    setWonPrize(null);
    setWonPrizeText('');
    hasHitThisRoundRef.current = false;
  };

  const startGame = async () => {
    if (locked || isRunning) return;

    if (wheelLoading) {
      setSpinError('Prizes are still loading. Please wait.');
      return;
    }

    if (!prizeItems || prizeItems.length === 0) {
      setSpinError('Prizes are not configured yet. Please try again later.');
      return;
    }

    // If chancesLeft is known and zero → do not start
    if (chancesLeft !== null && chancesLeft <= 0) {
      setSpinError('You have used all your chances.');
      return;
    }

    // 🔒 Ask backend if this attempt is allowed (increments attempts on server)
    try {
      const res = await requestMonkeyAttempt();
      const {
        chancesLeft: serverChances,
        maxChances: serverMax,
        locked: serverLocked,
      } = res?.data || {};

      if (typeof serverChances === 'number') {
        setChancesLeft(serverChances);
      }
      if (typeof serverMax === 'number') {
        setMaxChances(serverMax);
      }

      if (serverLocked) {
        setLocked(true);
        setSpinError('You have used all your chances.');
        return;
      }

      setLocked(false);
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        data?.message ||
        err?.message ||
        'Unable to start game. Please contact staff.';
      setSpinError(msg);

      if (data?.locked) {
        setLocked(true);
        if (typeof data.chancesLeft === 'number') {
          setChancesLeft(data.chancesLeft);
        } else {
          setChancesLeft(0);
        }
      }

      return;
    }

    // Backend says OK → start
    setSpinError(null);
    resetGameState();
    setIsRunning(true);
    playSound(startRef);
    playSound(bgLoopRef, { loop: true });
  };

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopSound(bgLoopRef);
      return;
    }

    const setRandomHole = () => {
      const idx = Math.floor(Math.random() * 9);
      setActiveIndex(idx);
      hasHitThisRoundRef.current = false;
      setRoundCount((prev) => prev + 1);
    };

    setRandomHole();
    timerRef.current = setInterval(setRandomHole, MONKEY_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    if (hits >= REQUIRED_HITS) {
      endGame(true);
    } else if (roundCount >= MAX_ROUNDS) {
      endGame(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, roundCount, isRunning]);

  const handleHoleTap = (index) => {
    if (!isRunning || locked) return;
    if (hasHitThisRoundRef.current) return;

    if (index === activeIndex) {
      hasHitThisRoundRef.current = true;
      setHits((prev) => prev + 1);
      playSound(hitRef);
    } else {
      setMisses((prev) => prev + 1);
      playSound(missRef);
    }
  };

  const endGame = async (didWin) => {
    setIsRunning(false);
    setActiveIndex(null);
    stopSound(bgLoopRef);

    const noChancesLeft =
      locked || (typeof chancesLeft === 'number' && chancesLeft <= 0);

    if (!didWin) {
      setIsWin(false);
      if (noChancesLeft) {
        setLocked(true);
        setResultMessage('No more chances left. Better luck next time 🐒');
      } else {
        const displayChances =
          typeof chancesLeft === 'number' ? chancesLeft : maxChances;
        setResultMessage(
          `Round over. You still have ${displayChances} chance${
            displayChances === 1 ? '' : 's'
          } left.`
        );
      }
      playSound(loseRef);
      return;
    }

    // WIN: call existing spinOnce → same email/prize flow as old spin wheel
    try {
      const res = await spinOnce();
      const { status, prize } = res?.data || {};

      const reallyWon =
        status === 'won' ||
        (!!prize && status !== 'lost' && status !== 'error');

      if (reallyWon) {
        setLocked(true); // user fully restricted after success

        const prizeTitle =
          typeof prize === 'string'
            ? prize
            : prize?.title || prize?.name || 'Special Prize';

        let prizeObj = null;

        if (prize && typeof prize === 'object') {
          prizeObj = prize;
        } else if (typeof prize === 'string') {
          const normalized = prize.trim().toLowerCase();
          prizeObj =
            prizeItems.find(
              (item) =>
                item?.title &&
                item.title.trim().toLowerCase() === normalized
            ) || null;
        }

        setIsWin(true);
        setResultMessage(`You won: ${prizeTitle}`);
        setWonPrizeText(prizeTitle);
        setWonPrize(prizeObj);
        setPrizePopupOpen(true);

        playSound(winRef);
      } else if (status === 'lost') {
        setIsWin(false);
        setResultMessage('Great tapping, but no prize this time.');
        playSound(loseRef);
      } else {
        setIsWin(false);
        setResultMessage('Unexpected result from server.');
        playSound(loseRef);
      }
    } catch (err) {
      setIsWin(false);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Game result failed. Please contact staff.';
      setSpinError(msg);
      setResultMessage('We could not confirm your prize. Please contact staff.');
      playSound(loseRef);
    }
  };

  const displayChances =
    typeof chancesLeft === 'number' ? chancesLeft : maxChances;

  const gameDisabled =
    locked ||
    isRunning ||
    wheelLoading ||
    !!wheelError ||
    (typeof chancesLeft === 'number' && chancesLeft <= 0);

  const progress =
    MAX_ROUNDS > 0 ? Math.min(100, (roundCount / MAX_ROUNDS) * 100) : 0;

  return (
    <MobileContainer>
      {/* Header */}
      <HeaderSection>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={1.1}
        >
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
              }}
            >
              <LocalFireDepartmentIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={900}
                sx={{
                  color: '#fff',
                  letterSpacing: 0.5,
                  fontSize: { xs: '0.95rem', sm: '1.1rem' },
                }}
              >
                Tap The Monkey
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(148, 163, 184, 0.9)',
                  fontSize: '0.7rem',
                }}
              >
                Hit the monkey head {REQUIRED_HITS} times in max {MAX_ROUNDS} rounds
              </Typography>
            </Box>
          </Stack>
          <StatusBadge
            locked={locked ? 1 : 0}
            icon={
              locked ? (
                <LockIcon sx={{ fontSize: 16 }} />
              ) : (
                <StarIcon sx={{ fontSize: 16 }} />
              )
            }
            label={locked ? 'Locked' : 'Ready'}
          />
        </Stack>
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(203, 213, 225, 0.7)',
            fontSize: '0.8rem',
          }}
        >
          Hey{' '}
          <strong style={{ color: HNC_RED, fontWeight: 700 }}>
            {profile?.name || 'Guest'}
          </strong>
          , you have{' '}
          <strong>
            {displayChances}/{maxChances}
          </strong>{' '}
          chance{displayChances === 1 ? '' : 's'} left today.
        </Typography>
      </HeaderSection>

      {/* Main Area */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          pb: 4,
          flex: 1,
        }}
      >
        {/* Hero text */}
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            pt: 3,
            pb: 2,
            textAlign: 'center',
          }}
        >
          <Fade in timeout={600}>
            <Typography
              variant="h4"
              fontWeight={900}
              sx={{
                color: '#fff',
                mb: 1,
                background:
                  'linear-gradient(135deg, #ffffff 0%, #dc2626 40%, #991b1b 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '1.4rem', sm: '1.7rem' },
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
                maxWidth: 360,
                mx: 'auto',
                lineHeight: 1.6,
                fontSize: { xs: '0.85rem', sm: '0.9rem' },
              }}
            >
              Tap only when the monkey pops up from a hole. Get{' '}
              <strong>{REQUIRED_HITS}</strong> correct hits within{' '}
              <strong>{MAX_ROUNDS}</strong> rounds. You have{' '}
              <strong>{maxChances}</strong> chances in total.
            </Typography>
          </Fade>
        </Box>

        {/* Errors */}
        {wheelError && (
          <Slide direction="down" in={!!wheelError}>
            <Box sx={{ px: { xs: 2, sm: 3 }, mb: 2 }}>
              <Alert variant="warning" style={{ borderRadius: 12 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <span>
                    <strong>Error:</strong> {wheelError}
                  </span>
                  <IconButton
                    size="small"
                    onClick={loadPrizeConfig}
                    sx={{ color: HNC_RED }}
                  >
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

        {/* Game Grid + Timer */}
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            mb: 3,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <GridWrapper>
            {/* Timer bar */}
            <Box sx={{ mb: 1.5 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 0.6 }}
              >
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
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(148, 163, 184, 0.9)',
                    fontSize: '0.7rem',
                  }}
                >
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

            {/* Score row */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <ScoreBadge>
                Hits:&nbsp;
                <strong style={{ color: '#4ade80' }}>{hits}</strong>/
                {REQUIRED_HITS}
              </ScoreBadge>
              <ScoreBadge>
                Miss:&nbsp;
                <strong style={{ color: '#f97373' }}>{misses}</strong>
              </ScoreBadge>
            </Stack>

            {/* 3x3 holes */}
            <MonkeyGrid>
              {Array.from({ length: 9 }).map((_, index) => {
                const isActive = index === activeIndex;
                return (
                  <Hole
                    key={index}
                    active={isActive ? 1 : 0}
                    disabled={!isRunning || locked}
                    onClick={() => handleHoleTap(index)}
                  >
                    <Monkey active={isActive ? 1 : 0}>
                      {isRunning || isActive ? '🐵' : '🕳️'}
                    </Monkey>
                  </Hole>
                );
              })}
            </MonkeyGrid>
          </GridWrapper>
        </Box>

        {/* Result Message */}
        {resultMessage && (
          <Grow in={!!resultMessage} timeout={400}>
            <Box
              sx={{
                px: { xs: 2, sm: 3 },
                mb: 2.5,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <ResultChip
                iswin={isWin ? 1 : 0}
                icon={isWin ? <EmojiEventsIcon sx={{ fontSize: 18 }} /> : undefined}
                label={resultMessage}
              />
            </Box>
          </Grow>
        )}

        {/* Start Button */}
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            mb: 3,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <GameButton
            disabled={gameDisabled}
            onClick={startGame}
            startIcon={
              locked ? (
                <LockIcon />
              ) : isRunning ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : (
                <CasinoIcon />
              )
            }
          >
            {locked || (typeof chancesLeft === 'number' && chancesLeft <= 0)
              ? 'No More Games'
              : isRunning
              ? 'Game in Progress'
              : 'Start Game'}
          </GameButton>
        </Box>

        {/* Prize List Card */}
        {prizeItems && prizeItems.length > 0 && (
          <Box sx={{ px: { xs: 2, sm: 3 }, mb: 3 }}>
            <PrizeListCard elevation={0}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: '#e5e7eb',
                  fontWeight: 700,
                  mb: 0.8,
                  fontSize: '0.85rem',
                }}
              >
                Sample Prizes You Can Win
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(148, 163, 184, 0.9)',
                  fontSize: '0.75rem',
                  display: 'block',
                  mb: 1,
                }}
              >
                Prizes are decided by the system after you get {REQUIRED_HITS} hits.
              </Typography>
              <Stack spacing={0.6}>
                {prizeItems.slice(0, 6).map((item, idx) => (
                  <Stack
                    key={item._id || idx}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: HNC_RED,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'rgba(209, 213, 219, 0.95)',
                        fontSize: '0.8rem',
                      }}
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

        {/* Short rules card */}
        <Box sx={{ px: { xs: 2, sm: 3 }, mb: 3 }}>
          <InfoCard elevation={0}>
            <Typography
              variant="subtitle2"
              sx={{
                color: '#e5e7eb',
                fontWeight: 700,
                mb: 0.6,
                fontSize: '0.85rem',
              }}
            >
              Game Rules
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(209, 213, 219, 0.9)',
                fontSize: '0.8rem',
                lineHeight: 1.6,
              }}
            >
              • You get <strong>{maxChances}</strong> game chances in total. <br />
              • Tap only when the monkey head appears in a hole. <br />
              • Reach {REQUIRED_HITS} correct hits within {MAX_ROUNDS} rounds. <br />
              • On a win, prize is selected securely on the server and sent to your email.
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
            background:
              'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)',
            border: '2px solid rgba(220, 38, 38, 0.5)',
            m: { xs: 1.5, sm: 2 },
            maxWidth: 380,
            '@media (max-width:400px)': {
              m: 0,
              width: '100%',
              maxWidth: '100%',
              borderRadius: 0,
            },
          },
        }}
        TransitionComponent={Grow}
        transitionDuration={400}
      >
        <Box sx={{ position: 'relative' }}>
          <IconButton
            onClick={() => setPrizePopupOpen(false)}
            sx={{
              position: 'absolute',
              right: 10,
              top: 10,
              color: 'rgba(209, 213, 219, 0.9)',
            }}
          >
            <CloseIcon />
          </IconButton>

          <DialogContent
            sx={{
              textAlign: 'center',
              py: { xs: 4, sm: 5 },
              px: { xs: 3, sm: 4 },
            }}
          >
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
                <EmojiEventsIcon
                  sx={{
                    fontSize: 46,
                    color: '#fff',
                  }}
                />
              </Box>
            </Box>

            <Typography
              variant="h3"
              fontWeight={900}
              sx={{
                color: '#f9fafb',
                mb: 1,
                fontSize: '1.6rem',
              }}
            >
              🎉 You Won!
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: 'rgba(209, 213, 219, 0.9)',
                mb: 3,
                fontSize: '0.9rem',
              }}
            >
              Your quick reflexes unlocked this HotnCool reward:
            </Typography>

            <Box
              sx={{
                background: '#020617',
                borderRadius: 16,
                border: '1px solid rgba(55, 65, 81, 0.9)',
                p: 2,
              }}
            >
              {wonPrize?.imageUrl && (
                <Box
                  sx={{
                    mb: 1.4,
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1px solid rgba(243, 244, 246, 0.8)',
                  }}
                >
                  <img
                    src={wonPrize.imageUrl}
                    alt={wonPrize.title || wonPrizeText || 'Prize'}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </Box>
              )}

              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  color: '#fecaca',
                  mb: wonPrize?.description ? 0.5 : 0,
                  fontSize: '1.1rem',
                }}
              >
                {wonPrize?.title || wonPrizeText || 'Mystery Prize'}
              </Typography>

              {wonPrize?.description && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(209, 213, 219, 0.9)',
                    fontSize: '0.82rem',
                    lineHeight: 1.6,
                  }}
                >
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
                fontWeight: 800,
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
