import React, { useEffect, useRef, useState } from 'react';
import { getPrizeReview, listPrizeReviews, reviewPrize } from '../api/adminApi';

const PAGE_SIZE = 20;
const REVIEW_STATUSES = {
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  no_prize: 'No prize',
  prize_awarded: 'Prize awarded',
};

const GAME_NAMES = {
  monkey: 'Whack the Monkey',
  'perfect-shot': 'Perfect Shot',
};

function reviewStatusLabel(status) {
  return Object.hasOwn(REVIEW_STATUSES, status) ? REVIEW_STATUSES[status] : status || 'Unknown status';
}

function gameName(id) {
  return Object.hasOwn(GAME_NAMES, id) ? GAME_NAMES[id] : id || 'Unknown game';
}

function StatusBadge({ status }) {
  return (
    <span className="prize-reviews__badge" data-status={status}>
      {reviewStatusLabel(status)}
    </span>
  );
}

function Findings({ values = [], emptyText }) {
  if (!Array.isArray(values) || values.length === 0) {
    return <p className="prize-reviews__muted">{emptyText}</p>;
  }

  return (
    <ul className="prize-reviews__findings">
      {values.map((value, index) => <li key={index}>{String(value)}</li>)}
    </ul>
  );
}

function Detail({ id, onReviewed }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const heading = useRef(null);

  useEffect(() => {
    let active = true;
    heading.current?.focus();

    getPrizeReview(id)
      .then(response => {
        if (active) setData(response.data);
      })
      .catch(() => {
        if (active) setError('Unable to load review.');
      });

    return () => { active = false; };
  }, [id]);

  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  async function decide(action) {
    if (inFlight.current || error || data?.review?.status !== 'pending_review') return;

    inFlight.current = true;
    setBusy(true);
    try {
      await reviewPrize(id, action);
      if (alive.current) onReviewed(action);
    } catch {
      if (alive.current) {
        setError('Review was not confirmed. Refresh its status before retrying.');
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const review = data?.review;
  const assessments = data?.assessments;
  const assessmentsAvailable = assessments?.availability === 'available';
  const integrity = assessments?.integrity;
  const behavior = assessments?.behavior;

  return (
    <section id="selected-prize-review" className="prize-reviews__panel" aria-label="Selected prize review">
      <h2 ref={heading} tabIndex={-1}>Review details</h2>
      {error && <p className="prize-reviews__alert" role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading review…</p>}
      {data && !review && <p role="alert">Review details are unavailable.</p>}

      {review && (
        <>
          <dl className="prize-reviews__metadata">
            <div><dt>Game</dt><dd>{gameName(review.gameId)}</dd></div>
            <div><dt>Session</dt><dd><code>{review.gameSessionId}</code></dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={review.status} /></dd></div>
          </dl>

          <div className="prize-reviews__evidence">
            <section aria-labelledby="prize-review-integrity">
              <h3 id="prize-review-integrity">Integrity V2</h3>
              <p>Decision assessment version: {review.assessmentVersion ?? 'Unavailable'}</p>
              <p className="prize-reviews__label">Original decision findings</p>
              <Findings values={review.riskReasons} emptyText="No risk reasons listed." />
              {assessmentsAvailable && integrity && (
                <>
                  <p className="prize-reviews__label">
                    Server recomputation version: {integrity.assessmentVersion}
                  </p>
                  <Findings values={integrity.riskReasons} emptyText="No recomputed findings listed." />
                </>
              )}
            </section>

            <section aria-labelledby="prize-review-behavior">
              <h3 id="prize-review-behavior">Behavioral Signals V1</h3>
              <p className="prize-reviews__muted">
                Behavioral signals are advisory. Prize decisions require a separate assessment.
              </p>
              {assessmentsAvailable && behavior ? (
                <>
                  <p>Behavior version: {behavior.behaviorVersion}</p>
                  <p className="prize-reviews__label">
                    {behavior.reviewSuggested ? 'Advisory review suggested' : 'No advisory review suggested'}
                  </p>
                  <Findings values={behavior.signals} emptyText="No behavioral signals listed." />
                </>
              ) : <p>Independent assessments unavailable.</p>}
            </section>
          </div>

          <details className="prize-reviews__gameplay">
            <summary>Gameplay evidence</summary>
            <pre>{JSON.stringify(data.gameplay, null, 2) ?? 'Unavailable'}</pre>
          </details>

          <p className="prize-reviews__muted">Prize allocation and QR generation happen during the draw.</p>
          {review.status === 'pending_review' && (
            <>
              {busy && <p role="status">Saving review decision…</p>}
              <div className="prize-reviews__actions prize-reviews__decision-actions">
                <button type="button" className="prize-reviews__approve" disabled={busy || Boolean(error)}
                  onClick={() => void decide('approve')}>
                  Approve review
                </button>
                <button type="button" className="prize-reviews__reject" disabled={busy || Boolean(error)}
                  onClick={() => void decide('reject')}>
                  Reject review
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Queue({ status, page, onPrevious, onNext, onRefresh, onReviewed }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    listPrizeReviews({ status, page, limit: PAGE_SIZE })
      .then(response => {
        if (active) setData(response.data);
      })
      .catch(() => {
        if (active) setError('Unable to load prize reviews.');
      });

    return () => { active = false; };
  }, [status, page]);

  const hasNextPage = Boolean(data && page * PAGE_SIZE < data.total);

  return (
    <div className={'prize-reviews__layout' + (selected ? ' prize-reviews__layout--detail' : '')}>
      <section className="prize-reviews__panel" aria-label="Prize review results">
        <div className="prize-reviews__list-heading">
          <h2>{reviewStatusLabel(status)}</h2>
          <button type="button" onClick={onRefresh}>Refresh</button>
        </div>
        {error && <p className="prize-reviews__alert" role="alert">{error}</p>}
        {!data && !error && <p role="status">Loading…</p>}
        {data && (
          <>
            <p className="prize-reviews__muted">{data.total} {data.total === 1 ? 'review' : 'reviews'}</p>
            {data.items.length === 0 ? <p>No reviews found.</p> : (
              <ul className="prize-reviews__queue">
                {data.items.map(review => (
                  <li key={review.id} className="prize-reviews__queue-item" data-selected={selected === review.id}>
                    <div className="prize-reviews__list-heading">
                      <h3>{gameName(review.gameId)}</h3>
                      <StatusBadge status={review.status} />
                    </div>
                    <p className="prize-reviews__session">Session <code>{review.gameSessionId}</code></p>
                    <Findings values={review.riskReasons} emptyText="No risk reasons listed." />
                    <button
                      type="button"
                      aria-label={'Open review for ' + review.gameId + ': ' + review.gameSessionId}
                      aria-pressed={selected === review.id}
                      onClick={() => {
                        if (selected === review.id) {
                          document.getElementById('selected-prize-review')?.querySelector('h2')?.focus();
                        } else {
                          setSelected(review.id);
                        }
                      }}
                    >
                      Open review
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <nav className="prize-reviews__actions prize-reviews__pagination" aria-label="Prize review pages">
          <button type="button" disabled={page === 1} onClick={onPrevious}>Previous</button>
          <span aria-live="polite">Page {page}{data?.total > 0 ? ' of ' + Math.ceil(data.total / PAGE_SIZE) : ''}</span>
          <button type="button" disabled={!hasNextPage} onClick={onNext}>Next</button>
        </nav>
      </section>

      {selected && <Detail key={selected} id={selected} onReviewed={onReviewed} />}
    </div>
  );
}

export default function AdminPrizeReviewsPage() {
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');

  function changeStatus(event) {
    setStatus(event.target.value);
    setPage(1);
    setNotice('');
  }

  return (
    <main className="prize-reviews">
      <style>{pageStyles}</style>
      <header className="prize-reviews__header">
        <h1>Prize review queue</h1>
        <label htmlFor="prize-review-status">
          Review status
          <select id="prize-review-status" value={status} onChange={changeStatus}>
            {Object.entries(REVIEW_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </header>
      <div role="status">
        {notice && <p className="prize-reviews__notice">{notice}</p>}
      </div>
      <Queue
        key={status + ':' + page + ':' + refresh}
        status={status}
        page={page}
        onPrevious={() => { setNotice(''); setPage(current => Math.max(1, current - 1)); }}
        onNext={() => { setNotice(''); setPage(current => current + 1); }}
        onRefresh={() => { setNotice(''); setRefresh(current => current + 1); }}
        onReviewed={action => {
          setNotice(action === 'approve' ? 'Review approved.' : 'Review rejected.');
          setRefresh(current => current + 1);
        }}
      />
    </main>
  );
}

const pageStyles = `
  .prize-reviews {
    --review-text: #fff7f6;
    --review-muted: #dcc8d0;
    --review-border: #75404e;
    width: min(100%, 1260px);
    margin-inline: auto;
    padding-block: clamp(16px, 3vw, 36px);
    color: var(--review-text);
    overflow-wrap: anywhere;
  }
  .prize-reviews__header,
  .prize-reviews__list-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 14px;
  }
  .prize-reviews__header { margin-bottom: 18px; }
  .prize-reviews__header label { display: grid; gap: 4px; font-size: 14px; font-weight: 650; }
  .prize-reviews h1 { margin: 0; font-size: clamp(27px, 4vw, 40px); font-weight: 800; }
  .prize-reviews h2 { margin: 0; font-size: clamp(19px, 2.8vw, 25px); font-weight: 750; scroll-margin-top: 96px; }
  .prize-reviews h3 { margin: 0; font-size: 16px; font-weight: 750; }
  .prize-reviews p { margin: 0 0 10px; }
  .prize-reviews code { color: #ffbbca; }
  .prize-reviews__muted, .prize-reviews__session { color: var(--review-muted); font-size: 14px; }

  .prize-reviews__layout { display: grid; gap: 14px; align-items: start; }
  .prize-reviews__layout--detail { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); }
  .prize-reviews__panel {
    min-width: 0;
    padding: clamp(14px, 2.5vw, 22px);
    border: 1px solid var(--review-border);
    border-radius: 14px;
    background: #23131d;
  }
  .prize-reviews__panel > h2, .prize-reviews__list-heading { margin-bottom: 10px; }
  .prize-reviews__queue,
  .prize-reviews__findings { display: grid; gap: 8px; margin: 0 0 12px; padding: 0; list-style: none; }
  .prize-reviews__queue-item,
  .prize-reviews__evidence > section,
  .prize-reviews__gameplay {
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--review-border);
    border-radius: 10px;
    background: #301b28;
  }
  .prize-reviews__queue-item[data-selected='true'] { border-color: #f09bb0; }
  .prize-reviews__findings { display: flex; flex-wrap: wrap; gap: 5px; }
  .prize-reviews__findings li {
    min-width: 0;
    max-width: 100%;
    padding: 3px 7px;
    border: 1px solid #865c65;
    border-radius: 6px;
    color: #ffe4ce;
    font-size: 12px;
  }
  .prize-reviews__badge {
    display: inline-block;
    padding: 3px 8px;
    border: 1px solid #a47082;
    border-radius: 999px;
    color: #f5dce6;
    font-size: 12px;
    font-weight: 700;
  }
  .prize-reviews__badge[data-status='pending_review'] { border-color: #c1985d; background: #462b25; color: #ffe7bf; }
  .prize-reviews__badge:is([data-status='approved'], [data-status='prize_awarded']) { border-color: #559775; background: #17372b; color: #cff5df; }
  .prize-reviews__badge[data-status='rejected'] { border-color: #c76b7e; background: #481825; color: #ffe1e5; }

  .prize-reviews__metadata,
  .prize-reviews__evidence { display: grid; gap: 10px; margin: 0 0 14px; }
  .prize-reviews__metadata { grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); }
  .prize-reviews__metadata dt { color: var(--review-muted); font-size: 12px; }
  .prize-reviews__metadata dd { margin: 2px 0 0; }
  .prize-reviews__evidence h3 { margin-bottom: 8px; }
  .prize-reviews__label { font-size: 14px; font-weight: 700; }
  .prize-reviews__gameplay { margin-bottom: 12px; }
  .prize-reviews__gameplay summary { display: list-item; padding-block: 8px; cursor: pointer; }
  .prize-reviews__gameplay pre { max-height: 22rem; overflow: auto; margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }

  .prize-reviews__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .prize-reviews__pagination { justify-content: space-between; font-size: 14px; }
  .prize-reviews :is(button, select) {
    min-height: 44px;
    padding: 7px 12px;
    border: 1px solid #a47082;
    border-radius: 8px;
    background: #39202e;
    color: var(--review-text);
    font: inherit;
  }
  .prize-reviews button { cursor: pointer; }
  .prize-reviews button:hover:not(:disabled) { filter: brightness(1.2); }
  .prize-reviews button:disabled { opacity: 0.55; cursor: default; }
  .prize-reviews :is(button, select, summary, h2):focus-visible { outline: 2px solid #ffc5cb; outline-offset: 2px; }
  .prize-reviews button.prize-reviews__approve { border-color: #559775; background: #194832; }
  .prize-reviews button.prize-reviews__reject { border-color: #c76b7e; background: #731b30; }
  .prize-reviews__alert, .prize-reviews__notice { padding: 10px 12px; border-radius: 8px; }
  .prize-reviews__alert { background: #481825; color: #ffe1e5; }
  .prize-reviews__notice { background: #17372b; color: #cff5df; }

  @media (max-width: 850px) {
    .prize-reviews__layout--detail { grid-template-columns: minmax(0, 1fr); }
    .prize-reviews__decision-actions > button { flex: 1 1 130px; }
  }
`;
