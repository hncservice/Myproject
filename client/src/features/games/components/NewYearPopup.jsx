import React, { useId } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { keyframes } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import gameArtwork from '../../../assets/bg/celebration.png';

const goldBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(0deg) scale(0.35);
  }

  18% {
    opacity: 1;
  }

  68% {
    opacity: 0.85;
  }

  100% {
    opacity: 0;
    transform: translate(var(--spark-x), var(--spark-y))
      rotate(var(--spark-spin)) scale(0.65);
  }
`;

const sparks = [
  { x: 12, y: -76, size: 6, delay: 0, color: '#fff3b8' },
  { x: 34, y: -62, size: 5, delay: 45, color: '#ffcc4d' },
  { x: 61, y: -49, size: 7, delay: 15, color: '#ffad2e' },
  { x: 75, y: -20, size: 4, delay: 90, color: '#fff3b8' },
  { x: 66, y: 16, size: 6, delay: 25, color: '#ffcc4d' },
  { x: 48, y: 44, size: 5, delay: 110, color: '#ffad2e' },
  { x: 25, y: 65, size: 4, delay: 65, color: '#ffe18a' },
  { x: 18, y: -42, size: 4, delay: 125, color: '#ffe18a' },
];

const focusStyles = {
  '&:focus-visible, &.Mui-focusVisible': {
    outline: '2px solid #ffe0ac',
    outlineOffset: '3px',
  },
};

function GoldBurst() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        '--spark-spread': '1',
        '@media (max-width: 599px)': {
          '--spark-spread': '0.65',
        },
        '@media (prefers-reduced-motion: reduce)': {
          display: 'none',
        },
      }}
    >
      {['left', 'right'].map((side) => {
        const direction = side === 'left' ? -1 : 1;

        return (
          <Box
            key={side}
            sx={{
              position: 'absolute',
              top: { xs: 0, sm: 8 },
              [side]: { xs: 18, sm: 4 },
            }}
          >
            {sparks.map((spark, index) => (
              <Box
                key={spark.delay}
                sx={{
                  position: 'absolute',
                  width: spark.size,
                  height: index % 2 === 0 ? spark.size : spark.size * 1.8,
                  borderRadius: index % 2 === 0 ? '50%' : '2px',
                  backgroundColor: spark.color,
                  boxShadow: `0 0 9px ${spark.color}`,
                  opacity: 0,
                  '--spark-x': `calc(${spark.x * direction}px * var(--spark-spread))`,
                  '--spark-y': `calc(${spark.y}px * var(--spark-spread))`,
                  '--spark-spin': `${direction * (110 + index * 15)}deg`,
                  animation: `${goldBurst} 900ms cubic-bezier(0.18, 0.7, 0.26, 1) both`,
                  animationDelay: `${80 + spark.delay}ms`,
                }}
              />
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

export default function NewYearPopup({
  open,
  onClose,
  name = 'Friend',
  downloadUrl = 'https://onelink.to/c8p8b8',
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      fullWidth
      maxWidth="xs"
      scroll="paper"
      PaperProps={{
        sx: {
          position: 'relative',
          overflow: 'visible',
          m: { xs: 1.5, sm: 3 },
          width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 48px)' },
          maxHeight: { xs: 'calc(100dvh - 24px)', sm: 'calc(100dvh - 48px)' },
          border: '1px solid #c56580',
          borderRadius: { xs: 4, sm: 5 },
          backgroundColor: '#230d1e',
          backgroundImage: [
            'radial-gradient(ellipse at 100% 5%, rgba(255, 171, 64, 0.42), transparent 34%)',
            'radial-gradient(ellipse at -8% 58%, rgba(236, 26, 78, 0.40), transparent 48%)',
            'radial-gradient(ellipse at 108% 74%, rgba(171, 51, 220, 0.37), transparent 47%)',
            'radial-gradient(ellipse at 18% 112%, rgba(230, 38, 133, 0.36), transparent 48%)',
            'linear-gradient(180deg, rgba(27, 8, 20, 0.03) 0%, rgba(27, 8, 20, 0.15) 24%, rgba(27, 8, 20, 0.94) 61%, #230d1e 100%)',
            `url("${gameArtwork}")`,
          ].join(', '),
          backgroundPosition: 'center top',
          backgroundSize: 'auto, auto, auto, auto, auto, 100% auto',
          backgroundRepeat: 'no-repeat',
          color: '#fff7f6',
          boxShadow: '0 24px 72px rgba(0, 0, 0, 0.55)',
        },
      }}
    >
      <DialogContent
        sx={{
          position: 'relative',
          minHeight: 0,
          overflowY: 'auto',
          borderRadius: 'inherit',
          p: { xs: 2, sm: 3 },
          '&:first-of-type': {
            pt: { xs: 'clamp(92px, 34vw, 148px)', sm: '164px' },
            '@media (max-height: 520px)': {
              pt: '72px',
            },
          },
        }}
      >
        <IconButton
          type="button"
          aria-label="Close popup"
          onClick={onClose}
          sx={{
            ...focusStyles,
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            width: 44,
            height: 44,
            border: '1px solid #d78ca1',
            backgroundColor: 'rgba(35, 13, 30, 0.87)',
            color: '#fff7f6',
            '&:hover': { backgroundColor: '#59233f' },
          }}
        >
          <CloseIcon />
        </IconButton>

        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
            border: '1px solid rgba(255, 170, 204, 0.32)',
            borderRadius: '16px',
            backgroundColor: 'rgba(27, 8, 20, 0.80)',
            textAlign: 'center',
          }}
        >
          <Typography
            component="h2"
            id={titleId}
            sx={{
              m: 0,
              color: '#ffe0ac',
              fontSize: { xs: '1.35rem', sm: '1.7rem' },
              fontWeight: 800,
              lineHeight: 1.15,
            }}
          >
            QATAR NATIONAL DAY CELEBRATION
          </Typography>

          <Typography
            id={descriptionId}
            sx={{
              mt: 1,
              color: '#f4dce7',
              fontSize: '0.9rem',
              lineHeight: 1.55,
              overflowWrap: 'anywhere',
            }}
          >
            Welcome back, <strong>{name}</strong>! Download the HNC app for
            faster ordering, exclusive offers, and Spin &amp; Win rewards.
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ mt: 2 }}
          >
            <Button
              component="a"
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<DownloadIcon />}
              variant="contained"
              disableElevation
              sx={{
                ...focusStyles,
                flex: '1 1 auto',
                minHeight: 46,
                borderRadius: '10px',
                background: 'linear-gradient(115deg, #a9193f, #8e216c)',
                color: '#fff',
                fontWeight: 750,
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(115deg, #941536, #781958)',
                },
              }}
            >
              Download HNC App
            </Button>

            <Button
              type="button"
              autoFocus
              onClick={onClose}
              variant="outlined"
              sx={{
                ...focusStyles,
                minHeight: 46,
                minWidth: 78,
                borderRadius: '10px',
                borderColor: '#c56580',
                color: '#fff7f6',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#e593a9',
                  backgroundColor: 'rgba(255, 150, 190, 0.12)',
                },
              }}
            >
              Skip
            </Button>
          </Stack>
        </Box>
      </DialogContent>

      {open && <GoldBurst />}
    </Dialog>
  );
}