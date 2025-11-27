// client/src/pages/user/SpinPage.jsx
import React, { useEffect, useState } from 'react';
import { Alert, Card as BsCard, Container } from 'react-bootstrap';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Chip,
  Paper,
  Fade,
  Zoom,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarIcon from '@mui/icons-material/Star';

import { useAuth } from '../../context/AuthContext';
import { spinOnce, getWheelConfig } from '../../api/spinApi';
import SpinWheel from '../../components/SpinWheel';

// COLORS
const NAVY_DARK = '#020617';   // very dark navy
const NAVY = '#0f172a';        // slate/navy
const NAVY_ACCENT = '#1e3a8a'; // accent navy
const RED = '#dc2626';
const RED_DARK = '#991b1b';

// Outer card
const StyledCard = styled(BsCard)(() => ({
  borderRadius: 28,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background:
    'radial-gradient(circle at top left, rgba(30,64,175,0.18), transparent 60%), ' +
    'radial-gradient(circle at bottom right, rgba(220,38,38,0.16), transparent 55%), ' +
    'linear-gradient(160deg, #020617 0%, #020617 35%, #020617 100%)',
  overflow: 'hidden',
  backdropFilter: 'blur(18px)',
  boxShadow: '0 30px 80px rgba(15,23,42,0.8)',
}));

// Main spin button
const SpinButton = styled(Button)(() => ({
  textTransform: 'uppercase',
  fontWeight: 800,
  padding: '14px 52px',
  borderRadius: 999,
  fontSize: '0.95rem',
  boxShadow: '0 14px 40px rgba(220,38,38,0.6)',
  letterSpacing: '0.08em',
  border: 'none',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px) scale(1.01)',
    boxShadow: '0 18px 50px rgba(248,113,113,0.85)',
  },
  '&:disabled': {
    boxShadow: 'none',
    opacity: 0.7,
    transform: 'none',
  },
}));

// Small tag chip in header
const HeaderChip = styled(Chip)(() => ({
  borderRadius: 999,
  fontSize: '0.7rem',
  height: 24,
  paddingInline: 4,
  background:
    'linear-gradient(135deg, rgba(248,250,252,0.09), rgba(15,23,42,0.9))',
  border: '1px solid rgba(148,163,184,0.6)',
  color: '#e5e7eb',
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

  const buttonIcon = spinning ? (
    <CircularProgress size={18} sx={{ color: '#fee2e2' }} />
  ) : locked ? (
    <LockIcon />
  ) : (
    <CasinoIcon />
  );

  const buttonLabel = spinning
    ? 'Spinning...'
    : locked
    ? 'Already Spun'
    : 'Spin Now';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, #1e3a8a 0, #020617 60%, #020617 100%)',
        py: { xs: 3, md: 5 },
        px: 2,
      }}
    >
      <Container style={{ maxWidth: 920 }}>
        <StyledCard>
          {/* Header Section */}
          <Box
            sx={{
              px: { xs: 3, md: 4 },
              pt: { xs: 3, md: 4 },
              pb: 2,
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  color: '#f9fafb',
                  letterSpacing: 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 0.3,
                }}
              >
                <EmojiEventsIcon
                  sx={{ color: RED, fontSize: 26, transform: 'translateY(1px)' }}
                />
                Lucky Spin Wheel
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(148,163,184,0.95)' }}
              >
                Hello,{' '}
                <strong style={{ color: '#e5e7eb' }}>
                  {profile?.name || 'Guest'}
                </strong>
                . One spin, one chance. Make it count.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <HeaderChip
                icon={<StarIcon sx={{ fontSize: 16, color: '#e5e7eb' }} />}
                label="1 Spin Per User"
              />
              <HeaderChip
                label={locked ? 'Spin Locked' : 'Ready to Spin'}
                sx={{
                  backgroundColor: locked
                    ? 'rgba(148,163,184,0.25)'
                    : 'rgba(220,38,38,0.2)',
                  borderColor: locked
                    ? 'rgba(148,163,184,0.7)'
                    : 'rgba(248,113,113,0.7)',
                  color: locked ? '#e5e7eb' : '#fecaca',
                }}
              />
            </Stack>
          </Box>

          <Divider
            sx={{
              borderColor: 'rgba(31,41,55,0.9)',
              mt: 1,
              mb: { xs: 2, md: 3 },
            }}
          />

          {/* Main Content */}
          <Box sx={{ p: { xs: 3, md: 4 }, pt: { xs: 2, md: 1 } }}>
            <Typography
              variant="body2"
              color="rgba(148,163,184,0.95)"
              textAlign="center"
              mb={3}
            >
              Spin the wheel for a chance to win{' '}
              <span style={{ color: '#fecaca', fontWeight: 600 }}>
                exclusive prizes
              </span>
              .<br />
              <span style={{ color: RED, fontWeight: 700 }}>You only spin once.</span>
            </Typography>

            {/* Wheel Error Alert */}
            {wheelError && (
              <Fade in={!!wheelError}>
                <Alert variant="warning" className="mb-3">
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    flexWrap="wrap"
                    gap={2}
                  >
                    <span>
                      <strong>Wheel error:</strong> {wheelError}
                    </span>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={loadWheelConfig}
                      sx={{
                        borderColor: NAVY_ACCENT,
                        color: NAVY_ACCENT,
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': {
                          borderColor: NAVY_ACCENT,
                          background: 'rgba(30, 64, 175, 0.08)',
                        },
                      }}
                    >
                      Retry
                    </Button>
                  </Stack>
                </Alert>
              </Fade>
            )}

            {/* Spin Error Alert */}
            {spinError && (
              <Fade in={!!spinError}>
                <Alert variant="danger" className="mb-3">
                  {spinError}
                </Alert>
              </Fade>
            )}

            {/* Wheel + Side Info */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' },
                gap: { xs: 3, md: 4 },
                alignItems: 'center',
                mb: 3,
              }}
            >
              {/* Wheel Container */}
              <Box display="flex" justifyContent="center">
                {wheelLoading ? (
                  <Paper
                    elevation={6}
                    sx={{
                      width: 280,
                      height: 280,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      background:
                        'radial-gradient(circle at 30% 20%, rgba(248,250,252,0.15), rgba(15,23,42,1))',
                      border: '8px solid rgba(30,64,175,0.7)',
                    }}
                  >
                    <Box textAlign="center">
                      <CircularProgress
                        size={44}
                        sx={{ color: RED, mb: 2 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ color: '#e5e7eb', fontWeight: 600 }}
                      >
                        Loading prizes...
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
              </Box>

              {/* Info panel on right */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  background:
                    'linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,64,175,0.35))',
                  border: '1px solid rgba(51,65,85,0.9)',
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: '#e5e7eb',
                    fontWeight: 700,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                  }}
                >
                  <StarIcon sx={{ fontSize: 18, color: '#facc15' }} />
                  How it works
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(148,163,184,0.95)', mb: 1.5 }}
                >
                  • Spin is calculated securely on the server.
                  <br />
                  • You only get <b>one spin</b> per user.
                  <br />
                  • Winners receive prize details via email.
                </Typography>

                <Divider
                  sx={{
                    borderColor: 'rgba(51,65,85,0.9)',
                    my: 1.5,
                  }}
                />

                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(148,163,184,0.9)',
                    display: 'block',
                    lineHeight: 1.6,
                  }}
                >
                  ℹ️ Once you spin, your account is locked from spinning again.
                  Please ensure you are ready before starting the wheel.
                </Typography>
              </Paper>
            </Box>

            {/* Result Message */}
            {resultMessage && (
              <Zoom in={!!resultMessage}>
                <Box mb={3} display="flex" justifyContent="center">
                  <Chip
                    icon={isWin ? <EmojiEventsIcon /> : undefined}
                    label={resultMessage}
                    sx={{
                      fontWeight: 700,
                      px: 2.5,
                      py: 2.2,
                      fontSize: '0.9rem',
                      background: isWin
                        ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                        : 'linear-gradient(135deg, #64748b 0%, #1e293b 100%)',
                      color: '#f9fafb',
                      boxShadow: '0 6px 14px rgba(15,23,42,0.9)',
                    }}
                  />
                </Box>
              </Zoom>
            )}

            {/* Spin Button */}
            <Box mb={3} textAlign="center">
              <SpinButton
                variant="contained"
                startIcon={buttonIcon}
                disabled={spinDisabled}
                onClick={handleSpin}
                sx={{
                  background: locked
                    ? 'linear-gradient(135deg, #4b5563 0%, #1f2937 100%)'
                    : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  color: '#f9fafb',
                  '&:hover': {
                    background: locked
                      ? 'linear-gradient(135deg, #4b5563 0%, #111827 100%)'
                      : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  },
                }}
              >
                {buttonLabel}
              </SpinButton>
            </Box>

            {/* Info Note */}
            <Paper
              sx={{
                p: 1.8,
                background:
                  'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.98))',
                border: '1px solid rgba(30,64,175,0.5)',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(148,163,184,0.95)',
                  display: 'block',
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}
              >
                🔒 For fairness and security, the result is calculated on the
                server. The wheel animation is a visual representation only.
              </Typography>
            </Paper>
          </Box>
        </StyledCard>
      </Container>

      {/* Prize Winner Dialog */}
      <Dialog
        open={prizePopupOpen}
        onClose={() => setPrizePopupOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            border: '2px solid rgba(252, 165, 165, 0.9)',
            background:
              'radial-gradient(circle at top, rgba(30,64,175,0.4), #020617 65%)',
          },
        }}
      >
        <DialogTitle
          sx={{
            textAlign: 'center',
            fontWeight: 900,
            py: 3,
            background:
              'linear-gradient(135deg, rgba(30,64,175,1) 0%, rgba(15,23,42,1) 60%)',
            color: 'white',
            fontSize: '1.5rem',
            letterSpacing: 0.5,
            textShadow: '0 3px 8px rgba(15,23,42,0.8)',
          }}
        >
          🎉 Congratulations!
        </DialogTitle>

        <DialogContent
          sx={{
            textAlign: 'center',
            py: 4,
            px: 3,
          }}
        >
          <EmojiEventsIcon
            sx={{
              fontSize: 68,
              color: RED,
              mb: 2,
              filter: 'drop-shadow(0 8px 20px rgba(248,113,113,0.7))',
            }}
          />

          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 2, color: '#e5e7eb' }}
          >
            You have unlocked
          </Typography>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              mb: 3,
              color: '#fecaca',
              textShadow: '0 3px 10px rgba(15,23,42,0.9)',
            }}
          >
            {wonPrizeText || 'A Mystery Prize'}
          </Typography>

          <Paper
            sx={{
              p: 2,
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,64,175,0.5))',
              border: '1px dashed rgba(148,163,184,0.8)',
              borderRadius: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: 'rgba(226,232,240,0.9)', mb: 1 }}
            >
              Show this screen or the email QR to the staff to claim your reward.
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(148,163,184,0.95)',
                fontStyle: 'italic',
              }}
            >
              Terms &amp; conditions may apply.
            </Typography>
          </Paper>
        </DialogContent>

        <DialogActions
          sx={{
            justifyContent: 'center',
            pb: 3,
            pt: 0,
          }}
        >
          <Button
            variant="contained"
            onClick={() => setPrizePopupOpen(false)}
            sx={{
              borderRadius: 999,
              px: 5,
              py: 1.4,
              fontWeight: 700,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: '#f9fafb',
              boxShadow: '0 10px 28px rgba(248,113,113,0.8)',
              '&:hover': {
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                boxShadow: '0 14px 36px rgba(248,113,113,0.9)',
              },
            }}
          >
            Awesome!
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SpinPage;
