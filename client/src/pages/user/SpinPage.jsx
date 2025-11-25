// client/src/pages/user/SpinPage.jsx
import React, { useEffect, useState } from 'react';
import { Alert, Card as BsCard } from 'react-bootstrap';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import RefreshIcon from '@mui/icons-material/Refresh';

import { useAuth } from '../../context/AuthContext';
import { spinOnce, getWheelConfig } from '../../api/spinApi';
import SpinWheel from '../../components/SpinWheel';
import './SpinPage.css';

// Simple wrapper around react-bootstrap Card to keep your layout
const Card = styled(BsCard)(() => ({
  borderRadius: 20,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
}));

const SpinButton = styled(Button)(() => ({
  textTransform: 'uppercase',
  fontWeight: 700,
  padding: '10px 30px',
}));

const SpinPage = () => {
  const { token, profile } = useAuth();

  const [wheelItems, setWheelItems] = useState([]);
  const [wheelLoading, setWheelLoading] = useState(true);
  const [wheelError, setWheelError] = useState(null);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const [resultMessage, setResultMessage] = useState('');
  const [isWin, setIsWin] = useState(false);
  const [locked, setLocked] = useState(false);
  const [spinError, setSpinError] = useState(null);

  const [winnerBurst, setWinnerBurst] = useState(false);
  const [prizePopupOpen, setPrizePopupOpen] = useState(false);
  const [wonPrizeText, setWonPrizeText] = useState('');

  const loadWheelConfig = async () => {
    try {
      setWheelLoading(true);
      setWheelError(null);

      const res = await getWheelConfig(token);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    setWinnerBurst(false); // reset any previous burst
    setPrizePopupOpen(false);
    setWonPrizeText('');
    setSpinning(true);

    // For security, backend decides win/lose.
    // This rotation is only for animation if you later re-add a visual wheel.
    const extraDegrees = 360 * 6 + Math.floor(Math.random() * 360);
    setRotation((prev) => prev + extraDegrees);

    try {
      const res = await spinOnce(token);
      const { status, prize } = res.data;

      setTimeout(() => {
        setSpinning(false);
        if (status === 'won') {
          setIsWin(true);
          setResultMessage(`You won: ${prize}`);
          setWonPrizeText(prize || 'Special Prize');

          // trigger winner burst (confetti) for a short time
          setWinnerBurst(true);
          setTimeout(() => setWinnerBurst(false), 1200);

          // open popup
          setPrizePopupOpen(true);
        } else {
          setIsWin(false);
          setResultMessage('No win this time. Better luck next time!');
        }
        setLocked(true);
      }, 3200);
    } catch (err) {
      setSpinning(false);
      const msg = err?.response?.data?.message || 'Spin failed';
      setSpinError(msg);

      if (/already spun|already spin|already.*wheel/i.test(msg)) {
        setLocked(true);
      }
    }
  };

  const spinDisabled = locked || spinning || wheelLoading || !!wheelError;

  const buttonIcon = spinning ? (
    <CircularProgress size={18} color="inherit" />
  ) : locked ? (
    <LockIcon />
  ) : (
    <CasinoIcon />
  );

  const buttonLabel = spinning
    ? 'Spinning...'
    : locked
    ? 'Already spun'
    : 'Spin now';

  return (
    <div className="spin-page-wrapper">
      <Card className="spin-card text-center">
        <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
          {/* Greeting */}
          <Typography variant="h5" fontWeight={700} mb={1}>
            Hello {profile?.name || 'Guest'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Tap the button below to shake the gift box. You can spin only once.
          </Typography>

          {/* Wheel config error */}
          {wheelError && (
            <Fade in={!!wheelError}>
              <Alert variant="warning" className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span>
                    <strong>Wheel error:</strong> {wheelError}
                  </span>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={loadWheelConfig}
                  >
                    Retry
                  </Button>
                </div>
              </Alert>
            </Fade>
          )}

          {/* Spin error */}
          {spinError && (
            <Fade in={!!spinError}>
              <Alert variant="danger" className="mb-3">
                {spinError}
              </Alert>
            </Fade>
          )}

          {/* Result message chip under box */}
          {resultMessage && (
            <Zoom in={!!resultMessage}>
              <Box mb={2}>
                <Chip
                  icon={isWin ? <EmojiEventsIcon /> : undefined}
                  label={resultMessage}
                  color={isWin ? 'success' : 'default'}
                  sx={{ fontWeight: 600, px: 1.5 }}
                />
              </Box>
            </Zoom>
          )}

          {/* Wheel / loading placeholder */}
          <Box mb={3} display="flex" justifyContent="center">
            {wheelLoading ? (
              <Paper
                sx={{
                  width: 260,
                  height: 260,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: '#f3f4f6',
                }}
              >
                <Box textAlign="center">
                  <CircularProgress size={32} />
                  <Typography variant="body2" color="text.secondary" mt={1}>
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

          {/* Spin button */}
          <Box mb={2}>
            <SpinButton
              variant="contained"
              color={locked ? 'inherit' : 'primary'}
              startIcon={buttonIcon}
              disabled={spinDisabled}
              onClick={handleSpin}
            >
              {buttonLabel}
            </SpinButton>
          </Box>

          {/* Info note */}
          <Typography variant="caption" color="text.secondary">
            For fairness and security, the result of the spin is calculated on the
            server. The animation is just a visual effect.
          </Typography>
        </Box>
      </Card>

      {/* Prize popup dialog */}
      <Dialog
        open={prizePopupOpen}
        onClose={() => setPrizePopupOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
          },
        }}
      >
        {/* Gradient header */}
        <DialogTitle
          sx={{
            textAlign: 'center',
            fontWeight: 800,
            py: 3,
            background:
              'radial-gradient(circle at 10% 0, #f97316, #ec4899, #7c3aed)',
            color: 'white',
            fontSize: '1.4rem',
          }}
        >
          🎉 Congratulations!
        </DialogTitle>

        <DialogContent
          sx={{
            textAlign: 'center',
            py: 3,
            position: 'relative',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 1 }}
            gutterBottom
          >
            You have unlocked
          </Typography>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              mb: 2,
              px: 1,
              background: 'linear-gradient(90deg, #f97316, #facc15)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {wonPrizeText || 'A Mystery Prize'}
          </Typography>

          <Typography variant="body2" color="text.secondary" mb={2}>
            Show this screen to the staff to claim your reward.  
            Terms & conditions may apply.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            justifyContent: 'center',
            pb: 2.5,
            pt: 0,
          }}
        >
          <Button
            variant="contained"
            onClick={() => setPrizePopupOpen(false)}
            sx={{
              borderRadius: 999,
              px: 4,
              fontWeight: 700,
            }}
          >
            Awesome!
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SpinPage;
