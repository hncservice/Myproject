import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../shared/api/axiosInstance';
import PrizeDecisionPanel from '../components/PrizeDecisionPanel';
import { RULES, level, create, step, replay } from './burgerRunRules.mjs';
import { drawGame } from './burgerRunRenderer.mjs';
import './BurgerRunPage.css';
import { useBurgerRunAudio } from './useBurgerRunAudio';

const base = '/games/burger-run';
const message = e => e?.response?.data?.message || e?.message || 'Unable to load the game.';
export default function BurgerRunPage() {
  const canvas = useRef(null), run = useRef(null), frame = useRef(null), keys = useRef(new Set()), alive = useRef(false), busy = useRef(false);
  const submitRef = useRef(null), lastSave = useRef(0);
  const [status, setStatus] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [hasActive, setHasActive] = useState(false);
  const [mode, setMode] = useState('idle'), [hud, setHud] = useState({ food: 0, hearts: 3, progress: 0, seconds: 90 });
  const [result, setResult] = useState(null), [decisionSession, setDecisionSession] = useState(null), [orphan, setOrphan] = useState(null);
  const audio = useBurgerRunAudio(mode);
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const storageKey = id => `hnc-burger-run-v1:${id}`;
  const save = useCallback(() => {
    const r = run.current;
    if (!r || r.committed) return;
    try { sessionStorage.setItem(storageKey(r.credentials.sessionId), JSON.stringify({ seed: r.state.seed, ticks: r.state.tick, inputs: r.inputs })); } catch { /* A lost device cache does not reset the server attempt. */ }
  }, []);
  const loadStatus = useCallback(async () => {
    const [{ data }, { data: current }] = await Promise.all([axiosInstance.get('/games/status'), axiosInstance.get(`${base}/session`)]);
    const game = data?.games?.find(g => g.id === 'burger-run');
    if (!game) throw new Error('HNC Burger Run is not available yet. Please try again later.');
    if (alive.current) { setStatus({ ...game, hasPrize: data.hasPrize }); setHasActive(Boolean(current?.activeSession)); }
    return { ...game, activeSession: current?.activeSession };
  }, []);
  const submit = useCallback(async () => {
    const r = run.current;
    if (!r || busy.current || r.state.phase === 'playing') return;
    busy.current = true; setMode('saving'); setError(''); save();
    try {
      const { data } = await axiosInstance.post(`${base}/finish`, { ...r.credentials, ticks: r.state.tick, inputs: r.inputs });
      if (!alive.current) return;
      r.committed = true; setResult(data); setMode('finished'); setDecisionSession(data.outcome === 'qualified' ? data.sessionId : null);
      try { sessionStorage.removeItem(storageKey(r.credentials.sessionId)); } catch { /* Optional device cache. */ }
      await loadStatus();
    } catch (e) { if (alive.current) { setError(message(e)); setMode('retry'); } }
    finally { busy.current = false; }
  }, [loadStatus, save]);
  submitRef.current = submit;

  useEffect(() => {
    alive.current = true;
    loadStatus().then(async game => {
      if (game.activeSession) return;
      const { data } = await axiosInstance.get(`${base}/history`);
      const previous = data?.items?.find(item => item.status === 'completed' && item.outcome === 'qualified');
      if (alive.current && previous) { setResult(previous); setDecisionSession(previous.sessionId); setMode('finished'); }
    }).catch(e => { if (alive.current) setError(message(e)); }).finally(() => { if (alive.current) setLoading(false); });
    const redraw = () => { const r = run.current; if (canvas.current) drawGame(canvas.current, r?.state || create(1991), r?.world || level(1991)); };
    redraw();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
    if (canvas.current) observer?.observe(canvas.current);
    window.addEventListener('resize', redraw);
    return () => { alive.current = false; keys.current.clear(); save(); if (frame.current) cancelAnimationFrame(frame.current); observer?.disconnect(); window.removeEventListener('resize', redraw); };
  }, [loadStatus, save]);

  useEffect(() => {
    const keyMap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump' };
    const down = e => {
      if (mode !== 'playing' || !keyMap[e.key] || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName) || e.target?.closest?.('.br-controls')) return;
      e.preventDefault(); if (!e.repeat) audioRef.current.unlock(); keys.current.add(keyMap[e.key]);
    };
    const up = e => { if (e.target?.closest?.('.br-controls')) return; if (keyMap[e.key]) { keys.current.delete(keyMap[e.key]); if (mode === 'playing') e.preventDefault(); } };
    const release = () => { keys.current.clear(); save(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); };
  }, [mode, save]);

  useEffect(() => {
    if (mode !== 'playing') return undefined;
    let last = performance.now(), accumulator = 0;
    const tick = now => {
      const r = run.current;
      if (!r || !alive.current) return;
      if (document.hidden) { last = now; frame.current = requestAnimationFrame(tick); return; }
      accumulator += Math.min(100, now - last); last = now;
      while (accumulator >= 1000 / RULES.hz && r.state.phase === 'playing') {
        const mask = (keys.current.has('left') ? 1 : 0) | (keys.current.has('right') ? 2 : 0) | (keys.current.has('jump') ? 4 : 0);
        const lastInput = r.inputs[r.inputs.length - 1];
        if (mask !== lastInput[1]) {
          if (lastInput[0] === r.state.tick) lastInput[1] = mask;
          else if (r.inputs.length < RULES.maxInputs) r.inputs.push([r.state.tick, mask]);
          else { setError('Control limit reached. End this attempt and try again.'); setOrphan(r.credentials); setMode('blocked'); return; }
        }
        const foodBefore = r.state.collected.length, heartsBefore = r.state.hearts, wasGrounded = r.state.grounded;
        step(r.state, mask, r.world);
        if (wasGrounded && !r.state.grounded && r.state.vy < 0) audioRef.current.jump();
        if (r.state.collected.length > foodBefore) audioRef.current.play('collect');
        if (r.state.hearts < heartsBefore) audioRef.current.play('hit');
        if (r.state.phase !== 'playing') audioRef.current.play(r.state.phase === 'won' ? 'win' : 'lose');
        accumulator -= 1000 / RULES.hz;
      }
      drawGame(canvas.current, r.state, r.world);
      if (r.state.tick % 6 === 0 || r.state.phase !== 'playing') setHud({ food: r.state.collected.length, hearts: r.state.hearts, progress: Math.min(100, r.state.x / r.world.finish * 100), seconds: Math.max(0, Math.ceil((RULES.maxTicks - r.state.tick) / RULES.hz)) });
      if (now - lastSave.current > 1000) { save(); lastSave.current = now; }
      if (Date.now() >= Date.parse(r.expiresAt)) { setError('This attempt has expired. Refresh eligibility to continue.'); setMode('expired'); void loadStatus().catch(() => {}); return; }
      if (r.state.phase !== 'playing') { save(); void submitRef.current(); return; }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); frame.current = null; };
  }, [mode, save, loadStatus]);

  async function start() {
    if (busy.current || mode === 'playing' || mode === 'paused') return;
    audioRef.current.begin();
    busy.current = true; setMode('starting'); setError(''); setResult(null); setDecisionSession(null); keys.current.clear();
    try {
      const { data: session } = await axiosInstance.post(`${base}/start`, {});
      if (!alive.current) return;
      const credentials = { sessionId: session.sessionId, sessionToken: session.sessionToken };
      const { data } = await axiosInstance.post(`${base}/prepare`, credentials);
      if (!alive.current) return;
      if (data.status === 'completed') { setResult(data); setMode('finished'); if (data.outcome === 'qualified') setDecisionSession(data.sessionId); return; }
      if (data.version !== 1 || !Number.isInteger(data.seed)) throw new Error('Game version unavailable. Please refresh.');
      let cached = null;
      try { cached = JSON.parse(sessionStorage.getItem(storageKey(session.sessionId)) || 'null'); } catch { /* Cache unavailable. */ }
      let state = create(data.seed), inputs = [[0, 0]];
      if (cached?.seed !== data.seed || !Number.isSafeInteger(cached?.ticks) || cached.ticks < 0) cached = null;
      if (cached && cached.ticks === 0 && JSON.stringify(cached.inputs) !== '[[0,0]]') cached = null;
      if (cached?.ticks > 0) {
        try { state = replay(data.seed, cached.ticks, cached.inputs); inputs = cached.inputs; } catch { cached = null; }
      }
      if (data.resumed && !cached && Date.now() - Date.parse(data.playStartedAt) > 5000) {
        setOrphan(credentials); setMode('blocked'); setError('An unfinished attempt exists, but its progress is unavailable on this device. End it before starting again.'); return;
      }
      run.current = { credentials, state, inputs, world: level(data.seed), expiresAt: data.expiresAt };
      setOrphan(null); setHasActive(true); setStatus(v => ({ ...v, attemptsLeft: session.attemptsLeft })); save();
      setHud({ food: state.collected.length, hearts: state.hearts, progress: state.x / 4650 * 100, seconds: Math.ceil((RULES.maxTicks - state.tick) / 60) });
      drawGame(canvas.current, state, run.current.world);
      setMode(state.phase === 'playing' ? 'playing' : 'retry');
    } catch (e) { if (alive.current) { setError(message(e)); setMode('idle'); } }
    finally { busy.current = false; }
  }
  async function abandon() {
    if (!orphan || busy.current) return;
    busy.current = true;
    try { await axiosInstance.post(`${base}/complete`, orphan); if (!alive.current) return; setOrphan(null); run.current = null; setError(''); setMode('idle'); await loadStatus(); }
    catch (e) { if (alive.current) setError(message(e)); }
    finally { busy.current = false; }
  }
  function control(action, pressed, event) {
    if (mode !== 'playing') return;
    event.preventDefault();
    if (pressed) { audioRef.current.unlock(); keys.current.add(action); event.currentTarget.setPointerCapture?.(event.pointerId); }
    else keys.current.delete(action);
  }
  const playing = mode === 'playing', running = playing || mode === 'paused';
  return <main className="br-page hnc-game-page">
    <div className="br-wrap">
      <header className="br-header"><div><p className="br-eyebrow">HNC GAMES · LEVEL 01</p><h1>HNC Burger Run <span>🍔</span></h1><p>Run, jump and bring the flavour home.</p></div><Link to="/user/home" className="br-link">All games</Link></header>
      <section className="br-card" aria-label="HNC Burger Run">
        <div className="br-hud"><div><span>FOOD</span><strong>{hud.food}<small> / {RULES.requiredFood}</small></strong></div><div><span>HEARTS</span><strong aria-label={`${hud.hearts} hearts remaining`}>{'♥'.repeat(Math.max(0,hud.hearts)) || '—'}</strong></div><div><span>TIME</span><strong>{hud.seconds}<small>s</small></strong></div></div>
        <div className="br-stage"><canvas ref={canvas} aria-label="Burger character platform game. Use the Left, Right and Jump controls below." />
          {!running && <div className="br-overlay"><span className="br-badge">{mode === 'finished' ? result?.outcome === 'qualified' ? 'DELIVERY COMPLETE' : 'TRY ANOTHER RUN' : 'A LITTLE ADVENTURE. A LOT OF FLAVOUR.'}</span><h2>{mode === 'finished' ? `${result?.score ?? 0} points` : 'Ready, chef?'}</h2><p>{mode === 'saving' ? 'Checking your run…' : mode === 'retry' ? 'Your run is saved on this device. Retry submitting it.' : `Collect ${RULES.requiredFood} food items, avoid obstacles and reach HOT N COOL.`}</p>
            {mode === 'retry' ? <button className="br-primary" onClick={() => void submit()}>Retry result</button> : orphan ? <button className="br-primary" onClick={() => void abandon()}>End unfinished attempt</button> : <button className="br-primary" disabled={loading || ['starting','saving','expired'].includes(mode) || status?.hasPrize || (!hasActive && (status?.locked || !status))} onClick={() => void start()}>{loading ? 'Loading…' : mode === 'starting' ? 'Starting…' : status?.hasPrize ? 'Prize already awarded' : 'Start / resume run'}</button>}
          </div>}
          {mode === 'paused' && <div className="br-overlay"><h2>Paused</h2><p>The session expiry still applies.</p><button className="br-primary" onClick={() => { audioRef.current.unlock(); keys.current.clear(); setMode('playing'); }}>Continue</button></div>}
        </div>
        <div className="br-progress" aria-label={`Journey ${Math.round(hud.progress)} percent`}><span style={{ width: `${hud.progress}%` }} /></div>
        <div className="br-controls" aria-label="Game controls">{[['left','←','Move left'],['right','→','Move right'],['jump','↥ Jump','Jump']].map(([action,label,aria]) => <button key={action} type="button" disabled={!playing} aria-label={aria} onPointerDown={e=>control(action,true,e)} onPointerUp={e=>control(action,false,e)} onPointerCancel={e=>control(action,false,e)} onLostPointerCapture={()=>keys.current.delete(action)} onKeyDown={e=>{if(!e.repeat&&(e.key==='Enter'||e.key===' ')){e.preventDefault();audioRef.current.unlock();keys.current.add(action);}}} onKeyUp={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();keys.current.delete(action);}}}>{label}</button>)}<button type="button" disabled={!running} onClick={()=>{if(!playing)audioRef.current.unlock();keys.current.clear();save();setMode(playing?'paused':'playing');}}>{playing?'Pause':'Continue'}</button></div>
        <button type="button" className="br-refresh" style={{ marginTop: 12 }} aria-pressed={audio.soundEnabled} onClick={audio.toggleSound}>{audio.soundEnabled ? '🔊 Sound on — mute' : '🔇 Sound off — enable'}</button>
        <p className="br-meta">Attempts remaining: <strong>{status?.attemptsLeft ?? '…'} / {status?.maxAttempts ?? 3}</strong> · Desktop: ← → and Space · Mobile: hold arrows and tap Jump</p>
        {error && <p className="br-error" role="alert">{error}</p>}
        <p className="br-note">Qualifying runs are reviewed before the prize draw. One campaign prize per customer across all games.</p>
        <button className="br-refresh" disabled={running || busy.current} onClick={()=>{setLoading(true);loadStatus().then(()=>{setError('');if(mode==='expired')setMode('idle');}).catch(e=>setError(message(e))).finally(()=>{if(alive.current)setLoading(false);});}}>Refresh eligibility</button>
      </section>
      {decisionSession && <section className="br-card"><PrizeDecisionPanel key={decisionSession} gameSessionId={decisionSession} allowDecisionRecovery /></section>}
      <footer className="br-guide"><div><span>01</span><h3>Collect the good stuff</h3><p>Fries, juice and stars all count. Aim for at least ten.</p></div><div><span>02</span><h3>Keep your chef safe</h3><p>Jump over crates, spilled drinks and the moving barrier.</p></div><div><span>03</span><h3>Find your finish</h3><p>Reach the HNC restaurant before the run ends.</p></div></footer>
    </div>
  </main>;
}
