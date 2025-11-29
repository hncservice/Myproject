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
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.4), 0 0 40px rgba(220, 38, 38, 0.2); }
  50% { box-shadow: 0 0 30px rgba(220, 38, 38, 0.6), 0 0 60px rgba(220, 38, 38, 0.3); }
`;

// Styled Components
const MobileContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)',
  padding: 0,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 
      'radial-gradient(circle at 20% 30%, rgba(220, 38, 38, 0.15) 0%, transparent 50%), ' +
      'radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
  backdropFilter: 'blur(20px)',
  borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
  padding: '20px 20px 16px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
}));

const StatusBadge = styled(Chip)(({ locked }) => ({
  height: 28,
  borderRadius: 14,
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0 8px',
  background: locked 
    ? 'linear-gradient(135deg, #475569 0%, #334155 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  color: '#fff',
  border: locked 
    ? '1px solid rgba(148, 163, 184, 0.3)'
    : '1px solid rgba(248, 113, 113, 0.5)',
  animation: locked ? 'none' : `${pulse} 2s ease-in-out infinite`,
  boxShadow: locked 
    ? 'none'
    : '0 4px 12px rgba(220, 38, 38, 0.4)',
}));

const SpinButton = styled(Button)(({ disabled }) => ({
  width: '100%',
  maxWidth: 280,
  height: 64,
  borderRadius: 32,
  fontSize: '1.1rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  background: disabled
    ? 'linear-gradient(135deg, #475569 0%, #334155 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
  color: '#fff',
  border: 'none',
  boxShadow: disabled
    ? 'none'
    : '0 8px 24px rgba(220, 38, 38, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
    transition: 'left 0.5s',
  },
  '&:hover': disabled ? {} : {
    transform: 'translateY(-2px) scale(1.02)',
    boxShadow: '0 12px 32px rgba(220, 38, 38, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    '&::before': {
      left: '100%',
    },
  },
  '&:active': disabled ? {} : {
    transform: 'translateY(0) scale(0.98)',
  },
}));

const InfoCard = styled(Paper)({
  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
  backdropFilter: 'blur(10px)',
  borderRadius: 20,
  border: '1px solid rgba(148, 163, 184, 0.15)',
  padding: '20px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
});

const WheelContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '40px 20px',
  position: 'relative',
  animation: `${float} 3s ease-in-out infinite`,
});

const ResultChip = styled(Chip)(({ iswin }) => ({
  height: 48,
  borderRadius: 24,
  fontSize: '0.95rem',
  fontWeight: 700,
  padding: '0 20px',
  background: iswin
    ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
    : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
  color: '#fff',
  boxShadow: iswin
    ? '0 8px 24px rgba(220, 38, 38, 0.5)'
    : '0 4px 12px rgba(0, 0, 0, 0.3)',
  animation: iswin ? `${glow} 2s ease-in-out infinite` : 'none',
}));

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
      {/* Header */}
      <HeaderSection>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocalFireDepartmentIcon sx={{ color: '#dc2626', fontSize: 28 }} />
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ color: '#fff', letterSpacing: 0.3 }}
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
        <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.8)', fontSize: '0.85rem' }}>
          Welcome, <strong style={{ color: '#e2e8f0' }}>{profile?.name || 'Guest'}</strong>
        </Typography>
      </HeaderSection>

      <Box sx={{ position: 'relative', zIndex: 1, pb: 4 }}>
        {/* Hero Section */}
        <Box sx={{ px: 3, pt: 3, pb: 2, textAlign: 'center' }}>
          <Fade in timeout={800}>
            <Typography
              variant="h5"
              fontWeight={900}
              sx={{
                color: '#fff',
                mb: 1,
                background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              Spin & Win Amazing Prizes
            </Typography>
          </Fade>
          <Fade in timeout={1000}>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(203, 213, 225, 0.9)', maxWidth: 320, mx: 'auto', lineHeight: 1.6 }}
            >
              One spin. One chance. <span style={{ color: '#fca5a5', fontWeight: 700 }}>Make it count!</span>
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
        <WheelContainer>
          {wheelLoading ? (
            <Paper
              elevation={8}
              sx={{
                width: { xs: 280, sm: 320 },
                height: { xs: 280, sm: 320 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 1) 100%)',
                border: '6px solid rgba(220, 38, 38, 0.3)',
              }}
            >
              <Box textAlign="center">
                <CircularProgress size={50} sx={{ color: '#dc2626', mb: 2 }} />
                <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  Loading...
                </Typography>
              </Box>
            </Paper>
          ) : (
            <SpinWheel
              items={wheelItems}
              rotation={rotation}
              spinning={spinning}
              winnerBurst={winnerBurst}
            />
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
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <StarIcon sx={{ color: '#fbbf24', fontSize: 22, mt: 0.3 }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#e2e8f0', mb: 0.5 }}>
                    How It Works
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.8)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                    • Server-calculated results ensure fairness{'\n'}
                    • One spin per user only{'\n'}
                    • Winners notified via email with QR code
                  </Typography>
                </Box>
              </Stack>

              <Box
                sx={{
                  borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                  pt: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.7)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  🔒 Once you spin, your account is permanently locked. Wheel animation is for visual effect only—results are server-determined.
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
            borderRadius: 4,
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
            border: '2px solid rgba(220, 38, 38, 0.5)',
            m: 2,
            maxWidth: 360,
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
              right: 8,
              top: 8,
              color: 'rgba(203, 213, 225, 0.7)',
              zIndex: 1,
            }}
          >
            <CloseIcon />
          </IconButton>

          <DialogContent sx={{ textAlign: 'center', py: 5, px: 3 }}>
            <Box
              sx={{
                animation: `${pulse} 1.5s ease-in-out infinite`,
                display: 'inline-block',
                mb: 3,
              }}
            >
              <EmojiEventsIcon
                sx={{
                  fontSize: 80,
                  color: '#dc2626',
                  filter: 'drop-shadow(0 8px 24px rgba(220, 38, 38, 0.6))',
                }}
              />
            </Box>

            <Typography
              variant="h4"
              fontWeight={900}
              sx={{
                color: '#fff',
                mb: 1,
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              🎉 Congratulations!
            </Typography>

            <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.8)', mb: 3 }}>
              You've won an amazing prize
            </Typography>

            <Box
              sx={{
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(153, 27, 27, 0.3) 100%)',
                border: '2px solid rgba(220, 38, 38, 0.5)',
                borderRadius: 3,
                py: 3,
                px: 2,
                mb: 3,
              }}
            >
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  color: '#fca5a5',
                  mb: 1,
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                }}
              >
                {wonPrizeText || 'Mystery Prize'}
              </Typography>
            </Box>

            <InfoCard elevation={0} sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.9)', mb: 1, lineHeight: 1.6 }}>
                Show this screen or your email QR code to staff to claim your reward.
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.7)', fontStyle: 'italic' }}>
                Terms & conditions may apply
              </Typography>
            </InfoCard>

            <Button
              variant="contained"
              fullWidth
              onClick={() => setPrizePopupOpen(false)}
              sx={{
                height: 56,
                borderRadius: 3,
                fontSize: '1rem',
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                boxShadow: '0 8px 24px rgba(220, 38, 38, 0.5)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  boxShadow: '0 12px 32px rgba(220, 38, 38, 0.6)',
                },
              }}
            >
              Awesome!
            </Button>
          </DialogContent>
        </Box>
      </Dialog>
    </MobileContainer>
  );
};

export default SpinPage;