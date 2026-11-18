import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Stack,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';

const WrapperCard = styled(Card)(({ theme }) => ({
  borderRadius: 24,
  boxShadow: '0 20px 60px rgba(220, 38, 38, 0.15)',
  border: '2px solid #e5e7eb',
  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  overflow: 'hidden',
  position: 'relative',
  maxWidth: 600,
  margin: '0 auto',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #dc2626, #1e3a8a)',
  },
  [theme.breakpoints.down('sm')]: {
    borderRadius: 18,
    boxShadow: '0 10px 40px rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
  },
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.5rem',
  background: 'linear-gradient(135deg, #dc2626 0%, #1e3a8a 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.2rem',
  },
}));

// FAST 3D spin on Y axis
const fastSpinY = keyframes`
  0% { transform: perspective(1000px) rotateY(0deg); }
  100% { transform: perspective(1000px) rotateY(360deg); }
`;

// Shake (applied only to inner content, not rotation)
const shake = keyframes`
  0%, 100% { transform: translateX(0) rotate(0deg); }
  10% { transform: translateX(-8px) rotate(-3deg); }
  20% { transform: translateX(8px) rotate(3deg); }
  30% { transform: translateX(-6px) rotate(-2deg); }
  40% { transform: translateX(6px) rotate(2deg); }
  50% { transform: translateX(-4px) rotate(-1deg); }
  60% { transform: translateX(4px) rotate(1deg); }
  70% { transform: translateX(-2px) rotate(-1deg); }
  80% { transform: translateX(2px) rotate(1deg); }
  90% { transform: translateX(0) rotate(0deg); }
`;

// Glow pulse for circle behind box
const pulse = keyframes`
  0%, 100% { 
    transform: scale(1); 
    opacity: 0.4; 
    filter: blur(8px);
  }
  50% { 
    transform: scale(1.15); 
    opacity: 0.8; 
    filter: blur(12px);
  }
`;

// Confetti burst
const confettiBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotateZ(0deg) scale(0);
  }
  10% {
    opacity: 1;
    transform: translate3d(0, -10px, 0) rotateZ(20deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--tx), var(--ty), 0) rotateZ(var(--rz)) scale(0.5);
  }
`;

const SpinWheel = ({
  items = [],
  spinning = false,      // fast spin phase
  stopping = false,      // slow stop phase
  finalRotation = 0,     // landing angle in deg
  winnerBurst = false,   // confetti on win
  finalShake = false,    // shake after landing
}) => {
  const hasItems = items && items.length > 0;

  const getLabel = (item, index) =>
    item.title || item.label || item.name || `Prize ${index + 1}`;

  const prizeColors = ['#dc2626', '#1e3a8a', '#ef4444', '#355fbbff', '#991b1b'];

  const getGiftAnimation = () => {
    if (stopping) return 'none'; // only transition on transform
    if (spinning) return `${fastSpinY} 0.4s linear infinite`; // quick 3D spin
    return 'none';
  };

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 1.5, sm: 2.5, md: 3 },
        py: { xs: 1.5, sm: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      <WrapperCard>
        <CardContent
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            '&:last-child': {
              pb: { xs: 2, sm: 3, md: 4 },
            },
          }}
        >
          {/* Header */}
          <Stack
            direction="row"
            spacing={{ xs: 1.25, sm: 1.75 }}
            alignItems="center"
            justifyContent="center"
            mb={{ xs: 1.75, sm: 2.25, md: 2.75 }}
          >
            <Avatar
              sx={{
                bgcolor: '#dc2626',
                width: { xs: 40, sm: 48, md: 52 },
                height: { xs: 40, sm: 48, md: 52 },
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
              }}
            >
              <EmojiEventsIcon sx={{ fontSize: { xs: 22, sm: 26 } }} />
            </Avatar>
            <HeaderTitle variant="h5">
              Mystery Gift Spin
            </HeaderTitle>
          </Stack>

          <Box textAlign="center" mb={{ xs: 2, sm: 2.5, md: 3 }}>
            <Chip
              icon={<CardGiftcardIcon sx={{ color: '#dc2626 !important' }} />}
              label={
                hasItems
                  ? `${items.length} Hidden Prize${items.length > 1 ? 's' : ''}`
                  : 'No prizes configured'
              }
              size="medium"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '0.8rem', sm: '0.9rem', md: '0.95rem' },
                px: 1.5,
                py: 2.5,
                maxWidth: '100%',
                background: 'linear-gradient(135deg, #fee2e2 0%, #dbeafe 100%)',
                border: '1px solid #fecaca',
                color: '#1e3a8a',
              }}
            />
          </Box>

          <Divider
            sx={{
              mb: { xs: 2.25, sm: 3, md: 3.5 },
              borderColor: '#e5e7eb',
            }}
          />

          {/* Gift Box Section */}
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            mb={{ xs: hasItems ? 2.5 : 1.5, sm: hasItems ? 3 : 2 }}
            sx={{
              minHeight: { xs: 220, sm: 260, md: 300 },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: { xs: 220, sm: 260, md: 280 },
                height: { xs: 220, sm: 260, md: 280 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Animated glow background */}
              <Box
                sx={{
                  position: 'absolute',
                  width: { xs: '88%', sm: '82%' },
                  height: { xs: '88%', sm: '82%' },
                  borderRadius: '50%',
                  background: spinning || stopping
                    ? 'radial-gradient(circle, #fee2e2, #dc2626 40%, #1e3a8a 80%)'
                    : 'radial-gradient(circle, #dbeafe, #2563eb 50%, #dc2626)',
                  opacity: spinning || stopping ? 1 : 0.5,
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              />

              {/* Confetti particles */}
              {winnerBurst && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  {Array.from({ length: 32 }).map((_, i) => {
                    const angle = (i * 11.25) * (Math.PI / 180);
                    const distance = 90 + (i % 3) * 20;
                    const tx = Math.cos(angle) * distance;
                    const ty = Math.sin(angle) * distance;
                    const rz = 360 + (i * 24);
                    const color = prizeColors[i % prizeColors.length];
                    const delay = (i % 8) * 0.03;
                    const size = 7 + (i % 3);

                    return (
                      <Box
                        key={i}
                        sx={{
                          '--tx': `${tx}px`,
                          '--ty': `${ty}px`,
                          '--rz': `${rz}deg`,
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: size,
                          height: size * 1.4,
                          borderRadius: 1,
                          backgroundColor: color,
                          opacity: 0,
                          animation: `${confettiBurst} 1.2s ease-out`,
                          animationDelay: `${delay}s`,
                          boxShadow: `0 0 8px ${color}`,
                        }}
                      />
                    );
                  })}
                </Box>
              )}

              {/* Outer box: handles Y rotation + spin/stop */}
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 130, sm: 150, md: 160 },
                  height: { xs: 130, sm: 150, md: 160 },
                  zIndex: 5,
                  transformStyle: 'preserve-3d',
                  animation: getGiftAnimation(),
                  transition: stopping
                    ? 'transform 3.2s cubic-bezier(.1,.7,.1,1)'
                    : 'none',
                  transform: spinning
                    ? 'none'
                    : `perspective(1000px) rotateY(${finalRotation}deg)`,
                }}
              >
                {/* Box Shadow */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: { xs: -16, sm: -20 },
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '80%',
                    height: { xs: 10, sm: 14 },
                    borderRadius: '50%',
                    background: 'rgba(30, 58, 138, 0.4)',
                    filter: 'blur(8px)',
                  }}
                />

                {/* Inner container: shakes only content */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    animation: finalShake ? `${shake} 0.6s ease-in-out` : 'none',
                  }}
                >
                  {/* Gift Box Lid */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '100%',
                      height: '32%',
                      borderRadius: '16px 16px 10px 10px',
                      background:
                        'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      boxShadow: '0 6px 16px rgba(220, 38, 38, 0.4)',
                      zIndex: 3,
                    }}
                  >
                    {/* Lid ribbon vertical */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        top: '-8%',
                        transform: 'translateX(-50%)',
                        width: '28%',
                        height: '130%',
                        background:
                          'linear-gradient(180deg, #1e3a8a, #3b82f6)',
                        borderRadius: '20px',
                        boxShadow: '0 2px 8px rgba(30, 58, 138, 0.4)',
                      }}
                    />

                    {/* Bow on top */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        top: '-25%',
                        transform: 'translateX(-50%)',
                        width: '45%',
                        height: '35%',
                        borderRadius: '50%',
                        background:
                          'linear-gradient(135deg, #2563eb, #1e3a8a)',
                        boxShadow: '0 2px 8px rgba(30, 58, 138, 0.5)',
                      }}
                    />
                  </Box>

                  {/* Gift Box Body */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '30%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '100%',
                      height: '70%',
                      borderRadius: '12px',
                      background:
                        'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
                      boxShadow: '0 12px 24px rgba(220, 38, 38, 0.5)',
                      overflow: 'hidden',
                      zIndex: 2,
                    }}
                  >
                    {/* Vertical ribbon */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        transform: 'translateX(-50%)',
                        width: '28%',
                        height: '100%',
                        background:
                          'linear-gradient(180deg, #1e3a8a, #3b82f6)',
                        boxShadow:
                          'inset 0 0 10px rgba(0, 0, 0, 0.2)',
                      }}
                    />

                    {/* Horizontal ribbon */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        transform: 'translateY(-50%)',
                        width: '100%',
                        height: '26%',
                        background:
                          'linear-gradient(90deg, #1e3a8a, #3b82f6, #1e3a8a)',
                        boxShadow:
                          'inset 0 0 10px rgba(0, 0, 0, 0.2)',
                      }}
                    />

                    {/* Center icon */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: { xs: 32, sm: 38, md: 42 },
                        zIndex: 5,
                        textShadow:
                          '0 2px 8px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      {spinning || stopping
                        ? '✨'
                        : winnerBurst
                        ? '🏆'
                        : '🎁'}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Prize List */}
          {hasItems && (
            <>
              <Divider
                sx={{
                  mb: { xs: 1.75, sm: 2.25 },
                  borderColor: '#e5e7eb',
                }}
              />
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    color: '#1e3a8a',
                    mb: 1.25,
                    textAlign: 'center',
                    fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  }}
                >
                  Possible Prizes
                </Typography>
                <Stack
                  spacing={1}
                  sx={{
                    maxHeight: {
                      xs: 130,        // smaller on tiny screens
                      sm: 160,
                      md: 190,
                    },
                    overflowY: 'auto',
                    pr: 1,
                    '&::-webkit-scrollbar': {
                      width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: '#f1f5f9',
                      borderRadius: '10px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background:
                        'linear-gradient(135deg, #dc2626, #1e3a8a)',
                      borderRadius: '10px',
                    },
                  }}
                >
                  {items.map((item, index) => (
                    <Stack
                      key={item._id || index}
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      sx={{
                        p: { xs: 0.85, sm: 1.1 },
                        borderRadius: 2,
                        background:
                          'linear-gradient(135deg, #fef2f2 0%, #eff6ff 100%)',
                        border: '1px solid #e5e7eb',
                        transition: 'all 0.2s ease',
                        minHeight: { xs: 32, sm: 36 },
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow:
                            '0 2px 8px rgba(220, 38, 38, 0.1)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 9, sm: 11 },
                          height: { xs: 9, sm: 11 },
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${
                            prizeColors[index % prizeColors.length]
                          }, ${
                            prizeColors[(index + 1) % prizeColors.length]
                          })`,
                          flexShrink: 0,
                          boxShadow: `0 0 8px ${
                            prizeColors[index % prizeColors.length]
                          }40`,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: '#1e293b',
                          fontSize: { xs: '0.8rem', sm: '0.9rem' },
                        }}
                        noWrap
                      >
                        {getLabel(item, index)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </CardContent>
      </WrapperCard>
    </Box>
  );
};

export default SpinWheel;
