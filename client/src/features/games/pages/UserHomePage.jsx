import React, { useEffect, useRef, useState } from 'react';
import logo from '../../../assets/logos.png';
import { getMyLatestWin } from '../api/spinApi';
import { useAuth } from '../../authentication/context/AuthContext';
import GameSelectionPanel from '../components/GameSelectionPanel';
import '../styles/UserHomePage.css';
import homeMusic from '../../../assets/sounds/play5.mp3';

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

            {!loading && !error && !win && (
              <div className="hnc-home-empty">
                <h3>No prize yet</h3>
                <p className="hnc-home-muted">
                  Choose a game for a chance to win.
                </p>
              </div>
            )}

            {!loading && !error && win && <PrizeDetails win={win} />}
          </section>
        </div>
      </div>
    </main>
  );
}