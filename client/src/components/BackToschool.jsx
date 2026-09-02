// client/src/components/NewYearPopup.jsx
import React, { useMemo } from 'react';
import { Box, Button, Dialog, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { keyframes, styled } from '@mui/material/styles';

const SCHOOL_BLUE = '#2563eb';
const SCHOOL_BLUE_DARK = '#1d4ed8';
const SCHOOL_YELLOW = '#facc15';
const SCHOOL_PINK = '#ec4899';
const SCHOOL_GREEN = '#22c55e';
const SCHOOL_PURPLE = '#8b5cf6';
const SCHOOL_BG = '#f8fbff';

const popIn = keyframes`
  0% { transform: translateY(22px) scale(.94); opacity: 0; filter: blur(8px); }
  60% { transform: translateY(-6px) scale(1.02); opacity: 1; filter: blur(0); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
`;

const glowPulse = keyframes`
  0%,100% { opacity: .35; transform: scale(1); }
  50% { opacity: .60; transform: scale(1.06); }
`;

const floaty = keyframes`
  0% { transform: translateY(0); opacity: .9; }
  100% { transform: translateY(-32px); opacity: 0; }
`;

const twinkle = keyframes`
  0%,100% { transform: scale(1); opacity: .7; }
  50% { transform: scale(1.22); opacity: 1; }
`;

const shine = keyframes`
  0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
  10% { opacity: .55; }
  40% { transform: translateX(120%) skewX(-20deg); opacity: 0; }
  100% { transform: translateX(120%) skewX(-20deg); opacity: 0; }
`;

const ringPulse = keyframes`
  0% { transform: translate(-50%, -50%) scale(.2); opacity: 0; }
  20% { opacity: .8; }
  100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; }
`;

const confettiFall = keyframes`
  0% { transform: translateY(-18px) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(280px) rotate(260deg); opacity: 0; }
`;

const Card = styled(Box)(({ theme }) => ({
  position: 'relative',
  borderRadius: 26,
  overflow: 'hidden',
  border: '1px solid rgba(37,99,235,.15)',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
  boxShadow: '0 26px 90px rgba(37,99,235,.18)',
  animation: `${popIn} 520ms ease-out`,
  padding: 18,
  transform: 'translateZ(0)',
  [theme.breakpoints.up('sm')]: { padding: 22 },
}));

const PrimaryBtn = styled(Button)(() => ({
  height: 48,
  borderRadius: 16,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: '#fff',
  background: `linear-gradient(135deg, ${SCHOOL_BLUE} 0%, ${SCHOOL_PURPLE} 100%)`,
  boxShadow: '0 14px 34px rgba(37,99,235,.28)',
  '&:hover': {
    background: `linear-gradient(135deg, ${SCHOOL_BLUE_DARK} 0%, ${SCHOOL_PURPLE} 100%)`,
    transform: 'translateY(-1px)',
    boxShadow: '0 18px 40px rgba(37,99,235,.34)',
  },
}));

const GhostBtn = styled(Button)(() => ({
  height: 48,
  borderRadius: 16,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: SCHOOL_BLUE_DARK,
  border: '1px solid rgba(37,99,235,.16)',
  background: 'rgba(37,99,235,.06)',
  '&:hover': { background: 'rgba(37,99,235,.1)' },
}));

function randomBetween(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

export default function NewYearPopup({
  open,
  onClose,
  name = 'Friend',
  downloadUrl = 'https://onelink.to/c8p8b8',
}) {
  const particles = useMemo(() => {
    const sparkleColors = [
      'rgba(37,99,235,.45)',
      'rgba(250,204,21,.55)',
      'rgba(236,72,153,.45)',
      'rgba(34,197,94,.45)',
      'rgba(139,92,246,.40)',
    ];

    const sparkles = Array.from({ length: 18 }).map((_, i) => ({
      id: `s-${i}`,
      left: `${randomBetween(6, 94)}%`,
      top: `${randomBetween(28, 92)}%`,
      size: randomBetween(4, 10),
      dur: `${randomBetween(2200, 3600)}ms`,
      delay: `${randomBetween(0, 900)}ms`,
      color: sparkleColors[i % sparkleColors.length],
    }));

    const confettiColors = [
      'rgba(37,99,235,.88)',
      'rgba(250,204,21,.9)',
      'rgba(236,72,153,.85)',
      'rgba(34,197,94,.85)',
      'rgba(139,92,246,.85)',
    ];

    const confetti = Array.from({ length: 16 }).map((_, i) => ({
      id: `c-${i}`,
      left: `${randomBetween(5, 95)}%`,
      w: randomBetween(6, 10),
      h: randomBetween(10, 18),
      delay: `${randomBetween(0, 600)}ms`,
      dur: `${randomBetween(2200, 3200)}ms`,
      r: randomBetween(-25, 25),
      bg: confettiColors[i % confettiColors.length],
    }));

    return { sparkles, confetti };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          m: { xs: 1.2, sm: 2 },
          borderRadius: 6,
          background: 'transparent',
          boxShadow: 'none',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Card>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(700px 300px at 10% 0%, rgba(37,99,235,.16) 0%, rgba(255,255,255,0) 60%),
                radial-gradient(700px 320px at 90% 20%, rgba(250,204,21,.18) 0%, rgba(255,255,255,0) 60%),
                radial-gradient(500px 280px at 50% 100%, rgba(236,72,153,.14) 0%, rgba(255,255,255,0) 60%)
              `,
              pointerEvents: 'none',
              animation: `${glowPulse} 2.8s ease-in-out infinite`,
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '55%',
              background:
                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.45) 50%, rgba(255,255,255,0) 100%)',
              transform: 'translateX(-120%) skewX(-20deg)',
              animation: `${shine} 5.2s ease-in-out infinite`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
            {[
              { left: '20%', top: '28%', c: 'rgba(37,99,235,.32)', d: '0ms' },
              { left: '80%', top: '24%', c: 'rgba(250,204,21,.38)', d: '240ms' },
              { left: '70%', top: '60%', c: 'rgba(236,72,153,.28)', d: '520ms' },
            ].map((r, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  left: r.left,
                  top: r.top,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  border: `2px solid ${r.c}`,
                  boxShadow: `0 0 24px ${r.c}`,
                  transform: 'translate(-50%, -50%) scale(.2)',
                  opacity: 0,
                  animation: `${ringPulse} 1600ms ease-out ${r.d} infinite`,
                }}
              />
            ))}
          </Box>

          <IconButton
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 10,
              top: 10,
              color: 'rgba(30,41,59,.75)',
              zIndex: 5,
              background: 'rgba(37,99,235,.06)',
              border: '1px solid rgba(37,99,235,.12)',
              '&:hover': { background: 'rgba(37,99,235,.12)' },
            }}
          >
            <CloseIcon />
          </IconButton>

          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
            {particles.confetti.map((c) => (
              <Box
                key={c.id}
                sx={{
                  position: 'absolute',
                  left: c.left,
                  top: 10,
                  width: c.w,
                  height: c.h,
                  borderRadius: 2,
                  background: c.bg,
                  opacity: 0,
                  transform: `rotate(${c.r}deg)`,
                  animation: `${confettiFall} ${c.dur} ease-in ${c.delay} infinite`,
                }}
              />
            ))}
          </Box>

          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
            {particles.sparkles.map((p) => (
              <Box
                key={p.id}
                sx={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  background: p.color,
                  animation: `${floaty} ${p.dur} ease-in-out ${p.delay} infinite`,
                  filter: 'blur(.2px)',
                }}
              />
            ))}
          </Box>

          <Stack spacing={1.4} sx={{ position: 'relative', zIndex: 4 }}>
            <Box sx={{ textAlign: 'center', pt: 2 }}>
              <Typography
                sx={{
                  fontWeight: 1000,
                  fontSize: { xs: '1.35rem', sm: '1.55rem' },
                  letterSpacing: 0.3,
                  background: `linear-gradient(135deg, ${SCHOOL_BLUE} 0%, ${SCHOOL_PINK} 45%, ${SCHOOL_PURPLE} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                🎒 Back to School Celebration ✨
              </Typography>

              <Typography sx={{ color: '#334155', mt: 0.8, fontSize: '0.9rem' }}>
                Welcome back, <strong style={{ color: SCHOOL_BLUE }}>{name}</strong>!
                <br />
                Enjoy a fun school-time celebration with exciting rewards 🎁
              </Typography>

              <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 1.2 }}>
                {['🎒', '📚', '✏️', '🖍️', '🍎'].map((t, i) => (
                  <Box key={i} sx={{ fontSize: 18, animation: `${twinkle} ${1200 + i * 250}ms ease-in-out infinite` }}>
                    {t}
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                borderRadius: 18,
                p: 1.4,
                background: 'rgba(37,99,235,.05)',
                border: '1px solid rgba(37,99,235,.12)',
              }}
            >
              <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: '0.95rem' }}>
                Get the HNC App 🚀
              </Typography>
              <Typography sx={{ color: '#475569', fontSize: '0.82rem', mt: 0.4 }}>
                Faster ordering • Exclusive offers • Spin & Win rewards
              </Typography>
            </Box>

            <Stack spacing={1.1} sx={{ pt: 0.4 }}>
              <PrimaryBtn
                fullWidth
                startIcon={<DownloadIcon />}
                onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
              >
                Download HNC App
              </PrimaryBtn>

              <GhostBtn fullWidth onClick={onClose}>
                Skip
              </GhostBtn>
            </Stack>

            <Typography sx={{ textAlign: 'center', color: '#64748b', fontSize: '0.72rem', pt: 0.4 }}>
              Have fun and enjoy the celebration 🎉
            </Typography>
          </Stack>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

// client/src/components/NewYearPopup.jsx
import React, { useMemo } from 'react';
import { Box, Button, Dialog, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { keyframes, styled } from '@mui/material/styles';

const HNC_RED = '#dc2626';
const HNC_RED_DARK = '#7c2d12';

const popIn = keyframes`
  0% { transform: translateY(22px) scale(.94); opacity: 0; filter: blur(8px); }
  60% { transform: translateY(-6px) scale(1.02); opacity: 1; filter: blur(0); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
`;

const glowPulse = keyframes`
  0%,100% { opacity: .35; transform: scale(1); }
  50% { opacity: .60; transform: scale(1.06); }
`;

const floaty = keyframes`
  0% { transform: translateY(0); opacity: .9; }
  100% { transform: translateY(-32px); opacity: 0; }
`;

const twinkle = keyframes`
  0%,100% { transform: scale(1); opacity: .7; }
  50% { transform: scale(1.22); opacity: 1; }
`;

const shine = keyframes`
  0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
  10% { opacity: .55; }
  40% { transform: translateX(120%) skewX(-20deg); opacity: 0; }
  100% { transform: translateX(120%) skewX(-20deg); opacity: 0; }
`;

const fireRing = keyframes`
  0% { transform: translate(-50%, -50%) scale(.2); opacity: 0; }
  20% { opacity: .9; }
  100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; }
`;

const confettiFall = keyframes`
  0% { transform: translateY(-18px) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(280px) rotate(260deg); opacity: 0; }
`;

const Card = styled(Box)(({ theme }) => ({
  position: 'relative',
  borderRadius: 26,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,.12)',
  background: 'linear-gradient(180deg, rgba(15,23,42,.96) 0%, rgba(2,6,23,.98) 100%)',
  boxShadow: '0 26px 90px rgba(0,0,0,.7)',
  animation: `${popIn} 520ms ease-out`,
  padding: 18,
  transform: 'translateZ(0)',
  [theme.breakpoints.up('sm')]: { padding: 22 },
}));

const PrimaryBtn = styled(Button)(() => ({
  height: 48,
  borderRadius: 16,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: '#fff',
  background: `linear-gradient(135deg, ${HNC_RED} 0%, ${HNC_RED_DARK} 100%)`,
  boxShadow: '0 14px 34px rgba(220,38,38,.45)',
  '&:hover': {
    background: `linear-gradient(135deg, ${HNC_RED} 0%, ${HNC_RED_DARK} 100%)`,
    transform: 'translateY(-1px)',
    boxShadow: '0 18px 40px rgba(220,38,38,.6)',
  },
}));

const GhostBtn = styled(Button)(() => ({
  height: 48,
  borderRadius: 16,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'rgba(255,255,255,.92)',
  border: '1px solid rgba(255,255,255,.14)',
  background: 'rgba(255,255,255,.06)',
  '&:hover': { background: 'rgba(255,255,255,.09)' },
}));

function randomBetween(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

export default function NewYearPopup({ open, onClose, name = 'Friend', downloadUrl = 'https://onelink.to/c8p8b8' }) {
  const particles = useMemo(() => {
    const sparkles = Array.from({ length: 16 }).map((_, i) => ({
      id: `s-${i}`,
      left: `${randomBetween(6, 94)}%`,
      top: `${randomBetween(30, 92)}%`,
      size: randomBetween(4, 10),
      dur: `${randomBetween(2200, 3600)}ms`,
      delay: `${randomBetween(0, 900)}ms`,
      color:
        i % 3 === 0
          ? `rgba(220,38,38,.55)`
          : i % 3 === 1
          ? `rgba(248,250,252,.35)`
          : `rgba(124,45,18,.35)`,
    }));

    const confetti = Array.from({ length: 14 }).map((_, i) => ({
      id: `c-${i}`,
      left: `${randomBetween(5, 95)}%`,
      w: randomBetween(6, 10),
      h: randomBetween(10, 18),
      delay: `${randomBetween(0, 600)}ms`,
      dur: `${randomBetween(2200, 3200)}ms`,
      r: randomBetween(-25, 25),
      bg:
        i % 4 === 0
          ? 'rgba(220,38,38,.85)'
          : i % 4 === 1
          ? 'rgba(248,250,252,.55)'
          : i % 4 === 2
          ? 'rgba(124,45,18,.75)'
          : 'rgba(56,189,248,.55)',
    }));

    return { sparkles, confetti };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          m: { xs: 1.2, sm: 2 },
          borderRadius: 6,
          background: 'transparent',
          boxShadow: 'none',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Card>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(700px 300px at 10% 0%, rgba(220,38,38,.22) 0%, rgba(2,6,23,0) 60%), radial-gradient(700px 320px at 90% 20%, rgba(124,45,18,.18) 0%, rgba(2,6,23,0) 60%)',
              pointerEvents: 'none',
              animation: `${glowPulse} 2.8s ease-in-out infinite`,
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '55%',
              background:
                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.16) 50%, rgba(255,255,255,0) 100%)',
              transform: 'translateX(-120%) skewX(-20deg)',
              animation: `${shine} 5.2s ease-in-out infinite`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
            {[
              { left: '22%', top: '30%', c: 'rgba(220,38,38,.6)', d: '0ms' },
              { left: '78%', top: '26%', c: 'rgba(248,250,252,.35)', d: '240ms' },
              { left: '70%', top: '58%', c: 'rgba(124,45,18,.45)', d: '520ms' },
            ].map((r, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  left: r.left,
                  top: r.top,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  border: `2px solid ${r.c}`,
                  boxShadow: `0 0 24px ${r.c}`,
                  transform: 'translate(-50%, -50%) scale(.2)',
                  opacity: 0,
                  animation: `${fireRing} 1600ms ease-out ${r.d} infinite`,
                }}
              />
            ))}
          </Box>

          <IconButton
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 10,
              top: 10,
              color: 'rgba(255,255,255,.75)',
              zIndex: 5,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              '&:hover': { background: 'rgba(255,255,255,.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>

          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
            {particles.confetti.map((c) => (
              <Box
                key={c.id}
                sx={{
                  position: 'absolute',
                  left: c.left,
                  top: 10,
                  width: c.w,
                  height: c.h,
                  borderRadius: 2,
                  background: c.bg,
                  opacity: 0,
                  transform: `rotate(${c.r}deg)`,
                  animation: `${confettiFall} ${c.dur} ease-in ${c.delay} infinite`,
                }}
              />
            ))}
          </Box>

          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
            {particles.sparkles.map((p) => (
              <Box
                key={p.id}
                sx={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  background: p.color,
                  animation: `${floaty} ${p.dur} ease-in-out ${p.delay} infinite`,
                  filter: 'blur(.2px)',
                }}
              />
            ))}
          </Box>

          <Stack spacing={1.4} sx={{ position: 'relative', zIndex: 4 }}>
            <Box sx={{ textAlign: 'center', pt: 2 }}>
              <Typography
                sx={{
                  fontWeight: 1000,
                  fontSize: { xs: '1.35rem', sm: '1.55rem' },
                  letterSpacing: 0.3,
                  background: 'linear-gradient(135deg, #ffffff 0%, #dc2626 35%, #991b1b 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ✨ Back to School ✨
              </Typography>

              <Typography sx={{ color: 'rgba(226,232,240,.88)', mt: 0.8, fontSize: '0.9rem' }}>
                Welcome back, <strong style={{ color: HNC_RED }}>{name}</strong>!
                <br />
                Let’s make this Celebration delicious & lucky 🎁
              </Typography>

              <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 1.2 }}>
                {['🎉', '🥳', '🔥', '🍔', '🎁'].map((t, i) => (
                  <Box key={i} sx={{ fontSize: 18, animation: `${twinkle} ${1200 + i * 250}ms ease-in-out infinite` }}>
                    {t}
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                borderRadius: 18,
                p: 1.4,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.10)',
              }}
            >
              <Typography sx={{ color: 'rgba(255,255,255,.92)', fontWeight: 900, fontSize: '0.95rem' }}>
                Get the HNC App 🚀
              </Typography>
              <Typography sx={{ color: 'rgba(148,163,184,.95)', fontSize: '0.82rem', mt: 0.4 }}>
                Faster ordering • Exclusive offers • Spin & Win rewards
              </Typography>
            </Box>

            <Stack spacing={1.1} sx={{ pt: 0.4 }}>
              <PrimaryBtn fullWidth startIcon={<DownloadIcon />} onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}>
                Download HNC App
              </PrimaryBtn>

              <GhostBtn fullWidth onClick={onClose}>
                Skip
              </GhostBtn>
            </Stack>

            <Typography sx={{ textAlign: 'center', color: 'rgba(148,163,184,.8)', fontSize: '0.72rem', pt: 0.4 }}>
              Enjoy the celebration 🎆
            </Typography>
          </Stack>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
