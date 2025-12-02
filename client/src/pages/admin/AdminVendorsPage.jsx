// client/src/pages/admin/AdminVendorsPage.jsx
import React, { useEffect, useState } from 'react';
import { createVendor, getVendors, updateVendor } from '../../api/adminApi';
const initialForm = { name: '', email: '', password: '' };

const AdminVendorsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState('create'); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);

  // Inject page-specific styles once
  useEffect(() => {
    if (document.getElementById('admin-vendors-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'admin-vendors-styles';
    styleEl.textContent = `
      .admin-vendors-page {
        padding-top: 8px;
        padding-bottom: 24px;
      }

      .admin-vendors-card {
        background: radial-gradient(circle at top left, rgba(31, 41, 55, 0.98), rgba(15, 23, 42, 0.98));
        border-radius: 24px;
        padding: 24px 20px 20px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        box-shadow:
          0 26px 60px rgba(0, 0, 0, 0.85),
          0 0 0 1px rgba(248, 113, 113, 0.15);
        backdrop-filter: blur(20px);
        color: #e5e7eb;
        animation: avFadeInUp 0.55s ease-out;
      }

      .admin-vendors-header {
        margin-bottom: 18px;
      }

      .admin-vendors-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(248, 113, 113, 0.8);
        background: rgba(24, 24, 27, 0.9);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #fecaca;
        margin-bottom: 10px;
      }

      .admin-vendors-pill-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
      }

      .admin-vendors-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #f9fafb;
      }

      .admin-vendors-subtitle {
        margin: 0;
        font-size: 13px;
        color: rgba(148, 163, 184, 0.94);
      }

      .admin-vendors-mode-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        margin-bottom: 6px;
      }

      .admin-vendors-mode-badge--edit {
        background: rgba(30, 64, 175, 0.3);
        border: 1px solid rgba(129, 140, 248, 0.8);
        color: #bfdbfe;
      }

      .admin-vendors-mode-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #38bdf8;
      }

      .admin-vendors-alert {
        border-radius: 14px;
        padding: 10px 11px;
        font-size: 13px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 12px;
      }

      .admin-vendors-alert--success {
        background: rgba(22, 163, 74, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.45);
        color: #4ade80;
      }

      .admin-vendors-alert--error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fb7185;
      }

      .admin-vendors-alert-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .admin-vendors-section-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(209, 213, 219, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        margin-bottom: 6px;
      }

      .admin-vendors-form {
        margin-bottom: 18px;
        padding: 12px 10px 12px;
        border-radius: 16px;
        background: radial-gradient(circle at top left, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.96));
        border: 1px dashed rgba(148, 163, 184, 0.6);
      }

      .admin-vendors-form-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 10px;
      }

      .admin-vendors-form-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 4px;
      }

      .admin-vendors-form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .admin-vendors-label {
        font-size: 11px;
        font-weight: 600;
        color: rgba(226, 232, 240, 0.92);
      }

      .admin-vendors-label-hint {
        font-size: 10px;
        color: rgba(148, 163, 184, 0.85);
        font-weight: 400;
      }

      .admin-vendors-input-wrap {
        position: relative;
      }

      .admin-vendors-input {
        width: 100%;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.7);
        background: rgba(15, 23, 42, 0.96);
        color: #f9fafb;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.12s ease;
      }

      .admin-vendors-input::placeholder {
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-vendors-input:focus {
        border-color: rgba(248, 113, 113, 0.95);
        box-shadow:
          0 0 0 1px rgba(248, 113, 113, 0.9),
          0 0 0 5px rgba(248, 113, 113, 0.22);
        background: rgba(15, 23, 42, 1);
        transform: translateY(-1px);
      }

      .admin-vendors-button-primary {
        padding: 9px 16px;
        border-radius: 999px;
        border: none;
        outline: none;
        background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
        color: #fef2f2;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        box-shadow:
          0 14px 30px rgba(248, 113, 113, 0.55),
          0 0 0 1px rgba(248, 113, 113, 0.45);
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
      }

      .admin-vendors-button-primary:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.01);
        box-shadow:
          0 18px 38px rgba(248, 113, 113, 0.65),
          0 0 0 1px rgba(248, 113, 113, 0.6);
        filter: brightness(1.02);
      }

      .admin-vendors-button-primary:active:not(:disabled) {
        transform: translateY(0) scale(0.99);
        box-shadow: 0 10px 24px rgba(248, 113, 113, 0.5);
      }

      .admin-vendors-button-primary:disabled {
        cursor: not-allowed;
        opacity: 0.9;
        box-shadow: 0 10px 24px rgba(148, 163, 184, 0.5);
        filter: grayscale(0.1);
      }

      .admin-vendors-button-secondary {
        padding: 9px 14px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.85);
        background: rgba(15, 23, 42, 0.96);
        color: rgba(209, 213, 219, 0.95);
        font-size: 12px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        transition: background 0.16s ease, color 0.16s ease, transform 0.12s ease, box-shadow 0.16s ease;
      }

      .admin-vendors-button-secondary:hover {
        background: rgba(31, 41, 55, 1);
        color: #e5e7eb;
        transform: translateY(-1px);
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.7);
      }

      .admin-vendors-button-secondary:active {
        transform: translateY(0);
        box-shadow: 0 7px 18px rgba(15, 23, 42, 0.7);
      }

      .admin-vendors-spinner {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        animation: avSpin 0.65s linear infinite;
      }

      .admin-vendors-table-wrap {
        margin-top: 10px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(55, 65, 81, 0.9);
        background: radial-gradient(circle at top left, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.98));
      }

      .admin-vendors-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .admin-vendors-table thead {
        background: linear-gradient(to right, rgba(31, 41, 55, 0.98), rgba(15, 23, 42, 0.98));
      }

      .admin-vendors-table th,
      .admin-vendors-table td {
        padding: 8px 10px;
        text-align: left;
        border-bottom: 1px solid rgba(30, 64, 175, 0.6);
        color: #e5e7eb;
      }

      .admin-vendors-table th {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(191, 219, 254, 0.9);
      }

      .admin-vendors-table tbody tr {
        transition: background 0.16s ease, transform 0.12s ease;
      }

      .admin-vendors-table tbody tr:nth-child(even) {
        background: rgba(15, 23, 42, 0.9);
      }

      .admin-vendors-table tbody tr:nth-child(odd) {
        background: rgba(15, 23, 42, 0.95);
      }

      .admin-vendors-table tbody tr:hover {
        background: rgba(30, 64, 175, 0.6);
        transform: translateY(-1px);
      }

      .admin-vendors-table-empty {
        text-align: center;
        padding: 14px 10px;
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-vendors-table-loading {
        text-align: center;
        padding: 14px 10px;
        color: rgba(191, 219, 254, 0.95);
      }

      .admin-vendors-row-actions {
        text-align: right;
        white-space: nowrap;
      }

      .admin-vendors-row-edit {
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid rgba(129, 140, 248, 0.9);
        background: rgba(30, 64, 175, 0.6);
        color: #e0f2fe;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.16s ease, transform 0.12s ease, box-shadow 0.16s ease;
      }

      .admin-vendors-row-edit:hover {
        background: rgba(59, 130, 246, 0.9);
        box-shadow: 0 10px 22px rgba(37, 99, 235, 0.6);
        transform: translateY(-1px);
      }

      .admin-vendors-row-edit:active {
        transform: translateY(0);
        box-shadow: 0 7px 18px rgba(37, 99, 235, 0.6);
      }

      @keyframes avSpin {
        to { transform: rotate(360deg); }
      }

      @keyframes avFadeInUp {
        from {
          opacity: 0;
          transform: translate3d(0, 16px, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @media (max-width: 768px) {
        .admin-vendors-card {
          padding: 20px 14px 16px;
          border-radius: 20px;
        }
        .admin-vendors-form-row {
          grid-template-columns: 1fr;
        }
        .admin-vendors-row-actions {
          text-align: left;
        }
      }

      @media (max-width: 480px) {
        .admin-vendors-title {
          font-size: 18px;
        }
        .admin-vendors-table th,
        .admin-vendors-table td {
          padding: 8px 8px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  const loadVendors = async () => {
    setError(null);
    setLoadingList(true);
    try {
      const res = await getVendors();
      setVendors(res.data || []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load vendors';
      setError(msg);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetFormToCreate = () => {
    setForm(initialForm);
    setMode('create');
    setEditingId(null);
  };

  const handleEditClick = (vendor) => {
    setError(null);
    setMsg(null);
    setMode('edit');
    setEditingId(vendor._id);
    setForm({
      name: vendor.name || '',
      email: vendor.email || '',
      password: '',
    });
  };

  const handleCancelEdit = () => {
    resetFormToCreate();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setMsg(null);
    setSubmitting(true);

    try {
      const basePayload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      if (!basePayload.name || !basePayload.email) {
        setError('Please fill in name and email.');
        setSubmitting(false);
        return;
      }

      if (mode === 'create') {
        if (!basePayload.password) {
          setError('Please set a password for the new vendor.');
          setSubmitting(false);
          return;
        }

        await createVendor(basePayload);
        setMsg('Vendor created successfully.');
        resetFormToCreate();
        await loadVendors();
      } else {
        if (!editingId) {
          throw new Error('No vendor selected for editing.');
        }

        // For edit, password is optional – only send if filled
        const updatePayload = {
          name: basePayload.name,
          email: basePayload.email,
        };
        if (basePayload.password) {
          updatePayload.password = basePayload.password;
        }

        await updateVendor(editingId, updatePayload);
        setMsg('Vendor updated successfully.');
        resetFormToCreate();
        await loadVendors();
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        (mode === 'create'
          ? 'Failed to create vendor'
          : 'Failed to update vendor');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-vendors-page">
      <div className="admin-vendors-card">
        <div className="admin-vendors-header">
          <div className="admin-vendors-pill">
            <span className="admin-vendors-pill-dot" />
            <span>Vendor Management</span>
          </div>
          <h3 className="admin-vendors-title">Vendors</h3>
          <p className="admin-vendors-subtitle">
            Create vendor logins and update existing vendor accounts.
          </p>
        </div>

        {msg && (
          <div className="admin-vendors-alert admin-vendors-alert--success">
            <svg
              className="admin-vendors-alert-icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span>{msg}</span>
          </div>
        )}

        {error && (
          <div className="admin-vendors-alert admin-vendors-alert--error">
            <svg
              className="admin-vendors-alert-icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="admin-vendors-section-title">
          {mode === 'create' ? 'Create Vendor' : 'Edit Vendor'}
        </div>

        {mode === 'edit' && (
          <div className="admin-vendors-mode-badge admin-vendors-mode-badge--edit">
            <span className="admin-vendors-mode-dot" />
            <span>
              Editing vendor{' '}
              {vendors.find((v) => v._id === editingId)?.name || ''}
            </span>
          </div>
        )}

        <form className="admin-vendors-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-vendors-form-row">
            <div className="admin-vendors-form-group">
              <label htmlFor="vendorName" className="admin-vendors-label">
                Name
              </label>
              <div className="admin-vendors-input-wrap">
                <input
                  id="vendorName"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Vendor name"
                  className="admin-vendors-input"
                />
              </div>
            </div>

            <div className="admin-vendors-form-group">
              <label htmlFor="vendorEmail" className="admin-vendors-label">
                Email
              </label>
              <div className="admin-vendors-input-wrap">
                <input
                  id="vendorEmail"
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="vendor@example.com"
                  className="admin-vendors-input"
                />
              </div>
            </div>

            <div className="admin-vendors-form-group">
              <label htmlFor="vendorPassword" className="admin-vendors-label">
                Password{' '}
                <span className="admin-vendors-label-hint">
                  {mode === 'create'
                    ? '(required)'
                    : '(optional – fill to reset)'}
                </span>
              </label>
              <div className="admin-vendors-input-wrap">
                <input
                  id="vendorPassword"
                  name="password"
                  type="password"
                  autoComplete={mode === 'create' ? 'new-password' : 'off'}
                  value={form.password}
                  onChange={handleChange}
                  required={mode === 'create'}
                  placeholder={
                    mode === 'create'
                      ? 'Set initial password'
                      : 'Leave blank to keep current password'
                  }
                  className="admin-vendors-input"
                />
              </div>
            </div>
          </div>

          <div className="admin-vendors-form-actions">
            <button
              type="submit"
              className="admin-vendors-button-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="admin-vendors-spinner" />
                  <span>
                    {mode === 'create' ? 'Creating…' : 'Updating…'}
                  </span>
                </>
              ) : (
                <>
                  <span>{mode === 'create' ? 'Create Vendor' : 'Save Changes'}</span>
                </>
              )}
            </button>

            {mode === 'edit' && (
              <button
                type="button"
                className="admin-vendors-button-secondary"
                onClick={handleCancelEdit}
                disabled={submitting}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        {/* Vendors Table */}
        <div className="admin-vendors-section-title">Vendor List</div>
        <div className="admin-vendors-table-wrap">
          <table className="admin-vendors-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={4} className="admin-vendors-table-loading">
                    <span className="admin-vendors-spinner" /> Loading vendors…
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-vendors-table-empty">
                    No vendors found.
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v._id}>
                    <td>{v.name}</td>
                    <td>{v.email}</td>
                    <td>
                      {v.createdAt
                        ? new Date(v.createdAt).toLocaleString()
                        : '-'}
                    </td>
                    <td className="admin-vendors-row-actions">
                      <button
                        type="button"
                        className="admin-vendors-row-edit"
                        onClick={() => handleEditClick(v)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminVendorsPage;
