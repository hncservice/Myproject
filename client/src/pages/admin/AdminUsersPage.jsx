import React, { useEffect, useMemo, useState } from 'react';
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} from '../../api/adminApi';

const AdminUsersPage = () => {
  const [q, setQ] = useState('');
  const [emailVerified, setEmailVerified] = useState('all'); // all | true | false
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [data, setData] = useState({ items: [], total: 0, pages: 1 });

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState('create'); // create | edit
  const [activeUser, setActiveUser] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    emailVerified: false,
    monkeyAttempts: 0,
    monkeyLocked: false,
    hasSpun: false,
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // {type:'success'|'error', text:''}

  // Inject styles once
  useEffect(() => {
    if (document.getElementById('admin-users-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'admin-users-styles';
    styleEl.textContent = `
      :root{
        --hnc-red:#dc2626;
        --hnc-red-dark:#991b1b;
        --hnc-bg:#020617;
      }

      .admin-users-page{
        padding: 6px 0 28px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      }

      .admin-users-hero{
        border-radius: 22px;
        padding: 18px 16px;
        background: linear-gradient(145deg, rgba(15,23,42,0.94), rgba(15,23,42,0.98));
        border: 1px solid rgba(148,163,184,0.25);
        box-shadow: 0 18px 55px rgba(0,0,0,0.55);
        margin-bottom: 14px;
      }

      .admin-users-title{
        margin: 0 0 4px;
        color: #f9fafb;
        font-weight: 800;
        letter-spacing: 0.02em;
        font-size: 18px;
      }

      .admin-users-subtitle{
        margin: 0;
        color: rgba(148,163,184,0.95);
        font-size: 12px;
      }

      .admin-users-toolbar{
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr 160px 160px;
        gap: 10px;
        align-items: center;
      }

      .admin-users-input{
        width: 100%;
        padding: 11px 14px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.55);
        background: rgba(2,6,23,0.55);
        color: #f9fafb;
        outline: none;
        transition: border-color .15s ease, box-shadow .15s ease, transform .12s ease;
      }
      .admin-users-input:focus{
        border-color: rgba(248,113,113,0.95);
        box-shadow: 0 0 0 6px rgba(248,113,113,0.18);
        transform: translateY(-1px);
      }

      .admin-users-select{
        width: 100%;
        padding: 11px 14px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.55);
        background: rgba(2,6,23,0.55);
        color: #f9fafb;
        outline: none;
      }

      .admin-users-btn{
        border: none;
        cursor: pointer;
        padding: 11px 14px;
        border-radius: 999px;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: #fef2f2;
        background: linear-gradient(135deg, var(--hnc-red), var(--hnc-red-dark));
        box-shadow: 0 14px 35px rgba(248,113,113,0.35);
        transition: transform .12s ease, box-shadow .15s ease, filter .15s ease;
        white-space: nowrap;
      }
      .admin-users-btn:hover{
        transform: translateY(-1px);
        box-shadow: 0 18px 45px rgba(248,113,113,0.42);
        filter: brightness(1.03);
      }
      .admin-users-btn:disabled{
        opacity: 0.7;
        cursor: not-allowed;
        box-shadow: none;
      }

      .admin-users-card{
        border-radius: 22px;
        background: rgba(15,23,42,0.92);
        border: 1px solid rgba(148,163,184,0.22);
        box-shadow: 0 18px 55px rgba(0,0,0,0.55);
        overflow: hidden;
      }

      .admin-users-table-wrap{
        width: 100%;
        overflow-x: auto;
      }

      table.admin-users-table{
        width: 100%;
        border-collapse: collapse;
        min-width: 980px;
      }

      .admin-users-table th, .admin-users-table td{
        padding: 12px 12px;
        border-bottom: 1px solid rgba(148,163,184,0.18);
        color: rgba(226,232,240,0.92);
        font-size: 12px;
        text-align: left;
        vertical-align: top;
      }

      .admin-users-table th{
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(148,163,184,0.92);
        background: rgba(2,6,23,0.35);
        position: sticky;
        top: 0;
        z-index: 2;
      }

      .admin-pill{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 4px 10px;
        border: 1px solid rgba(148,163,184,0.25);
        background: rgba(2,6,23,0.35);
        font-size: 11px;
        white-space: nowrap;
      }

      .dot{
        width: 7px;
        height: 7px;
        border-radius: 999px;
        display: inline-block;
      }
      .dot.green{ background:#22c55e; box-shadow:0 0 0 6px rgba(34,197,94,0.18); }
      .dot.red{ background:#ef4444; box-shadow:0 0 0 6px rgba(239,68,68,0.18); }
      .dot.yellow{ background:#f59e0b; box-shadow:0 0 0 6px rgba(245,158,11,0.18); }

      .admin-users-actions{
        display:flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .mini-btn{
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.35);
        background: rgba(2,6,23,0.35);
        color: rgba(226,232,240,0.92);
        padding: 6px 10px;
        font-size: 11px;
        cursor: pointer;
        transition: transform .12s ease, border-color .15s ease, background .15s ease;
      }
      .mini-btn:hover{
        transform: translateY(-1px);
        border-color: rgba(248,113,113,0.55);
        background: rgba(248,113,113,0.08);
      }
      .mini-btn.danger{
        border-color: rgba(239,68,68,0.45);
        color: #fecaca;
      }
      .mini-btn.danger:hover{
        background: rgba(239,68,68,0.12);
      }

      .admin-pagination{
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        background: rgba(2,6,23,0.25);
      }

      .pager{
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap: wrap;
      }

      .pager-btn{
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.35);
        background: rgba(2,6,23,0.35);
        color: rgba(226,232,240,0.92);
        font-size: 11px;
        cursor: pointer;
      }
      .pager-btn:disabled{
        opacity:0.55;
        cursor:not-allowed;
      }

      /* Toast */
      .admin-toast{
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 9999;
        max-width: 360px;
        border-radius: 16px;
        padding: 12px 12px;
        border: 1px solid rgba(148,163,184,0.25);
        background: rgba(15,23,42,0.92);
        box-shadow: 0 20px 55px rgba(0,0,0,0.55);
        color: rgba(226,232,240,0.92);
        display:flex;
        gap: 10px;
        align-items: flex-start;
      }
      .admin-toast.success{ border-color: rgba(34,197,94,0.35); }
      .admin-toast.error{ border-color: rgba(239,68,68,0.35); }
      .admin-toast strong{ display:block; font-size: 12px; color:#f9fafb; margin-bottom: 2px; }
      .admin-toast p{ margin:0; font-size: 12px; color: rgba(148,163,184,0.95); }
      .toast-x{
        margin-left:auto;
        background: transparent;
        border:none;
        cursor:pointer;
        color: rgba(148,163,184,0.95);
        font-size: 16px;
        line-height: 1;
      }

      /* Modal */
      .admin-modal-backdrop{
        position: fixed;
        inset: 0;
        background: rgba(2,6,23,0.65);
        backdrop-filter: blur(8px);
        z-index: 9998;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 14px;
      }
      .admin-modal{
        width: 100%;
        max-width: 560px;
        border-radius: 22px;
        background: linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98));
        border: 1px solid rgba(148,163,184,0.22);
        box-shadow: 0 24px 80px rgba(0,0,0,0.75);
        overflow: hidden;
      }
      .admin-modal-head{
        padding: 14px 16px;
        border-bottom: 1px solid rgba(148,163,184,0.18);
        display:flex;
        align-items:center;
        gap: 10px;
      }
      .admin-modal-title{
        margin:0;
        font-size: 14px;
        font-weight: 900;
        color: #f9fafb;
        letter-spacing: 0.02em;
      }
      .admin-modal-close{
        margin-left:auto;
        border:none;
        background: rgba(2,6,23,0.35);
        border: 1px solid rgba(148,163,184,0.22);
        color: rgba(226,232,240,0.92);
        width: 34px;
        height: 34px;
        border-radius: 12px;
        cursor:pointer;
      }
      .admin-modal-body{
        padding: 14px 16px 16px;
      }
      .grid{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .full{ grid-column: 1 / -1; }

      .field label{
        display:block;
        font-size: 11px;
        font-weight: 800;
        color: rgba(226,232,240,0.92);
        margin-bottom: 6px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .field input, .field select{
        width: 100%;
        padding: 11px 12px;
        border-radius: 14px;
        border: 1px solid rgba(148,163,184,0.35);
        background: rgba(2,6,23,0.35);
        color: #f9fafb;
        outline:none;
      }

      .row{
        display:flex;
        gap: 10px;
        align-items:center;
        flex-wrap: wrap;
      }

      .check{
        display:flex;
        align-items:center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(148,163,184,0.22);
        background: rgba(2,6,23,0.28);
        color: rgba(226,232,240,0.92);
        font-size: 12px;
      }

      .admin-modal-foot{
        padding: 12px 16px;
        border-top: 1px solid rgba(148,163,184,0.18);
        display:flex;
        gap: 10px;
        justify-content:flex-end;
        background: rgba(2,6,23,0.22);
      }

      .btn-ghost{
        border-radius: 999px;
        padding: 10px 14px;
        border: 1px solid rgba(148,163,184,0.35);
        background: rgba(2,6,23,0.35);
        color: rgba(226,232,240,0.92);
        cursor:pointer;
      }

      .btn-danger{
        border-radius: 999px;
        padding: 10px 14px;
        border: 1px solid rgba(239,68,68,0.55);
        background: rgba(239,68,68,0.12);
        color: #fecaca;
        cursor:pointer;
      }

      @media (max-width: 720px){
        .admin-users-toolbar{
          grid-template-columns: 1fr;
        }
        table.admin-users-table{ min-width: 860px; }
        .grid{ grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  const params = useMemo(() => {
    const p = { page, limit };
    if (q.trim()) p.q = q.trim();
    if (emailVerified !== 'all') p.emailVerified = emailVerified;
    return p;
  }, [q, page, limit, emailVerified]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListUsers(params);
      setData(res.data || { items: [], total: 0, pages: 1 });
    } catch (e) {
      const m = e?.response?.data?.message || e?.message || 'Failed to load users';
      setError(m);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const openCreate = () => {
    setMode('create');
    setActiveUser(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      emailVerified: false,
      monkeyAttempts: 0,
      monkeyLocked: false,
      hasSpun: false,
    });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setMode('edit');
    setActiveUser(u);
    setForm({
      name: u.name || '',
      email: u.email || '', // read-only in UI (still shown)
      phone: u.phone || '',
      password: '', // optional reset
      emailVerified: !!u.emailVerified,
      monkeyAttempts: Number(u.monkeyAttempts || 0),
      monkeyLocked: !!u.monkeyLocked,
      hasSpun: !!u.hasSpun,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      // basic validations
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!form.name || form.name.trim().length < 2) {
        showToast('error', 'Name must be at least 2 characters.');
        setSaving(false);
        return;
      }
      if (mode === 'create') {
        if (!form.email || !emailRegex.test(String(form.email).trim())) {
          showToast('error', 'Enter a valid email.');
          setSaving(false);
          return;
        }
        if (!form.phone || String(form.phone).trim().length < 6) {
          showToast('error', 'Enter a valid phone.');
          setSaving(false);
          return;
        }
        if (!form.password || String(form.password).length < 6) {
          showToast('error', 'Password must be at least 6 characters.');
          setSaving(false);
          return;
        }
      } else {
        // edit: password optional
        if (form.password && String(form.password).length < 6) {
          showToast('error', 'Password must be at least 6 characters.');
          setSaving(false);
          return;
        }
      }

      if (mode === 'create') {
        await adminCreateUser({
          name: form.name.trim(),
          email: String(form.email).trim().toLowerCase(),
          phone: String(form.phone).trim(),
          password: String(form.password),
          emailVerified: !!form.emailVerified,
        });
        showToast('success', 'User created successfully.');
      } else {
        await adminUpdateUser(activeUser._id || activeUser.id, {
          name: form.name.trim(),
          phone: String(form.phone).trim(),
          emailVerified: !!form.emailVerified,
          monkeyAttempts: Number(form.monkeyAttempts || 0),
          monkeyLocked: !!form.monkeyLocked,
          hasSpun: !!form.hasSpun,
          ...(form.password ? { password: String(form.password) } : {}),
        });
        showToast('success', 'User updated successfully.');
      }

      setShowModal(false);
      await load();
    } catch (e) {
      const m = e?.response?.data?.message || e?.message || 'Save failed';
      showToast('error', m);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (u) => {
    const ok = window.confirm(`Delete user: ${u.email} ?`);
    if (!ok) return;

    try {
      await adminDeleteUser(u._id || u.id);
      showToast('success', 'User deleted.');
      await load();
    } catch (e) {
      const m = e?.response?.data?.message || e?.message || 'Delete failed';
      showToast('error', m);
    }
  };

  const resetGame = async (u) => {
    const ok = window.confirm(`Reset game attempts for: ${u.email} ?`);
    if (!ok) return;

    try {
      await adminUpdateUser(u._id || u.id, {
        monkeyAttempts: 0,
        monkeyLocked: false,
        hasSpun: false,
      });
      showToast('success', 'Game attempts reset.');
      await load();
    } catch (e) {
      const m = e?.response?.data?.message || e?.message || 'Reset failed';
      showToast('error', m);
    }
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const items = data?.items || [];
  const total = Number(data?.total || 0);
  const pages = Number(data?.pages || 1);

  return (
    <div className="admin-users-page">
      <div className="admin-users-hero">
        <h1 className="admin-users-title">Admin • Users</h1>
        <p className="admin-users-subtitle">
          Manage customer accounts (CRUD), reset monkey attempts, verify status, and search.
        </p>

        <form className="admin-users-toolbar" onSubmit={onSearchSubmit}>
          <input
            className="admin-users-input"
            placeholder="Search by name / email / phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="admin-users-select"
            value={emailVerified}
            onChange={(e) => {
              setEmailVerified(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>

          <button type="button" className="admin-users-btn" onClick={openCreate}>
            + Create User
          </button>
        </form>
      </div>

      {error && (
        <div style={{ marginBottom: 12, color: '#fecaca', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="admin-users-card">
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Game</th>
                <th>Created</th>
                <th style={{ width: 260 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: 'rgba(148,163,184,0.95)' }}>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: 'rgba(148,163,184,0.95)' }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                items.map((u) => {
                  const verified = !!u.emailVerified;
                  const locked = !!u.monkeyLocked;
                  const spun = !!u.hasSpun;
                  const attempts = Number(u.monkeyAttempts || 0);

                  return (
                    <tr key={u._id || u.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: '#f9fafb' }}>
                          {u.name || '-'}
                        </div>
                        <div style={{ color: 'rgba(148,163,184,0.95)', marginTop: 3 }}>
                          {u.email}
                        </div>
                      </td>

                      <td>
                        <div className="admin-pill">
                          <span className="dot yellow" />
                          <span>{u.phone || '-'}</span>
                        </div>
                      </td>

                      <td>
                        <div className="admin-pill" style={{ marginBottom: 8 }}>
                          <span className={`dot ${verified ? 'green' : 'red'}`} />
                          <span>{verified ? 'Email Verified' : 'Not Verified'}</span>
                        </div>

                        <div className="admin-pill">
                          <span className={`dot ${spun ? 'green' : 'yellow'}`} />
                          <span>{spun ? 'Spun: Yes' : 'Spun: No'}</span>
                        </div>
                      </td>

                      <td>
                        <div className="admin-pill" style={{ marginBottom: 8 }}>
                          <span className={`dot ${locked ? 'red' : 'green'}`} />
                          <span>{locked ? 'Locked' : 'Active'}</span>
                        </div>

                        <div className="admin-pill">
                          <span className="dot yellow" />
                          <span>Attempts: {attempts}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ color: 'rgba(148,163,184,0.95)' }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}
                        </div>
                      </td>

                      <td>
                        <div className="admin-users-actions">
                          <button className="mini-btn" onClick={() => openEdit(u)}>
                            Edit
                          </button>

                          <button className="mini-btn" onClick={() => resetGame(u)}>
                            Reset Game
                          </button>

                          <button className="mini-btn danger" onClick={() => onDelete(u)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-pagination">
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.95)' }}>
            Total: <strong style={{ color: '#f9fafb' }}>{total}</strong>
          </div>

          <div className="pager">
            <button
              className="pager-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>

            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.95)' }}>
              Page <strong style={{ color: '#f9fafb' }}>{page}</strong> / {pages}
            </div>

            <button
              className="pager-btn"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target.classList.contains('admin-modal-backdrop')) closeModal();
          }}
        >
          <div className="admin-modal">
            <div className="admin-modal-head">
              <h3 className="admin-modal-title">
                {mode === 'create' ? 'Create User' : 'Edit User'}
              </h3>

              <button className="admin-modal-close" onClick={closeModal} title="Close">
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="grid">
                <div className="field">
                  <label>Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Full Name"
                  />
                </div>

                <div className="field">
                  <label>Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+974 12345678"
                    disabled={mode === 'edit' ? false : false}
                  />
                </div>

                <div className="field full">
                  <label>Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@email.com"
                    disabled={mode === 'edit'} // email usually should not be changed
                  />
                </div>

                <div className="field full">
                  <label>
                    {mode === 'create' ? 'Password' : 'Password (optional reset)'}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder={mode === 'create' ? 'Set password' : 'Leave blank to keep'}
                  />
                </div>

                <div className="row full">
                  <div className="check">
                    <input
                      type="checkbox"
                      checked={!!form.emailVerified}
                      onChange={(e) => setForm((p) => ({ ...p, emailVerified: e.target.checked }))}
                    />
                    <span>Email Verified</span>
                  </div>

                  {mode === 'edit' && (
                    <>
                      <div className="check">
                        <input
                          type="checkbox"
                          checked={!!form.monkeyLocked}
                          onChange={(e) => setForm((p) => ({ ...p, monkeyLocked: e.target.checked }))}
                        />
                        <span>Monkey Locked</span>
                      </div>

                      <div className="check">
                        <input
                          type="checkbox"
                          checked={!!form.hasSpun}
                          onChange={(e) => setForm((p) => ({ ...p, hasSpun: e.target.checked }))}
                        />
                        <span>Has Spun</span>
                      </div>
                    </>
                  )}
                </div>

                {mode === 'edit' && (
                  <div className="field full">
                    <label>Monkey Attempts</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={form.monkeyAttempts}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          monkeyAttempts: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {mode === 'edit' && activeUser?.email && (
                <div style={{ marginTop: 12, color: 'rgba(148,163,184,0.95)', fontSize: 12 }}>
                  Editing: <strong style={{ color: '#f9fafb' }}>{activeUser.email}</strong>
                </div>
              )}
            </div>

            <div className="admin-modal-foot">
              <button className="btn-ghost" onClick={closeModal} disabled={saving}>
                Cancel
              </button>

              {mode === 'edit' && (
                <button
                  className="btn-danger"
                  onClick={() => {
                    closeModal();
                    onDelete(activeUser);
                  }}
                  disabled={saving}
                >
                  Delete
                </button>
              )}

              <button className="admin-users-btn" onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <div style={{ marginTop: 2 }}>
            <strong>{toast.type === 'success' ? 'Success' : 'Error'}</strong>
            <p>{toast.text}</p>
          </div>
          <button className="toast-x" onClick={() => setToast(null)} title="Close">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
