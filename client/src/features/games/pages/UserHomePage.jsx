import React, { useEffect, useRef, useState } from 'react';
import logo from '../../../assets/logos.png';
import { getMyLatestWin } from '../api/spinApi';
import { useAuth } from '../../authentication/context/AuthContext';
import GameSelectionPanel from '../components/GameSelectionPanel';
import '../styles/UserHomePage.css';
import homeMusic from '../../../assets/sounds/play5.mp3';
import axiosInstance from '../../../shared/api/axiosInstance';
import PrizeDecisionPanel from '../components/PrizeDecisionPanel';

function PrizeDetails({ win }) {
  const expiry = win.qrExpiry ? new Date(win.qrExpiry) : null;
  const hasExpiry = expiry !== null && Number.isFinite(expiry.getTime());
  const redemptionStatus = String(win.redemptionStatus ?? 'pending')
    .trim()
    .toLowerCase();

  const isRedeemed = redemptionStatus === 'redeemed';
  const isExpired =
    !isRedeemed &&
    (redemptionStatus === 'expired' ||
      (redemptionStatus === 'pending' &&
        hasExpiry &&
        expiry.getTime() <= Date.now()));

  const canRedeem = redemptionStatus === 'pending' && !isExpired;
  const hasRedemptionCode = Boolean(win.qrDataUrl || win.qrToken);

  let statusLabel = 'Unavailable';
  let statusStyle = 'closed';

  if (isRedeemed) {
    statusLabel = 'Redeemed';
  } else if (isExpired) {
    statusLabel = 'Expired';
  } else if (canRedeem && hasRedemptionCode) {
    statusLabel = 'Ready to redeem';
    statusStyle = 'ready';
  }

  const expiryText = hasExpiry
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Qatar',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(expiry)
    : '';

  return (
    <div className="hnc-home-prize">
      <div className="hnc-home-prize-heading">
        <h3>{win.prize?.title || 'Prize'}</h3>
        <span className={`hnc-home-prize-status hnc-home-prize-status--${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      {win.prize?.description && (
        <p className="hnc-home-muted">{win.prize.description}</p>
      )}

      {hasExpiry && !isRedeemed && (
        <dl className="hnc-home-prize-meta">
          <div>
            <dt>{isExpired ? 'Expired on' : 'Redeem by'}</dt>
            <dd>
              <time dateTime={expiry.toISOString()}>{expiryText}</time>
              {' (Qatar time)'}
            </dd>
          </div>
        </dl>
      )}

      {isRedeemed && (
        <p className="hnc-home-prize-note">
          This prize has already been collected.
        </p>
      )}

      {isExpired && (
        <p className="hnc-home-prize-note">
          The redemption period for this prize has ended.
        </p>
      )}

      {canRedeem && (
        <div className="hnc-home-redemption">
          {win.qrDataUrl && (
            <figure className="hnc-home-prize-scan">
              <div className="hnc-home-qr">
                <img src={win.qrDataUrl} alt="Prize redemption QR code" />
              </div>
              <figcaption>Show this QR code to HNC staff.</figcaption>
            </figure>
          )}

          {win.qrToken && win.qrDataUrl && (
            <details className="hnc-home-code">
              <summary>Show backup code</summary>
              <code dir="ltr">{win.qrToken}</code>
            </details>
          )}

          {win.qrToken && !win.qrDataUrl && (
            <div className="hnc-home-code">
              <p>Show this redemption code to HNC staff.</p>
              <code dir="ltr">{win.qrToken}</code>
            </div>
          )}

          {!hasRedemptionCode && (
            <p className="hnc-home-prize-note">
              Your redemption code is unavailable. Refresh the page to try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
const HOME_GAMES = [
  { id: 'monkey', label: 'Whak the Monkey' },
  { id: 'perfect-shot', label: 'Perfect Shot' },
  { id: 'burger-run', label: 'HNC Burger Run' },
];

function HomePrizeDraws() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadQualifiedGames() {
      setLoading(true);
      setError('');
      setSessions([]);

      const results = await Promise.allSettled(
        HOME_GAMES.map(async (game) => {
          const { data } = await axiosInstance.get(
            `/games/${game.id}/history`
          );

          if (!Array.isArray(data?.items)) {
            throw new Error('Invalid game history');
          }

          return data.items
            .filter(
              (session) =>
                session.gameId === game.id &&
                session.status === 'completed' &&
                session.outcome === 'qualified' &&
                typeof session.sessionId === 'string' &&
                /^[a-f0-9]{24}$/i.test(session.sessionId)
            )
            .map((session) => ({
              sessionId: session.sessionId.toLowerCase(),
              gameLabel: game.label,
              completedAt: session.completedAt,
            }));
        })
      );

      if (!active) return;

      const qualified = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      );

      const unique = [
        ...new Map(
          qualified.map((session) => [
            session.sessionId,
            session,
          ])
        ).values(),
      ];

      unique.sort(
        (a, b) =>
          (Date.parse(b.completedAt) || 0) -
          (Date.parse(a.completedAt) || 0)
      );

      setSessions(unique);

      if (results.some((result) => result.status === 'rejected')) {
        setError(
          'Some game results could not be loaded. Please refresh.'
        );
      }

      setLoading(false);
    }

    void loadQualifiedGames();

    return () => {
      active = false;
    };
  }, [refresh]);

  return (
    <div className="hnc-home-draws" aria-busy={loading}>
      {loading && (
        <p className="hnc-home-muted" role="status">
          Checking your completed games…
        </p>
      )}

      {error && (
        <p className="hnc-home-alert" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="hnc-home-empty">
          <h3>No qualified game yet</h3>
          <p className="hnc-home-muted">
            Complete a game successfully to qualify for a prize draw.
          </p>
        </div>
      )}

      {!loading &&
        sessions.map((session) => (
          <section
            key={`${session.sessionId}:${refresh}`}
            style={{ marginTop: 18 }}
            aria-label={`${session.gameLabel} prize result`}
          >
            <h3
              style={{
                margin: '0 0 6px',
                color: 'var(--home-text)',
                fontSize: 18,
              }}
            >
              🎉 {session.gameLabel}
            </h3>

            <p className="hnc-home-muted">
              You completed this game successfully.
              Check your result below.
            </p>

            <PrizeDecisionPanel
              gameSessionId={session.sessionId}
              allowDecisionRecovery
            />
          </section>
        ))}

      <button
        type="button"
        className="hnc-home-music"
        disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        {loading ? 'Checking results…' : 'Refresh game results'}
      </button>
    </div>
  );
}
export default function UserHomePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [win, setWin] = useState(null);
  const [error, setError] = useState('');
  const homeMusicRef = useRef(null);
const [musicPlaying, setMusicPlaying] = useState(false);

useEffect(() => {
  const music = homeMusicRef.current;
  if (!music) return;

  music.volume = 0.5;
  void music.play().catch(() => {
    // The player can start playback with the Play music button.
  });

  return () => music.pause();
}, []);

function toggleHomeMusic() {
  const music = homeMusicRef.current;
  if (!music) return;

  if (music.paused) {
    void music.play().catch((error) => {
  console.error('Home music failed:', error.name, error.message, music.currentSrc);
});
  } else {
    music.pause();
  }
}

  useEffect(() => {
    let active = true;

    async function loadLatestWin() {
      try {
        const { data } = await getMyLatestWin();

        if (active) {
          setWin(data?.hasWin ? data.win : null);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              'Failed to load win'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadLatestWin();

    return () => {
      active = false;
    };
  }, []);

  const displayName = profile?.name || profile?.email || 'User';

  return (
    <main className="hnc-home">
      <audio
  ref={homeMusicRef}
  src={homeMusic}
  loop
  preload="metadata"
  onPlaying={() => setMusicPlaying(true)}
  onPause={() => setMusicPlaying(false)}
  onError={() => setMusicPlaying(false)}
/>
      <div className="hnc-home-artwork" aria-hidden="true" />

      <div className="hnc-home-layout">
        <header className="hnc-home-header">
          <div className="hnc-home-brand">
            <img src={logo} alt="Hot N Cool" className="hnc-home-logo" />
            <span>HNC Rewards</span>
          </div>

          <h1>Hi, {displayName}</h1>
          <button
  type="button"
  className="hnc-home-music"
  onClick={toggleHomeMusic}
  aria-pressed={musicPlaying}
>
  {musicPlaying ? 'Pause music' : 'Play music'}
</button>
        </header>

        <div className="hnc-home-grid">
          <section className="hnc-home-panel" aria-label="Game selection">
            <GameSelectionPanel />
          </section>

          <section className="hnc-home-panel" aria-labelledby="hnc-home-prize-title">
            <h2 id="hnc-home-prize-title" className="hnc-home-panel-title">
              Your prize
            </h2>

            {loading && (
              <p className="hnc-home-muted" role="status">
                Loading your prize…
              </p>
            )}

            {error && (
              <p className="hnc-home-alert" role="alert">
                {error}
              </p>
            )}

            {/* {!loading && !error && !win && (
              <div className="hnc-home-empty">
                <h3>No prize yet</h3>
                <p className="hnc-home-muted">
                  Choose a game for a chance to win.
                </p>
              </div>
            )} */}
            {!loading && !error && !win && <HomePrizeDraws />}

            {!loading && !error && win && <PrizeDetails win={win} />}
          </section>
        </div>
      </div>
    </main>
  );
}