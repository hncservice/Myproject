import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} from '../api/adminApi';

function accountStatus(user) {
  if (user.isActive === false) return { label: 'Disabled', tone: 'inactive' };
  if (user.isActive === true) return { label: 'Active', tone: 'positive' };
  return { label: 'Status unavailable', tone: 'neutral' };
}

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
const [archivingId, setArchivingId] = useState(null);
const [refresh, setRefresh] = useState(0);
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
  const listRequest = useRef(0);
  const dialog = useRef(null);
  useEffect(() => {
    if (!showModal) return;
    const previous = document.activeElement;
    dialog.current?.querySelector('input:not(:disabled)')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [showModal]);

  const params = useMemo(() => {
    const p = { page, limit };
    if (q.trim()) p.q = q.trim();
    if (emailVerified !== 'all') p.emailVerified = emailVerified;
    return p;
  }, [q, page, limit, emailVerified]);

  const load = async () => {
    const request = ++listRequest.current;
    setLoading(true);
    setError(null);
    try {
      const res = await adminListUsers(params);
      if (request !== listRequest.current) return;
      setData(res.data || { items: [], total: 0, pages: 1 });
    } catch (e) {
      if (request !== listRequest.current) return;
      const m = e?.response?.data?.message || e?.message || 'Failed to load users';
      setError(m);
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => { listRequest.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, refresh]);

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
          emailVerified: false,
        });
        showToast('success', 'User created successfully.');
      } else {
        await adminUpdateUser(activeUser._id || activeUser.id, {
          name: form.name.trim(),
          phone: String(form.phone).trim(),
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
const onArchive = async (user) => {
  const id = user._id || user.id;
  if (!id || archivingId || user.isActive === false) return;

  const confirmed = window.confirm(
    `Archive ${user.email}? This will disable customer access and keep their history.`
  );
  if (!confirmed) return;

  setArchivingId(id);
  try {
    await adminDeleteUser(id);
    showToast('success', 'Customer archived.');
    setRefresh((current) => current + 1);
  } catch (error) {
    showToast(
      'error',
      error?.response?.data?.message || 'Could not archive the customer.'
    );
  } finally {
    setArchivingId(null);
  }
};
  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setRefresh(current => current + 1);
  };

  const items = data?.items || [];
  const total = Number(data?.total || 0);
  const pages = Number(data?.pages || 1);

  return (
    <div className="admin-users-page">
      <style>{pageStyles}</style>
      <div className="admin-users-hero">
        <h1 className="admin-users-title">Users</h1>
        <p className="admin-users-subtitle">
          Search customer accounts, check email verification, and manage game access.
        </p>

        <form className="admin-users-toolbar" onSubmit={onSearchSubmit}>
          <label>
            Search customers
            <input
              className="admin-users-input"
              type="search"
              maxLength={100}
              placeholder="Search by name / email / phone..."
              value={q}
              onChange={event => { setQ(event.target.value); setPage(1); }}
            />
          </label>

          <label>
            Email verification
            <select
              className="admin-users-select"
              value={emailVerified}
              onChange={event => {
                setEmailVerified(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </label>

          <button type="button" className="admin-users-btn" onClick={openCreate}>
            + Create User
          </button>
        </form>
      </div>

      {error && (
        <div className="admin-users-list-error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-users-card">
        <div className="admin-users-table-wrap">
          <table className="admin-users-table" role="table" aria-label="Customer accounts" aria-busy={loading}>
            <thead role="rowgroup">
              <tr role="row">
                {['User', 'Contact', 'Account', 'Email verification', 'Game', 'Created', 'Actions'].map(label => (
                  <th key={label} role="columnheader" scope="col">{label}</th>
                ))}
              </tr>
            </thead>

            <tbody role="rowgroup">
              {loading || error || items.length === 0 ? (
                <tr role="row">
                  <td role="cell" colSpan={7} className="admin-users-table-message">
                    {loading ? <span role="status">Loading…</span> : error ? 'Customer list unavailable.' : 'No users found.'}
                  </td>
                </tr>
              ) : items.map(user => {
                const id = user._id || user.id;
                const account = accountStatus(user);
                const verified = Boolean(user.emailVerified);
                const date = user.createdAt ? new Date(user.createdAt) : null;

                return (
                  <tr key={id} role="row">
                    <td role="cell">
                      <span className="admin-users-mobile-label" aria-hidden="true">User</span>
                      <div><strong>{user.name || '—'}</strong><div className="admin-users-muted">{user.email}</div></div>
                    </td>
                    <td role="cell">
                      <span className="admin-users-mobile-label" aria-hidden="true">Contact</span>
                      <span>{user.phone || '—'}</span>
                    </td>
                    <td role="cell">
                      <span className="admin-users-mobile-label" aria-hidden="true">Account</span>
                      <span className="admin-users-status-label" data-tone={account.tone}>{account.label}</span>
                    </td>
                    <td role="cell">
                      <span className="admin-users-mobile-label" aria-hidden="true">Email</span>
                      <span className="admin-users-status-label" data-tone={verified ? 'positive' : 'neutral'}>
                        {verified ? 'Email Verified' : 'Not Verified'}
                      </span>
                    </td>
                    <td role="cell">
                      <span className="admin-users-mobile-label" aria-hidden="true">Game</span>
                      <div className="admin-users-status">
                        <span>{user.monkeyLocked ? 'Monkey locked' : 'Monkey unlocked'}</span>
                        <span>Attempts: {Number(user.monkeyAttempts || 0)}</span>
                        <span>{user.hasSpun ? 'Spun: Yes' : 'Spun: No'}</span>
                      </div>
                    </td>
                    <td role="cell">
                      <span className="admin-users-mobile-label" aria-hidden="true">Created</span>
                      {date && Number.isFinite(date.getTime())
                        ? <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>
                        : <span>—</span>}
                    </td>
                    <td role="cell">
                      <span className="admin-users-mobile-label" aria-hidden="true">Actions</span>
                      <div className="admin-users-actions">
                        <button type="button" className="mini-btn" onClick={() => openEdit(user)}>Edit</button>
                        {user.isActive !== false && (
                          <button type="button" className="mini-btn" disabled={Boolean(archivingId)}
                            onClick={() => void onArchive(user)}>
                            {archivingId === id ? 'Archiving…' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
          <div className="admin-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title" onKeyDown={e => {
            if (e.key === 'Escape' && !saving) { e.preventDefault(); closeModal(); }
            if (e.key === 'Tab') {
              const items = [...dialog.current.querySelectorAll('*')].filter(node => ['BUTTON', 'INPUT'].includes(node.tagName) && !node.disabled);
              const first = items[0], last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
              if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
          }}>
            <div className="admin-modal-head">
              <h3 className="admin-modal-title" id="admin-user-dialog-title">
                {mode === 'create' ? 'Create User' : 'Edit User'}
              </h3>

              <button className="admin-modal-close" onClick={closeModal} title="Close">
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="grid">
                <div className="field">
                  <label htmlFor="admin-user-name">Name</label>
                  <input
                    id="admin-user-name" value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Full Name"
                  />
                </div>

                <div className="field">
                  <label htmlFor="admin-user-phone">Phone</label>
                  <input
                    id="admin-user-phone" value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+974 12345678"
                    disabled={mode === 'edit' ? false : false}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="admin-user-email">Email</label>
                  <input
                    id="admin-user-email" value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@email.com"
                    disabled={mode === 'edit'} // email usually should not be changed
                  />
                </div>

                <div className="field full">
                  <label htmlFor="admin-user-password">
                    {mode === 'create' ? 'Password' : 'Password (customer recovery only)'}
                  </label>
                  <input
                    id="admin-user-password" type="password" disabled={mode === 'edit'}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder={mode === 'create' ? 'Set password' : 'Leave blank to keep'}
                  />
                </div>

                <div className="row full">
                  <div className="check">
                    <input
                      type="checkbox" disabled aria-label="Email Verified"
                      checked={!!form.emailVerified}
                      onChange={(e) => setForm((p) => ({ ...p, emailVerified: e.target.checked }))}
                    />
                    <span>Email Verified</span>
                  </div>

                  {mode === 'edit' && (
                    <>
                      <div className="check">
                        <input
                          type="checkbox" disabled aria-label="Monkey Locked"
                          checked={!!form.monkeyLocked}
                          onChange={(e) => setForm((p) => ({ ...p, monkeyLocked: e.target.checked }))}
                        />
                        <span>Monkey Locked</span>
                      </div>

                      <div className="check">
                        <input
                          type="checkbox" disabled aria-label="Has Spun"
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
                    <label htmlFor="admin-user-monkeyAttempts">Monkey Attempts</label>
                    <input
                      type="number" disabled
                      min="0"
                      max="99"
                      id="admin-user-monkeyAttempts" value={form.monkeyAttempts}
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

              <button className="admin-users-btn" onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
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

const pageStyles = `
  .admin-users-page{
    --hnc-red:#dc2626;
    --hnc-red-dark:#991b1b;
    --hnc-bg:#020617;
  }

  .admin-users-page{
    padding: 6px 0 28px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  }

  .admin-users-page .admin-users-hero{
    border-radius: 22px;
    padding: 18px 16px;
    background: linear-gradient(145deg, rgba(15,23,42,0.94), rgba(15,23,42,0.98));
    border: 1px solid rgba(148,163,184,0.25);
    box-shadow: 0 18px 55px rgba(0,0,0,0.55);
    margin-bottom: 14px;
  }

  .admin-users-page .admin-users-title{
    margin: 0 0 4px;
    color: #f9fafb;
    font-weight: 800;
    letter-spacing: 0.02em;
    font-size: 18px;
  }

  .admin-users-page .admin-users-subtitle{
    margin: 0;
    color: rgba(148,163,184,0.95);
    font-size: 12px;
  }

  .admin-users-page .admin-users-toolbar{
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 160px 160px;
    gap: 10px;
    align-items: center;
  }

  .admin-users-page .admin-users-input{
    width: 100%;
    padding: 11px 14px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.55);
    background: rgba(2,6,23,0.55);
    color: #f9fafb;
    outline: none;
    transition: border-color .15s ease, box-shadow .15s ease, transform .12s ease;
  }
  .admin-users-page .admin-users-input:focus{
    border-color: rgba(248,113,113,0.95);
    box-shadow: 0 0 0 6px rgba(248,113,113,0.18);
    transform: translateY(-1px);
  }

  .admin-users-page .admin-users-select{
    width: 100%;
    padding: 11px 14px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.55);
    background: rgba(2,6,23,0.55);
    color: #f9fafb;
    outline: none;
  }

  .admin-users-page .admin-users-btn{
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
  .admin-users-page .admin-users-btn:hover{
    transform: translateY(-1px);
    box-shadow: 0 18px 45px rgba(248,113,113,0.42);
    filter: brightness(1.03);
  }
  .admin-users-page .admin-users-btn:disabled{
    opacity: 0.7;
    cursor: not-allowed;
    box-shadow: none;
  }

  .admin-users-page .admin-users-card{
    border-radius: 22px;
    background: rgba(15,23,42,0.92);
    border: 1px solid rgba(148,163,184,0.22);
    box-shadow: 0 18px 55px rgba(0,0,0,0.55);
    overflow: hidden;
  }

  .admin-users-page .admin-users-table-wrap{
    width: 100%;
    overflow-x: auto;
  }

  .admin-users-page table.admin-users-table{
    width: 100%;
    border-collapse: collapse;
    min-width: 980px;
  }

  .admin-users-page .admin-users-table th, .admin-users-page .admin-users-table td{
    padding: 12px 12px;
    border-bottom: 1px solid rgba(148,163,184,0.18);
    color: rgba(226,232,240,0.92);
    font-size: 12px;
    text-align: left;
    vertical-align: top;
  }

  .admin-users-page .admin-users-table th{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(148,163,184,0.92);
    background: rgba(2,6,23,0.35);
    position: sticky;
    top: 0;
    z-index: 2;
  }


  .admin-users-page .admin-users-actions{
    display:flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .admin-users-page .mini-btn{
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.35);
    background: rgba(2,6,23,0.35);
    color: rgba(226,232,240,0.92);
    padding: 6px 10px;
    font-size: 11px;
    cursor: pointer;
    transition: transform .12s ease, border-color .15s ease, background .15s ease;
  }
  .admin-users-page .mini-btn:hover{
    transform: translateY(-1px);
    border-color: rgba(248,113,113,0.55);
    background: rgba(248,113,113,0.08);
  }

  .admin-users-page .admin-pagination{
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(2,6,23,0.25);
  }

  .admin-users-page .pager{
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap: wrap;
  }

  .admin-users-page .pager-btn{
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.35);
    background: rgba(2,6,23,0.35);
    color: rgba(226,232,240,0.92);
    font-size: 11px;
    cursor: pointer;
  }
  .admin-users-page .pager-btn:disabled{
    opacity:0.55;
    cursor:not-allowed;
  }

  /* Toast */
  .admin-users-page .admin-toast{
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
  .admin-users-page .admin-toast.success{ border-color: rgba(34,197,94,0.35); }
  .admin-users-page .admin-toast.error{ border-color: rgba(239,68,68,0.35); }
  .admin-users-page .admin-toast strong{ display:block; font-size: 12px; color:#f9fafb; margin-bottom: 2px; }
  .admin-users-page .admin-toast p{ margin:0; font-size: 12px; color: rgba(148,163,184,0.95); }
  .admin-users-page .toast-x{
    margin-left:auto;
    background: transparent;
    border:none;
    cursor:pointer;
    color: rgba(148,163,184,0.95);
    font-size: 16px;
    line-height: 1;
  }

  /* Modal */
  .admin-users-page .admin-modal-backdrop{
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
  .admin-users-page .admin-modal{
    width: 100%;
    max-width: 560px;
    border-radius: 22px;
    background: linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98));
    border: 1px solid rgba(148,163,184,0.22);
    box-shadow: 0 24px 80px rgba(0,0,0,0.75);
    overflow: hidden;
  }
  .admin-users-page .admin-modal-head{
    padding: 14px 16px;
    border-bottom: 1px solid rgba(148,163,184,0.18);
    display:flex;
    align-items:center;
    gap: 10px;
  }
  .admin-users-page .admin-modal-title{
    margin:0;
    font-size: 14px;
    font-weight: 900;
    color: #f9fafb;
    letter-spacing: 0.02em;
  }
  .admin-users-page .admin-modal-close{
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
  .admin-users-page .admin-modal-body{
    padding: 14px 16px 16px;
  }
  .admin-users-page .grid{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .admin-users-page .full{ grid-column: 1 / -1; }

  .admin-users-page .field label{
    display:block;
    font-size: 11px;
    font-weight: 800;
    color: rgba(226,232,240,0.92);
    margin-bottom: 6px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .admin-users-page .field input, .admin-users-page .field select{
    width: 100%;
    padding: 11px 12px;
    border-radius: 14px;
    border: 1px solid rgba(148,163,184,0.35);
    background: rgba(2,6,23,0.35);
    color: #f9fafb;
    outline:none;
  }

  .admin-users-page .row{
    display:flex;
    gap: 10px;
    align-items:center;
    flex-wrap: wrap;
  }

  .admin-users-page .check{
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

  .admin-users-page .admin-modal-foot{
    padding: 12px 16px;
    border-top: 1px solid rgba(148,163,184,0.18);
    display:flex;
    gap: 10px;
    justify-content:flex-end;
    background: rgba(2,6,23,0.22);
  }

  .admin-users-page .btn-ghost{
    border-radius: 999px;
    padding: 10px 14px;
    border: 1px solid rgba(148,163,184,0.35);
    background: rgba(2,6,23,0.35);
    color: rgba(226,232,240,0.92);
    cursor:pointer;
  }

  @media (max-width: 720px){
    .admin-users-page .admin-users-toolbar{
      grid-template-columns: 1fr;
    }
    .admin-users-page table.admin-users-table{ min-width: 0; }
    .admin-users-page .grid{ grid-template-columns: 1fr; }
  }

  .admin-users-page {
    --users-border: #75404e;
    --users-muted: #dcc8d0;
    width: min(100%, 1260px);
    margin-inline: auto;
    color: #fff7f6;
    overflow-wrap: anywhere;
  }
  .admin-users-page :is(.admin-users-hero, .admin-users-card, .admin-modal) {
    border-color: var(--users-border);
    background: #23131d;
    box-shadow: none;
  }
  .admin-users-page .admin-users-title { font-size: clamp(26px, 4vw, 40px); }
  .admin-users-page .admin-users-toolbar {
    grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr) auto;
    align-items: end;
  }
  .admin-users-page .admin-users-toolbar label {
    display: grid;
    gap: 6px;
    min-width: 0;
    font-size: 14px;
    font-weight: 650;
  }
  .admin-users-page :is(.admin-users-input, .admin-users-select, .field input, .field select) {
    min-height: 44px;
    min-width: 0;
    width: 100%;
    border-color: #a47082;
    background: #39202e;
    color: #fff7f6;
    font-size: 16px;
  }
  .admin-users-page :is(button, .check) { min-height: 44px; }
  .admin-users-page :is(button, input, select):focus-visible { outline: 2px solid #ffc5cb; outline-offset: 2px; }
  .admin-users-page .admin-users-table {
    min-width: 0;
    color: #fff7f6;
  }
  .admin-users-page .admin-users-table th { background: #39202e; color: #f5d9e2; }
  .admin-users-page .admin-users-table td { border-color: #593240; }
  .admin-users-page .admin-users-muted { color: var(--users-muted); }
  .admin-users-page .admin-users-status { display: flex; flex-wrap: wrap; gap: 5px; }
  .admin-users-page .admin-users-status-label {
    width: fit-content;
    padding: 3px 8px;
    border: 1px solid #a47082;
    border-radius: 999px;
    color: #f5dce6;
    background: #39202e;
    font-size: 12px;
    font-weight: 700;
  }
  .admin-users-page .admin-users-status-label[data-tone='positive'] {
    border-color: #559775;
    background: #17372b;
    color: #cff5df;
  }
  .admin-users-page .admin-users-status-label[data-tone='inactive'] {
    border-color: #c76b7e;
    background: #481825;
    color: #ffe1e5;
  }
  .admin-users-page .admin-users-mobile-label { display: none; }
  .admin-users-page .admin-users-list-error {
    padding: 10px 12px;
    border-radius: 8px;
    background: #481825;
    color: #ffe1e5;
  }
  .admin-users-page .admin-modal {
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
  }

  @media (max-width: 760px) {
    .admin-users-page .admin-users-toolbar { grid-template-columns: minmax(0, 1fr); }
    .admin-users-page .admin-users-table-wrap { overflow: visible; }
    .admin-users-page .admin-users-table,
    .admin-users-page .admin-users-table tbody { display: block; width: 100%; min-width: 0; }
    .admin-users-page .admin-users-table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .admin-users-page .admin-users-table tbody tr {
      display: grid;
      gap: 8px;
      margin: 0 0 8px;
      padding: 12px;
      border: 1px solid var(--users-border);
      border-radius: 10px;
      background: #301b28;
    }
    .admin-users-page .admin-users-table td {
      display: grid;
      grid-template-columns: minmax(0, 5.1rem) minmax(0, 1fr);
      gap: 8px;
      min-width: 0;
      padding: 0;
      border: 0;
    }
    .admin-users-page .admin-users-table td.admin-users-table-message { display: block; }
    .admin-users-page .admin-users-mobile-label {
      display: block;
      color: var(--users-muted);
      font-size: 12px;
      font-weight: 650;
    }
    .admin-users-page .admin-users-actions { justify-content: flex-start; }
    .admin-users-page :is(.admin-pagination, .pager, .admin-modal-foot) { flex-wrap: wrap; }
  }
`;

export default AdminUsersPage;
