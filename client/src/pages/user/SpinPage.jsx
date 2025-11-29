import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarIcon from '@mui/icons-material/Star';
import CloseIcon from '@mui/icons-material/Close';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import { useAuth } from '../../context/AuthContext';
import { spinOnce, getWheelConfig } from '../../api/spinApi';
import SpinWheel from '../../components/SpinWheel';

// Animations
const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(1deg); }
  50% { transform: translateY(-15px) rotate(0deg); }
  75% { transform: translateY(-8px) rotate(-1deg); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
`;

const glow = keyframes`
  0%, 100% { 
    box-shadow: 0 0 20px rgba(220, 38, 38, 0.5), 0 0 40px rgba(220, 38, 38, 0.3);
    filter: brightness(1);
  }
  50% { 
    box-shadow: 0 0 40px rgba(220, 38, 38, 0.8), 0 0 80px rgba(220, 38, 38, 0.5);
    filter: brightness(1.2);
  }
`;

const spin = keyframes`
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.1); }
  100% { transform: rotate(360deg) scale(1); }
`;

const slideUp = keyframes`
  from { 
    opacity: 0;
    transform: translateY(30px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

const confetti = keyframes`
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(1000px) rotate(720deg); opacity: 0; }
`;

// Styled Components
const MobileContainer = styled(Box)({
  minHeight: '100vh',
  background: '#0a0e1a',
  padding: 0,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: 
      'radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 40%), ' +
      'radial-gradient(circle at 70% 80%, rgba(220, 38, 38, 0.15) 0%, transparent 40%), ' +
      'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
    animation: `${spin} 30s linear infinite`,
    pointerEvents: 'none',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '300px',
    background: 'linear-gradient(to top, rgba(10, 14, 26, 0.9), transparent)',
    pointerEvents: 'none',
  },
});

const HeaderSection = styled(Box)({
  background: 'rgba(15, 23, 42, 0.6)',
  backdropFilter: 'blur(30px) saturate(180%)',
  borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
  padding: '20px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
});

const StatusBadge = styled(Chip)(({ locked }) => ({
  height: 32,
  borderRadius: 16,
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0 12px',
  background: locked 
    ? 'linear-gradient(135deg, #475569 0%, #1e293b 100%)'
    : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  color: '#fff',
  border: 'none',
  boxShadow: locked 
    ? '0 2px 8px rgba(0, 0, 0, 0.3)'
    : '0 4px 16px rgba(139, 92, 246, 0.5)',
  animation: locked ? 'none' : `${pulse} 2.5s ease-in-out infinite`,
  transition: 'all 0.3s ease',
}));

const SpinButton = styled(Button)(({ disabled }) => ({
  width: '100%',
  maxWidth: 300,
  height: 70,
  borderRadius: 35,
  fontSize: '1.15rem',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  background: disabled
    ? 'linear-gradient(135deg, #334155 0%, #1e293b 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #7c2d12 100%)',
  color: '#fff',
  border: 'none',
  boxShadow: disabled
    ? '0 4px 12px rgba(0, 0, 0, 0.3)'
    : '0 10px 30px rgba(220, 38, 38, 0.6), 0 0 60px rgba(220, 38, 38, 0.3)',
  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  position: 'relative',
  overflow: 'hidden',
  animation: disabled ? 'none' : `${glow} 2s ease-in-out infinite`,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
    transform: 'rotate(45deg)',
    animation: disabled ? 'none' : `${shimmer} 3s linear infinite`,
  },
  '&:hover': disabled ? {} : {
    transform: 'translateY(-4px) scale(1.05)',
    boxShadow: '0 15px 40px rgba(220, 38, 38, 0.8), 0 0 80px rgba(220, 38, 38, 0.4)',
  },
  '&:active': disabled ? {} : {
    transform: 'translateY(-1px) scale(1.02)',
  },
}));

const InfoCard = styled(Paper)({
  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%)',
  backdropFilter: 'blur(20px) saturate(180%)',
  borderRadius: 24,
  border: '1px solid rgba(139, 92, 246, 0.2)',
  padding: '24px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  animation: `${slideUp} 0.6s ease-out`,
});

const WheelContainer = styled(Box)(({ spinning }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '50px 20px',
  position: 'relative',
  animation: spinning ? 'none' : `${float} 4s ease-in-out infinite`,
  transition: 'all 0.5s ease',
  '& > *': {
    filter: spinning ? 'blur(0)' : 'drop-shadow(0 20px 60px rgba(220, 38, 38, 0.3))',
  },
}));

const ResultChip = styled(Chip)(({ iswin }) => ({
  height: 56,
  borderRadius: 28,
  fontSize: '1rem',
  fontWeight: 800,
  padding: '0 24px',
  background: iswin
    ? 'linear-gradient(135deg, #dc2626 0%, #7c2d12 100%)'
    : 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
  color: '#fff',
  boxShadow: iswin
    ? '0 10px 40px rgba(220, 38, 38, 0.6), 0 0 80px rgba(220, 38, 38, 0.3)'
    : '0 4px 16px rgba(0, 0, 0, 0.4)',
  animation: iswin ? `${glow} 2s ease-in-out infinite` : `${slideUp} 0.5s ease-out`,
  border: iswin ? '2px solid rgba(248, 113, 113, 0.5)' : 'none',
}));

const PrizeBox = styled(Box)({
  background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(124, 45, 18, 0.3) 100%)',
  border: '2px solid rgba(220, 38, 38, 0.6)',
  borderRadius: 20,
  padding: '32px 24px',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(220, 38, 38, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.1)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.05), transparent)',
    transform: 'rotate(45deg)',
    animation: `${shimmer} 3s linear infinite`,
  },
});

const SpinPage = () => {
  const { profile } = useAuth();

  const [wheelItems, setWheelItems] = useState([]);
  const [wheelLoading, setWheelLoading] = useState(true);
  const [wheelError, setWheelError] = useState(null);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const [resultMessage, setResultMessage] = useState('');
  const [isWin, setIsWin] = useState(false);

  const [locked, setLocked] = useState(() => !!profile?.hasSpun);
  const [spinError, setSpinError] = useState(null);

  const [winnerBurst, setWinnerBurst] = useState(false);
  const [prizePopupOpen, setPrizePopupOpen] = useState(false);
  const [wonPrizeText, setWonPrizeText] = useState('');

  const loadWheelConfig = async () => {
    setWheelError(null);
    setWheelLoading(true);
    try {
      const res = await getWheelConfig();
      const data = res?.data || [];
      setWheelItems(data);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load wheel configuration';
      setWheelError(msg);
    } finally {
      setWheelLoading(false);
    }
  };

  useEffect(() => {
    loadWheelConfig();
  }, []);

  const handleSpin = async () => {
    if (locked || spinning) return;

    if (wheelLoading) {
      setSpinError('Wheel is still loading. Please wait.');
      return;
    }

    if (!wheelItems || wheelItems.length === 0) {
      setSpinError('Wheel is not configured. Please try again later.');
      return;
    }

    setSpinError(null);
    setResultMessage('');
    setIsWin(false);
    setWinnerBurst(false);
    setPrizePopupOpen(false);
    setWonPrizeText('');
    setSpinning(true);

    const extraDegrees = 360 * 6 + Math.floor(Math.random() * 360);
    setRotation((prev) => prev + extraDegrees);

    try {
      const res = await spinOnce();
      const { status, prize } = res.data || {};

      setTimeout(() => {
        setSpinning(false);

        if (status === 'won') {
          setIsWin(true);
          setResultMessage(`You won: ${prize}`);
          setWonPrizeText(prize || 'Special Prize');
          setWinnerBurst(true);
          setTimeout(() => setWinnerBurst(false), 1200);
          setPrizePopupOpen(true);
        } else if (status === 'lost') {
          setIsWin(false);
          setResultMessage('No win this time. Better luck next time!');
        } else {
          setIsWin(false);
          setResultMessage('Unexpected result from server.');
        }

        setLocked(true);
      }, 3200);
    } catch (err) {
      setSpinning(false);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Spin failed. Please try again later.';
      setSpinError(msg);

      if (/already spun|already spin|already.*wheel/i.test(msg)) {
        setLocked(true);
      }
    }
  };

  const spinDisabled = locked || spinning || wheelLoading || !!wheelError;

  return (
    <MobileContainer>
      <HeaderSection>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dc2626 0%, #7c2d12 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(220, 38, 38, 0.4)',
                animation: `${pulse} 2s ease-in-out infinite`,
              }}
            >
              <LocalFireDepartmentIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Typography
              variant="h6"
              fontWeight={900}
              sx={{ 
                color: '#fff', 
                letterSpacing: 0.5,
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              }}
            >
              Lucky Spin
            </Typography>
          </Stack>
          <StatusBadge
            locked={locked ? 1 : 0}
            icon={locked ? <LockIcon sx={{ fontSize: 16 }} /> : <StarIcon sx={{ fontSize: 16 }} />}
            label={locked ? 'Locked' : 'Active'}
          />
        </Stack>
        <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.7)', fontSize: '0.85rem' }}>
          Hey <strong style={{ color: '#8b5cf6', fontWeight: 700 }}>{profile?.name || 'Guest'}</strong>, ready to win?
        </Typography>
      </HeaderSection>

      <Box sx={{ position: 'relative', zIndex: 1, pb: 4 }}>
        {/* Hero Section */}
        <Box sx={{ px: 3, pt: 4, pb: 3, textAlign: 'center' }}>
          <Fade in timeout={800}>
            <Box>
              <Typography
                variant="h4"
                fontWeight={900}
                sx={{
                  color: '#fff',
                  mb: 1.5,
                  background: 'linear-gradient(135deg, #ffffff 0%, #8b5cf6 50%, #dc2626 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Spin the Wheel
                <br />
                Win Big Prizes! 🎁
              </Typography>
            </Box>
          </Fade>
          <Fade in timeout={1200}>
            <Typography
              variant="body1"
              sx={{ 
                color: 'rgba(203, 213, 225, 0.8)', 
                maxWidth: 340, 
                mx: 'auto', 
                lineHeight: 1.7,
                fontSize: '0.95rem',
              }}
            >
              One spin, one opportunity. <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Make your moment count!</span>
            </Typography>
          </Fade>
        </Box>

        {/* Alerts */}
        {wheelError && (
          <Slide direction="down" in={!!wheelError}>
            <Box sx={{ px: 3, mb: 2 }}>
              <Alert variant="warning" style={{ borderRadius: 12 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <span><strong>Error:</strong> {wheelError}</span>
                  <IconButton size="small" onClick={loadWheelConfig} sx={{ color: '#1e3a8a' }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Alert>
            </Box>
          </Slide>
        )}

        {spinError && (
          <Slide direction="down" in={!!spinError}>
            <Box sx={{ px: 3, mb: 2 }}>
              <Alert variant="danger" style={{ borderRadius: 12 }}>
                {spinError}
              </Alert>
            </Box>
          </Slide>
        )}

        {/* Wheel */}
        <WheelContainer spinning={spinning ? 1 : 0}>
          {wheelLoading ? (
            <Paper
              elevation={12}
              sx={{
                width: { xs: 300, sm: 340 },
                height: { xs: 300, sm: 340 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '8px solid rgba(139, 92, 246, 0.3)',
                boxShadow: '0 20px 80px rgba(139, 92, 246, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  background: 'linear-gradient(45deg, transparent, rgba(139, 92, 246, 0.1), transparent)',
                  transform: 'rotate(45deg)',
                  animation: `${shimmer} 2s linear infinite`,
                },
              }}
            >
              <Box textAlign="center" sx={{ position: 'relative', zIndex: 1 }}>
                <CircularProgress size={60} thickness={4} sx={{ color: '#8b5cf6', mb: 2 }} />
                <Typography variant="body1" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                  Loading Prizes...
                </Typography>
              </Box>
            </Paper>
          ) : (
            <Box
              sx={{
                position: 'relative',
                filter: spinning 
                  ? 'brightness(1.2) saturate(1.3)' 
                  : 'brightness(1) saturate(1)',
                transition: 'filter 0.3s ease',
              }}
            >
              <SpinWheel
                items={wheelItems}
                rotation={rotation}
                spinning={spinning}
                winnerBurst={winnerBurst}
              />
            </Box>
          )}
        </WheelContainer>

        {/* Result Message */}
        {resultMessage && (
          <Grow in={!!resultMessage} timeout={500}>
            <Box sx={{ px: 3, mb: 3, display: 'flex', justifyContent: 'center' }}>
              <ResultChip
                iswin={isWin ? 1 : 0}
                icon={isWin ? <EmojiEventsIcon sx={{ fontSize: 20 }} /> : undefined}
                label={resultMessage}
              />
            </Box>
          </Grow>
        )}

        {/* Spin Button */}
        <Box sx={{ px: 3, mb: 3, display: 'flex', justifyContent: 'center' }}>
          <SpinButton
            disabled={spinDisabled}
            onClick={handleSpin}
            startIcon={
              spinning ? (
                <CircularProgress size={20} sx={{ color: '#fff' }} />
              ) : locked ? (
                <LockIcon />
              ) : (
                <CasinoIcon />
              )
            }
          >
            {spinning ? 'Spinning...' : locked ? 'Already Spun' : 'Spin Now'}
          </SpinButton>
        </Box>

        {/* Info Cards */}
        <Box sx={{ px: 3, mb: 3 }}>
          <InfoCard elevation={0}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  <StarIcon sx={{ color: '#fff', fontSize: 26 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#fff', mb: 1, fontSize: '1.05rem' }}>
                    How It Works
                  </Typography>
                  <Stack spacing={1}>
                    {[
                      'Results calculated securely on server',
                      'One spin per user - make it memorable',
                      'Winners get instant email with QR code'
                    ].map((text, idx) => (
                      <Stack key={idx} direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #dc2626 100%)',
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.9)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                          {text}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Stack>

              <Box
                sx={{
                  borderTop: '1px solid rgba(139, 92, 246, 0.2)',
                  pt: 2,
                  px: 2,
                  py: 1.5,
                  background: 'rgba(139, 92, 246, 0.05)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.8)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  🔒 <strong>Fair Play:</strong> Once you spin, no more chances. The wheel animation is visual only—your fate is sealed on the server!
                </Typography>
              </Box>
            </Stack>
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
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.4)',
            backdropFilter: 'blur(30px)',
            m: 2,
            maxWidth: 380,
            boxShadow: '0 20px 80px rgba(139, 92, 246, 0.4), 0 0 100px rgba(220, 38, 38, 0.2)',
          },
        }}
        TransitionComponent={Grow}
        transitionDuration={500}
      >
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
          {/* Animated background */}
          <Box
            sx={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 
                'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 50%), ' +
                'radial-gradient(circle, rgba(220, 38, 38, 0.1) 0%, transparent 50%)',
              animation: `${spin} 20s linear infinite`,
              pointerEvents: 'none',
            }}
          />

          <IconButton
            onClick={() => setPrizePopupOpen(false)}
            sx={{
              position: 'absolute',
              right: 12,
              top: 12,
              color: 'rgba(203, 213, 225, 0.7)',
              bgcolor: 'rgba(30, 41, 59, 0.8)',
              zIndex: 2,
              '&:hover': {
                bgcolor: 'rgba(30, 41, 59, 1)',
                color: '#fff',
              },
            }}
          >
            <CloseIcon />
          </IconButton>

          <DialogContent sx={{ textAlign: 'center', py: 6, px: 4, position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                animation: `${pulse} 1.5s ease-in-out infinite`,
                display: 'inline-block',
                mb: 3,
              }}
            >
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dc2626 0%, #7c2d12 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 12px 40px rgba(220, 38, 38, 0.6), 0 0 80px rgba(220, 38, 38, 0.3)',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    padding: 4,
                    background: 'linear-gradient(135deg, #8b5cf6, #dc2626)',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    animation: `${spin} 3s linear infinite`,
                  },
                }}
              >
                <EmojiEventsIcon
                  sx={{
                    fontSize: 56,
                    color: '#fff',
                    filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))',
                  }}
                />
              </Box>
            </Box>

            <Typography
              variant="h3"
              fontWeight={900}
              sx={{
                color: '#fff',
                mb: 1.5,
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                letterSpacing: '-0.02em',
              }}
            >
              🎉 You Won!
            </Typography>

            <Typography variant="body1" sx={{ color: 'rgba(203, 213, 225, 0.8)', mb: 4, fontSize: '1rem' }}>
              Congratulations on your amazing prize!
            </Typography>

            <PrizeBox>
              <Typography
                variant="h4"
                fontWeight={900}
                sx={{
                  color: '#fca5a5',
                  textShadow: '0 2px 12px rgba(220, 38, 38, 0.8)',
                  position: 'relative',
                  zIndex: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                {wonPrizeText || 'Mystery Prize'}
              </Typography>
            </PrizeBox>

            <InfoCard elevation={0} sx={{ mt: 4, mb: 3 }}>
              <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.9)', mb: 1.5, lineHeight: 1.7, fontWeight: 500 }}>
                📱 Show this screen or your email QR code to our staff to claim your reward.
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.7)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                Terms & conditions apply. Prize must be claimed within validity period.
              </Typography>
            </InfoCard>

            <Button
              variant="contained"
              fullWidth
              onClick={() => setPrizePopupOpen(false)}
              sx={{
                height: 60,
                borderRadius: 4,
                fontSize: '1.05rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                boxShadow: '0 10px 30px rgba(139, 92, 246, 0.5)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  boxShadow: '0 15px 40px rgba(139, 92, 246, 0.6)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              Claim My Prize!
            </Button>
          </DialogContent>
        </Box>
      </Dialog>
    </MobileContainer>
  );
};

export default SpinPage;