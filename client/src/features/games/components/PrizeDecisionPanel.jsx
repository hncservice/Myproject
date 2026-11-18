import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  createPrizeDecision,
  getPrizeDecisionStatus,
  drawPrizeDecision,
} from '../api/spinApi';

import PrizeAwardDetails from './PrizeAwardDetails';

const STATES = new Set([
  'pending_review',
  'ready_for_draw',
  'approved',
  'rejected',
  'no_prize',
  'prize_awarded',
]);

export default function PrizeDecisionPanel({
  gameSessionId,
  allowDecisionRecovery = true,
}) {
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
// const [completedPrizeSession, setCompletedPrizeSession] = useState(null);
  const generation = useRef(0);
  const busyRef = useRef(false);

  const request = useCallback(async (draw = false) => {
    if (busyRef.current) return;

    const current = generation.current;

    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      let response;

      if (draw) {
        response = await drawPrizeDecision(gameSessionId);
      } else {
        try {
          response = await getPrizeDecisionStatus(gameSessionId);
        } catch (failure) {
          if (!allowDecisionRecovery || failure?.response?.status !== 404) {
            throw failure;
          }

          if (current !== generation.current) return;

          // Recover the preliminary decision when recovery is enabled.
          await createPrizeDecision(gameSessionId);

          if (current !== generation.current) return;

          response = await getPrizeDecisionStatus(gameSessionId);
        }
      }

      if (current !== generation.current) return;

      const data = response?.data;

      if (
        !data ||
        !STATES.has(data.status) ||
        typeof data.gameSessionId !== 'string' ||
        data.gameSessionId.toLowerCase() !== gameSessionId.toLowerCase()
      ) {
        throw new Error('Unexpected prize response');
      }

      setDecision(data);
    } catch (failure) {
      if (current !== generation.current) return;

      const code = failure?.response?.data?.code;

      if (code === 'PRIZE_ALLOCATION_DISABLED') {
        setError(
          'Prize draws are not available yet. Please check again later.'
        );
      } else if (failure?.response?.status === 401) {
        setError(
          'Please sign in again to check your prize result.'
        );
      } else {
        setError(
          draw
            ? 'We could not confirm the draw result. Refresh the status before trying again.'
            : 'We could not load your prize status. Please try again.'
        );
      }
    } finally {
      if (current === generation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [gameSessionId, allowDecisionRecovery]);

  useEffect(() => {
    generation.current += 1;
    busyRef.current = false;

    setDecision(null);
    setError('');

    if (!/^[a-f0-9]{24}$/i.test(gameSessionId || '')) {
      setError('Prize status is unavailable for this session.');
      setBusy(false);
      return undefined;
    }

    void request();

    return () => {
      generation.current += 1;
    };
  }, [gameSessionId, request]);

  // Only display a decision belonging to the current session.
  const currentDecision =
    typeof gameSessionId === 'string' &&
    decision?.gameSessionId.toLowerCase() === gameSessionId.toLowerCase()
      ? decision
      : null;

  const canDraw =
    currentDecision?.status === 'ready_for_draw' ||
    currentDecision?.status === 'approved';

  const messages = {
    pending_review: 'Your result is awaiting review.',
    ready_for_draw: 'You qualified for the prize draw.',
    approved: 'Your result has been approved for the prize draw.',
    rejected: 'Your result was not approved for the prize draw.',
    no_prize: 'The draw is complete. No prize this time.',
    prize_awarded: 'You won a prize!',
  };

  return (
    <section
      aria-label="Prize result"
      aria-busy={busy}
      style={{
        margin: '16px 0',
        padding: 16,
        border: '1px solid #354565',
        borderRadius: 14,
        background: '#121d34',
        color: '#eef4ff',
      }}
    >
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>
        Your prize result
      </h2>

      <p role="status" style={{ lineHeight: 1.5 }}>
        {currentDecision
          ? messages[currentDecision.status]
          : busy
            ? 'Checking your prize status...'
            : 'Prize status is unavailable.'}
      </p>

      {error && <p role="alert">{error}</p>}

      {currentDecision?.status === 'prize_awarded' && (
        <PrizeAwardDetails
          key={gameSessionId}
          gameSessionId={gameSessionId}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 12,
        }}
      >
        <button
          type="button"
          className="ps-primary"
          style={{ minWidth: 0 }}
          disabled={busy}
          onClick={() => void request()}
        >
          {busy ? 'PLEASE WAIT...' : 'REFRESH STATUS'}
        </button>

        {canDraw && (
          <button
            type="button"
            className="ps-primary"
            style={{ minWidth: 0 }}
            disabled={busy}
            onClick={() => void request(true)}
          >
            DRAW MY PRIZE
          </button>
        )}
      </div>
    </section>
  );
}