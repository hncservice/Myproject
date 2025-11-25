// client/src/components/SpinWheel.jsx
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

const WrapperCard = styled(Card)(() => ({
  borderRadius: 20,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
  border: '1px solid #e5e7eb',
}));

const HeaderTitle = styled(Typography)(() => ({
  fontWeight: 700,
  background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}));

// Shake animation for the gift box
const shake = keyframes`
  0%   { transform: translateX(0) rotate(0deg); }
  10%  { transform: translateX(-4px) rotate(-4deg); }
  20%  { transform: translateX(4px) rotate(4deg); }
  30%  { transform: translateX(-3px) rotate(-3deg); }
  40%  { transform: translateX(3px) rotate(3deg); }
  50%  { transform: translateX(-2px) rotate(-2deg); }
  60%  { transform: translateX(2px) rotate(2deg); }
  70%  { transform: translateX(-1px) rotate(-1deg); }
  80%  { transform: translateX(1px) rotate(1deg); }
  90%  { transform: translateX(0px) rotate(0deg); }
  100% { transform: translateX(0) rotate(0deg); }
`;

// Glow / pulse behind box
const pulse = keyframes`
  0%   { transform: scale(1); opacity: 0.5; }
  50%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 0.5; }
`;

// Confetti falling animation
const confettiFall = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0, -20px, 0) rotateZ(0deg);
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate3d(0, 120px, 0) rotateZ(360deg);
  }
`;

/**
 * Pure presentational component.
 * props:
 *  - items: array of prize objects (used just for count & labels)
 *  - rotation: number (deg)  // kept for compatibility (not used)
 *  - spinning: boolean       // box shaking when true
 *  - winnerBurst: boolean    // confetti burst when true
 */
const SpinWheel = ({
  items = [],
  rotation = 0,
  spinning = false,
  winnerBurst = false,
}) => {
  const hasItems = items && items.length > 0;

  const getLabel = (item, index) =>
    item.title || item.label || item.name || `Prize ${index + 1}`;

  const confettiColors = ['#f97316', '#22c55e', '#3b82f6', '#ec4899', '#eab308'];

  return (
    <Box maxWidth={480} mx="auto">
      <WrapperCard>
        <CardContent>
          {/* Header */}
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            mb={1.5}
          >
            <Avatar sx={{ bgcolor: '#2563eb', width: 40, height: 40 }}>
              <EmojiEventsIcon fontSize="small" />
            </Avatar>
            <HeaderTitle variant="h6">Mystery Gift Spin</HeaderTitle>
          </Stack>

          <Box textAlign="center" mb={2}>
            <Chip
              icon={<CardGiftcardIcon />}
              label={
                hasItems
                  ? `${items.length} hidden prize${items.length > 1 ? 's' : ''}`
                  : 'No prizes configured'
              }
              size="small"
              sx={{ fontWeight: 500 }}
            />
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Gift box area */}
          <Box display="flex" justifyContent="center" alignItems="center" mb={3}>
            <Box
              sx={{
                position: 'relative',
                width: 220,
                height: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
              }}
            >
              {/* Glow / pulse behind the box */}
              <Box
                sx={{
                  position: 'absolute',
                  width: 180,
                  height: 180,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 30% 20%, #fef9c3, #f97316 60%, #7c2d12)',
                  opacity: spinning ? 0.9 : 0.6,
                  animation: `${pulse} 1.4s ease-in-out infinite`,
                  filter: 'blur(2px)',
                }}
              />

              {/* Confetti burst when winnerBurst is true */}
              {winnerBurst && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                >
                  {Array.from({ length: 28 }).map((_, i) => {
                    const color = confettiColors[i % confettiColors.length];
                    const left = 40 + (i * 7) % 40; // between ~40–80%
                    const delay = (i % 7) * 0.05; // staggered
                    const size = 6 + (i % 4); // 6–9px
                    return (
                      <Box
                        key={i}
                        sx={{
                          position: 'absolute',
                          top: '25%',
                          left: `${left}%`,
                          width: size,
                          height: size * 1.4,
                          borderRadius: 0.5,
                          backgroundColor: color,
                          opacity: 0,
                          animation: `${confettiFall} 0.9s ease-out`,
                          animationDelay: `${delay}s`,
                        }}
                      />
                    );
                  })}
                </Box>
              )}

              {/* Gift box itself */}
              <Box
                sx={{
                  position: 'relative',
                  width: 120,
                  height: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  zIndex: 2,
                  animation: spinning ? `${shake} 0.7s ease-in-out infinite` : 'none',
                  transformOrigin: '50% 100%',
                }}
              >
                {/* Lid */}
                <Box
                  sx={{
                    width: '90%',
                    height: '26%',
                    borderRadius: '14px 14px 8px 8px',
                    background: 'linear-gradient(90deg, #f97316, #fb923c)',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.25)',
                    position: 'relative',
                    mb: '-4px',
                  }}
                >
                  {/* Vertical ribbon on lid */}
                  <Box
                    sx={{
                      width: '24%',
                      height: '120%',
                      background: 'linear-gradient(180deg, #facc15, #eab308)',
                      position: 'absolute',
                      left: '50%',
                      top: '-10%',
                      transform: 'translateX(-50%)',
                      borderRadius: '999px',
                    }}
                  />
                </Box>

                {/* Box body */}
                <Box
                  sx={{
                    width: '90%',
                    height: '56%',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.35)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Vertical ribbon */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      transform: 'translateX(-50%)',
                      width: '24%',
                      height: '100%',
                      background: 'linear-gradient(180deg, #facc15, #eab308)',
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
                      height: '22%',
                      background: 'linear-gradient(90deg, #facc15, #eab308)',
                    }}
                  />

                  {/* Icon / emoji in center */}
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 32,
                    }}
                  >
                    {spinning ? '✨' : winnerBurst ? '🏆' : '🎁'}
                  </Box>
                </Box>

                {/* Bottom shadow */}
                <Box
                  sx={{
                    width: '70%',
                    height: 10,
                    borderRadius: '50%',
                    background: 'rgba(15,23,42,0.6)',
                    filter: 'blur(4px)',
                    mt: 1,
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Optional: show prize list (data still visible) */}
          {hasItems && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  mb={1}
                  textAlign="center"
                >
                  Possible prizes inside this box
                </Typography>
                <Stack
                  spacing={0.75}
                  sx={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    pr: 0.5,
                  }}
                >
                  {items.map((item, index) => (
                    <Stack
                      key={item._id || index}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor:
                            confettiColors[index % confettiColors.length],
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500 }}
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
