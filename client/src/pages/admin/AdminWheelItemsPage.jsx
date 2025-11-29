// client/src/pages/admin/AdminWheelItemsPage.jsx
import React, { useEffect, useState } from 'react';
import {
  getWheelItems,
  createWheelItem,
  updateWheelItem,
  deleteWheelItem,
} from '../../api/adminApi';

const emptyForm = {
  title: '',
  description: '',
  imageUrl: '',
  probabilityWeight: 1,
  quantityTotal: '',
};

const AdminWheelItemsPage = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Inject page-specific styles once
  useEffect(() => {
    if (document.getElementById('admin-wheelitems-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'admin-wheelitems-styles';
    styleEl.textContent = `
      .admin-wheel-page {
        padding-top: 8px;
        padding-bottom: 24px;
      }

      .admin-wheel-card {
        background: radial-gradient(circle at top left, rgba(31, 41, 55, 0.98), rgba(15, 23, 42, 0.98));
        border-radius: 24px;
        padding: 24px 20px 20px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        box-shadow:
          0 26px 60px rgba(0, 0, 0, 0.85),
          0 0 0 1px rgba(248, 113, 113, 0.15);
        backdrop-filter: blur(20px);
        color: #e5e7eb;
        animation: awFadeInUp 0.55s ease-out;
      }

      .admin-wheel-header {
        margin-bottom: 18px;
      }

      .admin-wheel-pill {
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

      .admin-wheel-pill-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
      }

      .admin-wheel-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #f9fafb;
      }

      .admin-wheel-subtitle {
        margin: 0;
        font-size: 13px;
        color: rgba(148, 163, 184, 0.94);
      }

      .admin-wheel-mode-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        margin-bottom: 6px;
      }

      .admin-wheel-mode-badge--edit {
        background: rgba(30, 64, 175, 0.3);
        border: 1px solid rgba(129, 140, 248, 0.8);
        color: #bfdbfe;
      }

      .admin-wheel-mode-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #38bdf8;
      }

      .admin-wheel-alert {
        border-radius: 14px;
        padding: 10px 11px;
        font-size: 13px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 12px;
      }

      .admin-wheel-alert--success {
        background: rgba(22, 163, 74, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.45);
        color: #4ade80;
      }

      .admin-wheel-alert--error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fb7185;
      }

      .admin-wheel-alert-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .admin-wheel-section-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(209, 213, 219, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        margin-bottom: 6px;
      }

      .admin-wheel-form {
        margin-bottom: 18px;
        padding: 12px 10px 12px;
        border-radius: 16px;
        background: radial-gradient(circle at top left, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.96));
        border: 1px dashed rgba(148, 163, 184, 0.6);
      }

      .admin-wheel-form-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
        gap: 12px;
      }

      .admin-wheel-form-left,
      .admin-wheel-form-right {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .admin-wheel-form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .admin-wheel-label {
        font-size: 11px;
        font-weight: 600;
        color: rgba(226, 232, 240, 0.92);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .admin-wheel-label-hint {
        font-size: 10px;
        color: rgba(148, 163, 184, 0.85);
        font-weight: 400;
      }

      .admin-wheel-input,
      .admin-wheel-textarea {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.7);
        background: rgba(15, 23, 42, 0.96);
        color: #f9fafb;
        font-size: 13px;
        padding: 9px 12px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.12s ease;
        resize: vertical;
        min-height: 40px;
      }

      .admin-wheel-textarea {
        min-height: 60px;
      }

      .admin-wheel-input::placeholder,
      .admin-wheel-textarea::placeholder {
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-wheel-input:focus,
      .admin-wheel-textarea:focus {
        border-color: rgba(248, 113, 113, 0.95);
        box-shadow:
          0 0 0 1px rgba(248, 113, 113, 0.9),
          0 0 0 5px rgba(248, 113, 113, 0.22);
        background: rgba(15, 23, 42, 1);
        transform: translateY(-1px);
      }

      .admin-wheel-form-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }

      .admin-wheel-button-primary {
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

      .admin-wheel-button-primary:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.01);
        box-shadow:
          0 18px 38px rgba(248, 113, 113, 0.65),
          0 0 0 1px rgba(248, 113, 113, 0.6);
        filter: brightness(1.02);
      }

      .admin-wheel-button-primary:active:not(:disabled) {
        transform: translateY(0) scale(0.99);
        box-shadow: 0 10px 24px rgba(248, 113, 113, 0.5);
      }

      .admin-wheel-button-primary:disabled {
        cursor: not-allowed;
        opacity: 0.9;
        box-shadow: 0 10px 24px rgba(148, 163, 184, 0.5);
        filter: grayscale(0.1);
      }

      .admin-wheel-button-secondary {
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

      .admin-wheel-button-secondary:hover {
        background: rgba(31, 41, 55, 1);
        color: #e5e7eb;
        transform: translateY(-1px);
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.7);
      }

      .admin-wheel-button-secondary:active {
        transform: translateY(0);
        box-shadow: 0 7px 18px rgba(15, 23, 42, 0.7);
      }

      .admin-wheel-spinner {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        animation: awSpin 0.65s linear infinite;
      }

      .admin-wheel-table-wrap {
        margin-top: 10px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(55, 65, 81, 0.9);
        background: radial-gradient(circle at top left, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.98));
      }

      .admin-wheel-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .admin-wheel-table thead {
        background: linear-gradient(to right, rgba(31, 41, 55, 0.98), rgba(15, 23, 42, 0.98));
      }

      .admin-wheel-table th,
      .admin-wheel-table td {
        padding: 8px 10px;
        text-align: left;
        border-bottom: 1px solid rgba(30, 64, 175, 0.6);
        color: #e5e7eb;
        vertical-align: middle;
      }

      .admin-wheel-table th {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(191, 219, 254, 0.9);
      }

      .admin-wheel-table tbody tr {
        transition: background 0.16s ease, transform 0.12s ease;
      }

      .admin-wheel-table tbody tr:nth-child(even) {
        background: rgba(15, 23, 42, 0.9);
      }

      .admin-wheel-table tbody tr:nth-child(odd) {
        background: rgba(15, 23, 42, 0.95);
      }

      .admin-wheel-table tbody tr:hover {
        background: rgba(30, 64, 175, 0.6);
        transform: translateY(-1px);
      }

      .admin-wheel-table-empty {
        text-align: center;
        padding: 14px 10px;
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-wheel-table-loading {
        text-align: center;
        padding: 14px 10px;
        color: rgba(191, 219, 254, 0.95);
      }

      .admin-wheel-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 64px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .admin-wheel-badge--active {
        background: rgba(22, 163, 74, 0.16);
        color: #bbf7d0;
        border: 1px solid rgba(22, 163, 74, 0.8);
      }

      .admin-wheel-badge--inactive {
        background: rgba(148, 163, 184, 0.16);
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, 0.7);
      }

      .admin-wheel-actions {
        display: flex;
        gap: 6px;
        flex-wrap: nowrap;
      }

      .admin-wheel-row-btn {
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        border: 1px solid transparent;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: background 0.16s ease, transform 0.12s ease, box-shadow 0.16s ease, color 0.16s ease, border-color 0.16s ease;
        background: transparent;
      }

      .admin-wheel-row-btn--edit {
        border-color: rgba(129, 140, 248, 0.9);
        color: #bfdbfe;
        background: rgba(30, 64, 175, 0.5);
      }

      .admin-wheel-row-btn--edit:hover {
        background: rgba(59, 130, 246, 0.9);
        color: #eff6ff;
        box-shadow: 0 10px 22px rgba(37, 99, 235, 0.6);
        transform: translateY(-1px);
      }

      .admin-wheel-row-btn--delete {
        border-color: rgba(239, 68, 68, 0.9);
        color: #fecaca;
        background: rgba(127, 29, 29, 0.6);
      }

      .admin-wheel-row-btn--delete:hover {
        background: rgba(248, 113, 113, 0.95);
        color: #fef2f2;
        box-shadow: 0 10px 22px rgba(248, 113, 113, 0.6);
        transform: translateY(-1px);
      }

      .admin-wheel-pill-qty {
        font-size: 12px;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.7);
        background: rgba(15, 23, 42, 0.9);
        color: rgba(209, 213, 219, 0.98);
      }

      .admin-wheel-qty-infinite {
        font-size: 14px;
      }

      @keyframes awSpin {
        to { transform: rotate(360deg); }
      }

      @keyframes awFadeInUp {
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
        .admin-wheel-card {
          padding: 20px 14px 16px;
          border-radius: 20px;
        }
        .admin-wheel-form-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 480px) {
        .admin-wheel-title {
          font-size: 18px;
        }
        .admin-wheel-table th,
        .admin-wheel-table td {
          padding: 8px 8px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  const loadItems = async () => {
    setError(null);
    setLoadingList(true);
    try {
      const res = await getWheelItems();
      setItems(res.data || []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load wheel items';
      setError(msg);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setError(null);
    setMsg(null);
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: (form.description || '').trim(),
      imageUrl: form.imageUrl.trim(),
      probabilityWeight: Number(form.probabilityWeight),
      quantityTotal:
        form.quantityTotal === '' ? null : Number(form.quantityTotal),
    };

    if (!payload.title || Number.isNaN(payload.probabilityWeight)) {
      setError('Please provide a valid title and probability weight.');
      setSaving(false);
      return;
    }

    if (
      payload.quantityTotal !== null &&
      (Number.isNaN(payload.quantityTotal) || payload.quantityTotal < 0)
    ) {
      setError('Quantity total must be a non-negative number or left blank.');
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await updateWheelItem(editingId, payload);
        setMsg('Wheel item updated');
      } else {
        await createWheelItem(payload);
        setMsg('Wheel item created');
      }
      resetForm();
      await loadItems();
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to save item';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      probabilityWeight: item.probabilityWeight ?? 1,
      quantityTotal:
        item.quantityTotal === null || item.quantityTotal === undefined
          ? ''
          : item.quantityTotal,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this wheel item?')) return;
    setError(null);
    setMsg(null);
    setDeletingId(id);
    try {
      await deleteWheelItem(id);
      setMsg('Wheel item deleted');
      await loadItems();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete item';
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-wheel-page">
      <div className="admin-wheel-card">
        <div className="admin-wheel-header">
          <div className="admin-wheel-pill">
            <span className="admin-wheel-pill-dot" />
            <span>Wheel Configuration</span>
          </div>
          <h3 className="admin-wheel-title">Wheel Items</h3>
          <p className="admin-wheel-subtitle">
            Create and manage prizes on the spin wheel, with weights and quantities.
          </p>
        </div>

        {msg && (
          <div className="admin-wheel-alert admin-wheel-alert--success">
            <svg
              className="admin-wheel-alert-icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span>{msg}</span>
          </div>
        )}

        {error && (
          <div className="admin-wheel-alert admin-wheel-alert--error">
            <svg
              className="admin-wheel-alert-icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="admin-wheel-section-title">
          {editingId ? 'Edit Wheel Item' : 'Create Wheel Item'}
        </div>

        {editingId && (
          <div className="admin-wheel-mode-badge admin-wheel-mode-badge--edit">
            <span className="admin-wheel-mode-dot" />
            <span>Editing: {items.find((i) => i._id === editingId)?.title}</span>
          </div>
        )}

        {/* Form */}
        <form className="admin-wheel-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-wheel-form-grid">
            <div className="admin-wheel-form-left">
              <div className="admin-wheel-form-group">
                <label htmlFor="wheelTitle" className="admin-wheel-label">
                  <span>Title</span>
                </label>
                <input
                  id="wheelTitle"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  placeholder="Prize title (e.g. Free Fries, 10% Off)"
                  className="admin-wheel-input"
                />
              </div>

              <div className="admin-wheel-form-group">
                <label htmlFor="wheelDescription" className="admin-wheel-label">
                  <span>Description</span>
                  <span className="admin-wheel-label-hint">Shown in UI (optional)</span>
                </label>
                <textarea
                  id="wheelDescription"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="admin-wheel-textarea"
                  placeholder="Short description of the prize or any conditions."
                  rows={2}
                />
              </div>

              <div className="admin-wheel-form-group">
                <label htmlFor="wheelImageUrl" className="admin-wheel-label">
                  <span>Image URL</span>
                  <span className="admin-wheel-label-hint">Optional icon / image</span>
                </label>
                <input
                  id="wheelImageUrl"
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  className="admin-wheel-input"
                  placeholder="https://…"
                />
              </div>
            </div>

            <div className="admin-wheel-form-right">
              <div className="admin-wheel-form-group">
                <label htmlFor="wheelWeight" className="admin-wheel-label">
                  <span>Probability Weight</span>
                  <span className="admin-wheel-label-hint">
                    Higher = more likely
                  </span>
                </label>
                <input
                  id="wheelWeight"
                  type="number"
                  min="0"
                  step="0.1"
                  name="probabilityWeight"
                  value={form.probabilityWeight}
                  onChange={handleChange}
                  required
                  className="admin-wheel-input"
                />
              </div>

              <div className="admin-wheel-form-group">
                <label htmlFor="wheelQuantity" className="admin-wheel-label">
                  <span>Quantity Total</span>
                  <span className="admin-wheel-label-hint">
                    Blank = unlimited
                  </span>
                </label>
                <input
                  id="wheelQuantity"
                  type="number"
                  min="0"
                  name="quantityTotal"
                  value={form.quantityTotal}
                  onChange={handleChange}
                  className="admin-wheel-input"
                  placeholder="e.g. 100"
                />
              </div>
            </div>
          </div>

          <div className="admin-wheel-form-actions">
            <button
              type="submit"
              className="admin-wheel-button-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="admin-wheel-spinner" />
                  <span>{editingId ? 'Saving…' : 'Creating…'}</span>
                </>
              ) : (
                <>
                  <span>{editingId ? 'Save Changes' : 'Create Item'}</span>
                </>
              )}
            </button>

            {editingId && (
              <button
                type="button"
                className="admin-wheel-button-secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        {/* Items table */}
        <div className="admin-wheel-section-title">Items on Wheel</div>
        <div className="admin-wheel-table-wrap">
          <table className="admin-wheel-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Weight</th>
                <th>Qty (Total / Redeemed)</th>
                <th>Active</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={6} className="admin-wheel-table-loading">
                    <span className="admin-wheel-spinner" /> Loading wheel items…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-wheel-table-empty">
                    No wheel items found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id}>
                    <td>{item.title}</td>
                    <td>{item.probabilityWeight}</td>
                    <td>
                      {item.quantityTotal == null ? (
                        <span className="admin-wheel-pill-qty admin-wheel-qty-infinite">
                          ∞
                        </span>
                      ) : (
                        <span className="admin-wheel-pill-qty">
                          {item.quantityTotal} / {item.quantityRedeemed ?? 0}
                        </span>
                      )}
                    </td>
                    <td>
                      {item.isActive ? (
                        <span className="admin-wheel-badge admin-wheel-badge--active">
                          Active
                        </span>
                      ) : (
                        <span className="admin-wheel-badge admin-wheel-badge--inactive">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString()
                        : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-wheel-actions">
                        <button
                          type="button"
                          className="admin-wheel-row-btn admin-wheel-row-btn--edit"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-wheel-row-btn admin-wheel-row-btn--delete"
                          disabled={deletingId === item._id}
                          onClick={() => handleDelete(item._id)}
                        >
                          {deletingId === item._id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
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

export default AdminWheelItemsPage;
