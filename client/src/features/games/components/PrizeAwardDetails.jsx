import React, { useEffect, useState } from 'react';
import { getPrizeDecisionPrize } from '../api/spinApi';
// const Vendor = require('../features/vendors/models/Vendor');


export default function PrizeAwardDetails({ gameSessionId }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    setDetails(null);
    setLoading(true);
    setError('');

    async function load() {
      try {
        if (
          typeof gameSessionId !== 'string' ||
          !/^[a-f0-9]{24}$/i.test(gameSessionId)
        ) {
          throw new Error('Invalid session');
        }

        const response = await getPrizeDecisionPrize(gameSessionId);
        if (cancelled) return;

        const data = response?.data;
        const expiry = data?.qrExpiry == null
          ? null
          : new Date(data.qrExpiry).getTime();

        if (
          !data ||
          typeof data.gameSessionId !== 'string' ||
          data.gameSessionId.toLowerCase() !== gameSessionId.toLowerCase() ||
          typeof data.prize?.title !== 'string' ||
          !data.prize.title.trim() ||
          (
            data.prize.description != null &&
            typeof data.prize.description !== 'string'
          ) ||
          !['pending', 'redeemed'].includes(data.redemptionStatus) ||
          typeof data.expired !== 'boolean' ||
          (expiry !== null && !Number.isFinite(expiry))
        ) {
          throw new Error('Unexpected prize details');
        }

        const expired =
          data.expired ||
          (expiry !== null && expiry <= Date.now());

        if (
          data.redemptionStatus === 'pending' &&
          !expired &&
          (
            typeof data.qrDataUrl !== 'string' ||
            !/^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(data.qrDataUrl)
          )
        ) {
          throw new Error('Invalid prize QR');
        }

        setNow(Date.now());
        setDetails({
          gameSessionId: data.gameSessionId,
          title: data.prize.title,
          description: data.prize.description || '',
          redemptionStatus: data.redemptionStatus,
          expiry,
          expired,
          qrDataUrl: data.qrDataUrl,
        });
      } catch (failure) {
        if (cancelled) return;

        setError(
          failure?.response?.status === 401
            ? 'Please sign in again to view your prize.'
            : 'We could not load your prize details. Please try again.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [gameSessionId, refresh]);

  // Hide the QR when its expiry is reached while the panel is open.
  useEffect(() => {
    if (
      !details ||
      details.expired ||
      details.redemptionStatus !== 'pending' ||
      details.expiry === null ||
      details.expiry <= now
    ) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(
        Math.max(1, details.expiry - Date.now() + 1),
        2147483647
      )
    );

    return () => window.clearTimeout(timer);
  }, [details, now]);

  const currentDetails =
    details?.gameSessionId.toLowerCase() === gameSessionId?.toLowerCase()
      ? details
      : null;

  const redeemed =
    currentDetails?.redemptionStatus === 'redeemed';

  const expired =
    currentDetails?.expired ||
    (
      currentDetails?.expiry != null &&
      currentDetails.expiry <= now
    );

  return (
    <div aria-label="Awarded prize" aria-busy={loading}>
      {loading && <p role="status">Loading your prize details...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && currentDetails && (
        <>
          <h3>{currentDetails.title}</h3>

          {currentDetails.description && (
            <p>{currentDetails.description}</p>
          )}

          {redeemed ? (
            <p role="status">This prize has already been redeemed.</p>
          ) : expired ? (
            <p role="status">The QR code for this prize has expired.</p>
          ) : (
            <>
              <p>Show this QR code to the vendor to redeem your prize.</p>

              <img
                src={currentDetails.qrDataUrl}
                alt="Prize redemption QR code"
                width={240}
                height={240}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                  background: '#fff',
                  padding: 8,
                  borderRadius: 8,
                }}
              />

              {currentDetails.expiry !== null && (
                <p>
                  Valid until{' '}
                  {new Date(currentDetails.expiry).toLocaleString()}
                </p>
              )}
            </>
          )}
        </>
      )}

      <button
        type="button"
        className="ps-primary"
        style={{ minWidth: 0, marginTop: 12 }}
        disabled={loading}
        onClick={() => {
          setDetails(null);
          setLoading(true);
          setError('');
          setRefresh(value => value + 1);
        }}
      >
        REFRESH PRIZE DETAILS
      </button>
    </div>
  );
}