import React, { useEffect, useRef, useState } from 'react';
import { listCampaigns, createCampaign, updateCampaign, getCampaignActivity } from '../api/adminApi';

const blank = () => ({
  campaignId: '',
  name: '',
  enabled: false,
  gameIds: [],
  startsAt: '',
  endsAt: '',
  eligibility: { verifiedEmailRequired: true, minAccountAgeHours: 0 },
  participation: { maxSessionsPerUser: 3, maxConcurrentSessions: 1, allowPriorWinners: false },
  prizeItemIds: [],
});

const qatarDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Qatar',
  dateStyle: 'medium',
  timeStyle: 'short',
});

function CampaignTime({ value }) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '—';

  const date = new Date(timestamp);
  return <time dateTime={date.toISOString()}>{qatarDate.format(date)}</time>;
}

function scheduleStatus(start, end, now) {
  const starts = Date.parse(start);
  const ends = Date.parse(end);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || starts >= ends) return 'Unavailable';
  if (now < starts) return 'Upcoming';
  return now >= ends ? 'Ended' : 'In date range';
}

function Activity({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCampaignActivity(id)
      .then(response => { if (active) setData(response.data); })
      .catch(() => { if (active) setError('Unable to load campaign activity.'); });
    return () => { active = false; };
  }, [id]);

  const history = data?.auditHistory ?? [];

  return (
    <section className="campaign-admin__panel" aria-label="Campaign activity">
      <h2>Activity: {id}</h2>
      {error && <p className="campaign-admin__alert" role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading activity…</p>}
      {data && (
        <>
          <dl className="campaign-admin__activity-counts">
            <div><dt>Sessions</dt><dd>{data.sessions}</dd></div>
            <div><dt>Completed</dt><dd>{data.completed}</dd></div>
          </dl>
          <h3>Latest administrative audit history</h3>
          {history.length > 0 ? (
            <ol className="campaign-admin__audit">
              {history.map(entry => (
                <li key={entry.id}>
                  <strong>{entry.action}</strong> · Revision {entry.revision}
                  <div><CampaignTime value={entry.createdAt} /> · Administrator {entry.adminId}</div>
                </li>
              ))}
            </ol>
          ) : <p>No activity recorded.</p>}
        </>
      )}
    </section>
  );
}

export default function AdminCampaignsPage() {
  const [query, setQuery] = useState({ page: 1, limit: 20, q: '', enabled: 'all' });
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [definition, setDefinition] = useState(blank);
  const [revision, setRevision] = useState(0);
  const [prizes, setPrizes] = useState('');
  const [activity, setActivity] = useState(null);
  const [saving, setSaving] = useState(false);
  const alive = useRef(false);
  const inFlight = useRef(false);
  const receipt = useRef(null);
  const campaignName = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setListError('');

    listCampaigns(query)
      .then(response => { if (active) setData(response.data); })
      .catch(() => { if (active) setListError('Unable to load campaigns.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [query, refresh]);

  const field = (key, value) => setDefinition(previous => ({ ...previous, [key]: value }));

  function clear() {
    setDefinition(blank());
    setRevision(0);
    setPrizes('');
    receipt.current = null;
  }

  function editCampaign(campaign) {
    if (inFlight.current) return;
    const { revision: currentRevision, participationActive: _participationActive, ...fields } = campaign;
    setDefinition(fields);
    setRevision(currentRevision);
    setPrizes((campaign.prizeItemIds ?? []).join(', '));
    setError('');
    setNotice('');
    receipt.current = null;
    campaignName.current?.focus();
  }

  function changeQuery(fields) {
    setActivity(null);
    setQuery(previous => ({ ...previous, ...fields }));
  }

  async function save(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const proposed = {
      ...definition,
      prizeItemIds: prizes.split(',').map(prize => prize.trim()).filter(Boolean),
    };
    const start = Date.parse(proposed.startsAt);
    const end = Date.parse(proposed.endsAt);

    if (!proposed.gameIds.length || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      setError('Select games and enter a valid UTC start/end range.');
      return;
    }

    const signature = JSON.stringify({ definition: proposed, expectedRevision: revision });
    if (receipt.current?.signature !== signature) {
      try {
        receipt.current = { signature, requestId: globalThis.crypto.randomUUID() };
      } catch {
        setError('Secure request identifiers unavailable. Use a supported secure browser.');
        return;
      }
    }

    const payload = { definition: proposed, expectedRevision: revision, requestId: receipt.current.requestId };
    inFlight.current = true;
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (revision) await updateCampaign(definition.campaignId, payload);
      else await createCampaign(payload);

      if (alive.current) {
        clear();
        setActivity(null);
        setNotice('Campaign definition saved. Customer participation remains disabled.');
        setRefresh(previous => previous + 1);
      }
    } catch (err) {
      if (alive.current) {
        setError(err?.response?.data?.code === 'CAMPAIGN_REVISION_CONFLICT'
          ? 'Campaign changed. Reload and review the latest revision before saving.'
          : 'Unable to save campaign. Check the definition or retry the unchanged request.');
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }

  const games = data?.games ?? [];
  const gameNames = new Map(games.map(game => [game.id, game.config?.label || game.id]));
  const campaigns = data?.items ?? [];
  const now = Date.now();

  return (
    <main className="campaign-admin">
      <style>{pageStyles}</style>
      <header className="campaign-admin__heading">
        <h1>Campaign management</h1>
        <p className="campaign-admin__note" role="note">
          Definitions only. Customer participation and prize allocation remain disabled, including when availability is enabled.
        </p>
      </header>

      <form className="campaign-admin__panel" onSubmit={save} aria-label="Campaign definition">
        {error && <p className="campaign-admin__alert" role="alert">{error}</p>}
        {notice && <p className="campaign-admin__notice" role="status">{notice}</p>}
        <fieldset disabled={saving}>
          <legend>{revision ? 'Edit revision ' + revision : 'Create campaign'}</legend>
          <div className="campaign-admin__fields">
            <label>
              Campaign identifier
              <input required pattern="[a-z][a-z0-9-]{2,63}" maxLength={64} disabled={revision > 0}
                value={definition.campaignId} onChange={event => field('campaignId', event.target.value)} />
            </label>
            <label>
              Campaign name
              <input ref={campaignName} required minLength={2} maxLength={100}
                value={definition.name} onChange={event => field('name', event.target.value)} />
            </label>
            <label>
              Start (UTC ISO timestamp)
              <input required placeholder="2026-11-01T00:00:00Z" spellCheck={false} autoCapitalize="none"
                value={definition.startsAt} onChange={event => field('startsAt', event.target.value)} />
            </label>
            <label>
              End (UTC ISO timestamp)
              <input required placeholder="2026-12-01T00:00:00Z" spellCheck={false} autoCapitalize="none"
                value={definition.endsAt} onChange={event => field('endsAt', event.target.value)} />
            </label>
            <label>
              Minimum account age (hours)
              <input type="number" min={0} max={8760} required value={definition.eligibility.minAccountAgeHours}
                onChange={event => field('eligibility', { verifiedEmailRequired: true, minAccountAgeHours: Number(event.target.value) })} />
            </label>
            <label>
              Maximum sessions per customer
              <input type="number" min={1} max={6} required value={definition.participation.maxSessionsPerUser}
                onChange={event => field('participation', { ...definition.participation, maxSessionsPerUser: Number(event.target.value) })} />
            </label>
            <label className="campaign-admin__wide">
              Prize inventory identifiers (comma separated, optional)
              <textarea value={prizes} maxLength={1300} rows={2} onChange={event => setPrizes(event.target.value)} />
            </label>
          </div>

          <label className="campaign-admin__check">
            <input type="checkbox" checked={definition.enabled}
              onChange={event => field('enabled', event.target.checked)} />
            Definition availability enabled
          </label>

          <fieldset className="campaign-admin__games">
            <legend>Supported games</legend>
            <div className="campaign-admin__actions">
              {games.map(game => (
                <label key={game.id} className="campaign-admin__check">
                  <input type="checkbox" checked={definition.gameIds.includes(game.id)}
                    onChange={event => field('gameIds', event.target.checked
                      ? [...definition.gameIds, game.id]
                      : definition.gameIds.filter(id => id !== game.id))} />
                  {gameNames.get(game.id)}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="campaign-admin__muted">
            Verified email required. Prior prize winners excluded. At most one active session. Existing game validators and attempt limits remain authoritative.
          </p>
          <div className="campaign-admin__actions">
            <button type="submit" className="campaign-admin__primary" disabled={loading}>
              {saving ? 'Saving…' : 'Save definition'}
            </button>
            <button type="button" onClick={clear}>New definition</button>
          </div>
        </fieldset>
      </form>

      <section className="campaign-admin__panel" aria-label="Campaign list">
        <h2>Definitions</h2>
        <div className="campaign-admin__filters">
          <label>
            Search campaigns
            <input maxLength={100} value={query.q} onChange={event => changeQuery({ q: event.target.value, page: 1 })} />
          </label>
          <label>
            Availability
            <select value={query.enabled} onChange={event => changeQuery({ enabled: event.target.value, page: 1 })}>
              <option value="all">All</option>
              <option value="true">Enabled definitions</option>
              <option value="false">Disabled definitions</option>
            </select>
          </label>
          <button type="button" disabled={loading} onClick={() => { setActivity(null); setRefresh(previous => previous + 1); }}>
            Reload definitions
          </button>
        </div>

        {loading && <p className="campaign-admin__muted" role="status">Loading campaigns…</p>}
        {listError && <p className="campaign-admin__alert" role="alert">{listError}</p>}
        {!loading && !listError && data && (
          <>
            <p className="campaign-admin__muted">{data.total} definitions{data.pages > 0 ? ' · Page ' + data.page + ' of ' + data.pages : ''}</p>
            {campaigns.length === 0 ? <p>No campaign definitions.</p> : (
              <>
                <p className="campaign-admin__muted">Schedule times are shown in Qatar time.</p>
                <ul className="campaign-admin__list">
                  {campaigns.map(campaign => (
                    <li key={campaign.campaignId} className="campaign-admin__item">
                      <div className="campaign-admin__item-heading">
                        <div>
                          <h3>{campaign.name}</h3>
                          <span className="campaign-admin__muted">{campaign.campaignId}</span>
                        </div>
                        <span className={'campaign-admin__badge' + (campaign.enabled ? ' campaign-admin__badge--enabled' : '')}>
                          {campaign.enabled ? 'Enabled definition' : 'Disabled definition'}
                        </span>
                      </div>
                      <dl className="campaign-admin__details">
                        <div><dt>Schedule</dt><dd>{scheduleStatus(campaign.startsAt, campaign.endsAt, now)}</dd></div>
                        <div><dt>Starts</dt><dd><CampaignTime value={campaign.startsAt} /></dd></div>
                        <div><dt>Ends</dt><dd><CampaignTime value={campaign.endsAt} /></dd></div>
                        <div>
                          <dt>Games</dt>
                          <dd>{(campaign.gameIds ?? []).map(id => gameNames.get(id) || id).join(', ') || '—'}</dd>
                        </div>
                        <div><dt>Revision</dt><dd>{campaign.revision}</dd></div>
                      </dl>
                      <div className="campaign-admin__actions">
                        <button type="button" disabled={saving} aria-label={'Edit ' + campaign.name}
                          onClick={() => editCampaign(campaign)}>Edit</button>
                        <button type="button" aria-label={'Activity ' + campaign.name}
                          onClick={() => setActivity(campaign.campaignId)}>Activity</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <nav className="campaign-admin__actions" aria-label="Campaign pages">
          <button type="button" disabled={loading || query.page === 1}
            onClick={() => changeQuery({ page: query.page - 1 })}>Previous campaigns</button>
          <button type="button" disabled={loading || Boolean(listError) || !data || query.page >= data.pages}
            onClick={() => changeQuery({ page: query.page + 1 })}>Next campaigns</button>
        </nav>
      </section>

      {activity && <Activity key={activity} id={activity} />}
    </main>
  );
}

const pageStyles = `
  .campaign-admin {
    --campaign-text: #fff7f6;
    --campaign-muted: #dcc8d0;
    --campaign-border: #75404e;
    width: min(100%, 1160px);
    margin-inline: auto;
    padding: clamp(16px, 3vw, 36px) 0;
    color: var(--campaign-text);
    overflow-wrap: anywhere;
  }

  .campaign-admin__heading { margin-bottom: 18px; }
  .campaign-admin h1 { margin: 0 0 10px; font-size: clamp(27px, 4vw, 40px); font-weight: 800; }
  .campaign-admin h2,
  .campaign-admin legend { margin: 0 0 14px; font-size: clamp(18px, 3vw, 24px); font-weight: 750; }
  .campaign-admin h3 { margin: 0; font-size: 17px; font-weight: 750; }
  .campaign-admin__panel,
  .campaign-admin__note,
  .campaign-admin__alert,
  .campaign-admin__notice { border: 1px solid var(--campaign-border); border-radius: 12px; }
  .campaign-admin__panel { margin: 0 0 16px; padding: clamp(14px, 2.8vw, 24px); background: #23131d; }
  .campaign-admin__note,
  .campaign-admin__alert,
  .campaign-admin__notice { margin: 0 0 12px; padding: 10px 12px; font-size: 14px; }
  .campaign-admin__note { background: #38232f; color: #ffe7bf; }
  .campaign-admin__alert { background: #481825; color: #ffe1e5; }
  .campaign-admin__notice { background: #17372b; color: #cff5df; }
  .campaign-admin__muted { color: var(--campaign-muted); font-size: 14px; }
  .campaign-admin fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
  .campaign-admin legend { float: none; width: auto; color: inherit; }

  .campaign-admin__fields,
  .campaign-admin__filters,
  .campaign-admin__details { display: grid; gap: 10px 14px; }
  .campaign-admin__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 14px; }
  .campaign-admin__wide { grid-column: 1 / -1; }
  .campaign-admin__filters {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
    align-items: end;
    margin-bottom: 14px;
  }
  .campaign-admin :is(.campaign-admin__fields, .campaign-admin__filters) label {
    display: grid;
    gap: 5px;
    min-width: 0;
    font-weight: 650;
  }
  .campaign-admin :is(input:not([type='checkbox']), textarea, select, button) {
    min-height: 44px;
    padding: 8px 11px;
    border: 1px solid #a47082;
    border-radius: 9px;
    background: #321e2b;
    color: var(--campaign-text);
    font: inherit;
  }
  .campaign-admin :is(input:not([type='checkbox']), textarea, select) { width: 100%; min-width: 0; font-size: 16px; }
  .campaign-admin input::placeholder { color: var(--campaign-muted); }
  .campaign-admin input { scroll-margin-top: 96px; }
  .campaign-admin textarea { resize: vertical; }
  .campaign-admin button { cursor: pointer; }
  .campaign-admin button:hover:not(:disabled) { background: #53283e; }
  .campaign-admin button.campaign-admin__primary { background: #a51d37; }
  .campaign-admin button:disabled { cursor: default; }
  .campaign-admin :is(input, textarea, select, button):disabled { opacity: 0.6; }
  .campaign-admin :is(input, textarea, select, button):focus-visible { outline: 2px solid #ffc5cb; outline-offset: 2px; }

  .campaign-admin__actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .campaign-admin__check { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; }
  .campaign-admin__check input { width: 18px; height: 18px; margin: 0; accent-color: #b9253d; }
  .campaign-admin fieldset.campaign-admin__games { margin: 8px 0 10px; }
  .campaign-admin__games legend { font-size: 16px; margin-bottom: 2px; }
  .campaign-admin__games .campaign-admin__check { padding-inline: 10px; border: 1px solid var(--campaign-border); border-radius: 9px; }

  .campaign-admin__list { display: grid; gap: 10px; padding: 0; margin: 0 0 14px; list-style: none; }
  .campaign-admin__item { min-width: 0; padding: 14px; border: 1px solid var(--campaign-border); border-radius: 12px; background: #301b28; }
  .campaign-admin__item-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 8px 12px; }
  .campaign-admin__badge { padding: 4px 9px; border: 1px solid #a47082; border-radius: 999px; color: #f3dce4; font-size: 12px; font-weight: 650; }
  .campaign-admin__badge--enabled { border-color: #a57c50; color: #ffe7bf; background: #462b25; }
  .campaign-admin__details { grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); margin: 12px 0; }
  .campaign-admin__details dt, .campaign-admin__activity-counts dt { font-size: 12px; color: var(--campaign-muted); }
  .campaign-admin__details dd, .campaign-admin__activity-counts dd { margin: 3px 0 0; font-size: 14px; }
  .campaign-admin__activity-counts { display: flex; flex-wrap: wrap; gap: 12px 24px; }
  .campaign-admin__audit { margin: 10px 0 0; padding-inline-start: 24px; }
  .campaign-admin__audit li { margin-bottom: 8px; }

  @media (max-width: 680px) {
    .campaign-admin__fields, .campaign-admin__filters { grid-template-columns: minmax(0, 1fr); }
    .campaign-admin__actions > button { flex: 1 1 125px; }
  }
`;
