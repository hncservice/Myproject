import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logos.png';
import { getMyLatestWin } from '../../api/spinApi';
import { useAuth } from '../../context/AuthContext';

const UserHomePage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [win, setWin] = useState(null);
  const [error, setError] = useState(null);

  // styles injected once
  useEffect(() => {
    if (document.getElementById('user-home-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'user-home-styles';
    styleEl.textContent = `
      :root{ --hnc-red:#dc2626; --hnc-red-dark:#991b1b; }
      .uh-page{
        min-height:100vh; padding:16px 16px 32px; box-sizing:border-box;
        background: radial-gradient(circle at top, #1f2937 0, #020617 55%, #020617 100%);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        color:#e5e7eb; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;
      }
      .uh-blob{ position:absolute; border-radius:999px; filter:blur(60px); opacity:.45; pointer-events:none; animation: float 10s ease-in-out infinite alternate; }
      .uh-blob--red{ width:320px; height:320px; background: rgba(220,38,38,.6); top:-80px; right:-40px; }
      .uh-blob--blue{ width:260px; height:260px; background: rgba(37,99,235,.5); bottom:-60px; left:-80px; animation-delay:1.5s; }
      .uh-wrap{ width:100%; max-width:520px; position:relative; z-index:1; }
      .uh-head{ display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:16px; text-align:center; }
      .uh-logoBox{
        background: rgba(15,23,42,.7); border-radius:999px; padding:8px 16px;
        box-shadow:0 10px 35px rgba(15,23,42,.8); backdrop-filter: blur(12px);
        display:inline-flex; align-items:center; justify-content:center;
      }
      .uh-logo{ height:42px; width:auto; display:block; }
      .uh-title{ color:#f9fafb; font-size:18px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; margin:0; }
      .uh-sub{ color: rgba(226,232,240,.7); font-size:13px; margin:0; }
      .uh-card{
        background: linear-gradient(145deg, rgba(15,23,42,.96), rgba(15,23,42,.98));
        border-radius:24px; padding:22px;
        box-shadow:0 24px 60px rgba(0,0,0,.7), 0 0 0 1px rgba(148,163,184,.25);
        border: 1px solid rgba(248,113,113,.18); backdrop-filter: blur(22px);
      }
      .uh-row{ display:flex; gap:14px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
      .uh-hello{ font-size:14px; color: rgba(226,232,240,.9); }
      .uh-pill{ font-size:11px; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.45); background: rgba(248,250,252,.05); }
      .uh-winBox{
        margin-top:14px;
        border: 1px solid rgba(34,197,94,.35);
        background: rgba(34,197,94,.08);
        border-radius:18px;
        padding:14px;
      }
      .uh-winTitle{ color:#f9fafb; font-size:16px; font-weight:800; margin:0 0 6px; }
      .uh-winMeta{ color: rgba(226,232,240,.75); font-size:12px; margin:0 0 10px; }
      .uh-prizeName{ font-weight:800; color:#e2e8f0; margin:0 0 6px; }
      .uh-prizeDesc{ color: rgba(226,232,240,.75); font-size:13px; margin:0; }
      .uh-qrGrid{ display:grid; grid-template-columns: 120px 1fr; gap:12px; align-items:center; margin-top:12px; }
      .uh-qrImg{
        width:120px; height:120px; border-radius:14px; background: rgba(15,23,42,.9);
        border:1px solid rgba(148,163,184,.35); object-fit:contain; padding:8px;
      }
      .uh-codeBox{
        border:1px dashed rgba(248,113,113,.5);
        border-radius:14px; padding:10px 12px; background: rgba(248,113,113,.06);
      }
      .uh-codeLabel{ font-size:11px; color: rgba(226,232,240,.65); margin:0 0 4px; }
      .uh-code{ font-size:14px; font-weight:800; letter-spacing:.06em; color:#fecaca; word-break:break-all; margin:0; }
      .uh-actions{ display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
      .uh-btn{
        border:none; border-radius:999px; padding:12px 14px;
        font-size:13px; font-weight:800; letter-spacing:.02em;
        cursor:pointer; color:#fef2f2;
        background: linear-gradient(135deg, var(--hnc-red) 0%, var(--hnc-red-dark) 100%);
        box-shadow:0 16px 35px rgba(248,113,113,.45), 0 0 0 1px rgba(248,113,113,.35);
      }
      .uh-btnSecondary{
        background: rgba(248,250,252,.06);
        border: 1px solid rgba(148,163,184,.45);
        color:#e5e7eb;
        box-shadow:none;
      }
      .uh-alert{
        margin-top:10px; border-radius:14px; padding:10px 11px;
        font-size:13px; display:flex; gap:10px; align-items:flex-start;
        background: rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.45); color:#fb7185;
      }
      @keyframes float{ from{ transform:translate3d(0,0,0);} to{ transform:translate3d(0,-18px,0);} }
      @media(max-width:480px){
        .uh-card{ padding:18px; border-radius:20px;}
        .uh-qrGrid{ grid-template-columns: 1fr; }
        .uh-qrImg{ width:140px; height:140px; margin:0 auto; }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getMyLatestWin();
        if (!alive) return;
        if (res?.data?.hasWin) setWin(res.data.win);
        else setWin(null);
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || 'Failed to load win');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const displayName = useMemo(() => profile?.name || profile?.email || 'User', [profile]);

  return (
    <div className="uh-page">
      <div className="uh-blob uh-blob--red" />
      <div className="uh-blob uh-blob--blue" />

      <div className="uh-wrap">
        <header className="uh-head">
          <div className="uh-logoBox">
            <img src={logo} alt="HNC Logo" className="uh-logo" />
          </div>
          <p className="uh-title">HNC Rewards</p>
          <p className="uh-sub">Your account, prize and QR code</p>
        </header>

        <div className="uh-card">
          <div className="uh-row">
            <div className="uh-hello">Hi, <b>{displayName}</b> 👋</div>
            <div className="uh-pill">{loading ? 'Loading…' : 'Ready'}</div>
          </div>

          {error && <div className="uh-alert">{error}</div>}

          {!loading && !error && !win && (
            <div className="uh-winBox" style={{ borderColor: 'rgba(148,163,184,.35)', background: 'rgba(248,250,252,.04)' }}>
              <p className="uh-winTitle">No prize yet</p>
              <p className="uh-winMeta">Play the monkey game to win a reward.</p>
            </div>
          )}

          {!loading && !error && win && (
            <div className="uh-winBox">
              <p className="uh-winTitle">🎉 Congratulations! You won</p>
              <p className="uh-prizeName">{win?.prize?.title || 'Prize'}</p>
              {win?.prize?.description && <p className="uh-prizeDesc">{win.prize.description}</p>}
              <p className="uh-winMeta">
                Status: <b>{win.redemptionStatus || 'pending'}</b>
                {win.qrExpiry ? <> • QR Expiry: <b>{new Date(win.qrExpiry).toLocaleString()}</b></> : null}
              </p>

              <div className="uh-qrGrid">
                {win.qrDataUrl ? (
                  <img src={win.qrDataUrl} alt="Prize QR" className="uh-qrImg" />
                ) : (
                  <div className="uh-qrImg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(226,232,240,.7)' }}>
                    No QR image
                  </div>
                )}

                <div className="uh-codeBox">
                  <p className="uh-codeLabel">Backup Code (QR Token)</p>
                  <p className="uh-code">{win.qrToken || '—'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="uh-actions">
            <button className="uh-btn" onClick={() => navigate('/monkey-game')}>
              Play Monkey Game
            </button>
            <button className="uh-btn uh-btnSecondary" onClick={() => navigate('/spin')}>
              Go to Spin Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserHomePage;
