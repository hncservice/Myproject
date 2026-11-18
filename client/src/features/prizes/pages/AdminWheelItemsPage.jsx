import React, { useEffect, useRef, useState } from 'react';
import {
  createWheelItem,
  deleteWheelItem,
  getWheelItems,
  updateWheelItem,
} from '../../administration/api/adminApi';

const emptyForm = {
  title: '',
  description: '',
  imageUrl: '',
  probabilityWeight: 1,
  quantityTotal: '',
};

function getInventory(item) {
  const unlimited = item.quantityTotal == null;
  const allocated = item.quantityAllocated ?? 0;
  const available = unlimited
    ? null
    : item.quantityAvailable ?? Math.max(0, item.quantityTotal - allocated);

  return {
    allocated,
    stockLabel: unlimited ? 'Unlimited' : available <= 0 ? 'Out of stock' : available + ' available',
    stockTone: unlimited ? 'unlimited' : available <= 0 ? 'empty' : 'available',
  };
}

const pageStyles = `
  .admin-wheel-page {
    padding: 8px 0 24px;
  }

  .admin-wheel-card {
    padding: 24px 20px 20px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 24px;
    background: #1b1019;
    box-shadow: 0 26px 60px rgba(0, 0, 0, 0.65);
    color: #e5e7eb;
  }

  .admin-wheel-header {
    margin-bottom: 18px;
  }

  .admin-wheel-title {
    margin: 0 0 4px;
    color: #f9fafb;
    font-size: 20px;
  }

  .admin-wheel-subtitle {
    margin: 0;
    color: #a5b4c7;
    font-size: 13px;
  }

  .admin-wheel-section-title {
    margin: 0 0 8px;
    color: #d1d5db;
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .admin-wheel-alert {
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid;
    border-radius: 14px;
    font-size: 13px;
  }

  .admin-wheel-alert--success {
    border-color: rgba(34, 197, 94, 0.45);
    background: rgba(22, 163, 74, 0.12);
    color: #bbf7d0;
  }

  .admin-wheel-alert--error {
    border-color: rgba(239, 68, 68, 0.45);
    background: rgba(239, 68, 68, 0.12);
    color: #fecaca;
  }

  .admin-wheel-form {
    margin-bottom: 18px;
    padding: 12px;
    border: 1px solid #75404e;
    border-radius: 16px;
    background: #23131d;
  }

  .admin-wheel-form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: 12px;
  }

  .admin-wheel-form-column,
  .admin-wheel-form-group {
    display: flex;
    flex-direction: column;
  }

  .admin-wheel-form-column {
    gap: 10px;
  }

  .admin-wheel-form-group {
    gap: 4px;
  }

  .admin-wheel-label {
    font-size: 12px;
    font-weight: 600;
  }

  .admin-wheel-label-hint {
    color: #a5b4c7;
    font-size: 11px;
  }

  .admin-wheel-input {
    box-sizing: border-box;
    width: 100%;
    min-height: 46px;
    scroll-margin-top: 96px;
    padding: 9px 12px;
    border: 1px solid rgba(148, 163, 184, 0.7);
    border-radius: 12px;
    background: #0f172a;
    color: #fff7f6;
    font-size: 16px;
  }

  textarea.admin-wheel-input {
    min-height: 60px;
    resize: vertical;
  }

  .admin-wheel-input::placeholder {
    color: #a5b4c7;
  }

  .admin-wheel-input:focus-visible,
  .admin-wheel-button:focus-visible {
    outline: 2px solid #fca5a5;
    outline-offset: 2px;
  }

  .admin-wheel-form-actions,
  .admin-wheel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .admin-wheel-form-actions {
    margin-top: 12px;
  }

  .admin-wheel-actions {
    justify-content: flex-end;
  }

  .admin-wheel-button {
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid #64748b;
    border-radius: 9px;
    background: #39202e;
    color: #f1f5f9;
    font-size: 12px;
    cursor: pointer;
  }

  .admin-wheel-button--primary {
    padding: 9px 16px;
    border-color: #dc2626;
    background: linear-gradient(135deg, #dc2626, #991b1b);
    color: #fff;
    font-weight: 600;
  }

  .admin-wheel-button--edit {
    border-color: #818cf8;
    background: #1e3a8a;
    color: #dbeafe;
  }

  .admin-wheel-button--deactivate {
    border-color: #ef4444;
    background: #7f1d1d;
    color: #fee2e2;
  }

  .admin-wheel-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .admin-wheel-table-wrap {
    overflow-x: auto;
    border: 1px solid #374151;
    border-radius: 16px;
  }

  .admin-wheel-table {
    width: 100%;
    border-collapse: collapse;
    background: #23131d;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .admin-wheel-table th,
  .admin-wheel-table td {
    padding: 9px 10px;
    border-bottom: 1px solid #263555;
    text-align: left;
    vertical-align: middle;
  }

  .admin-wheel-table th {
    background: #39202e;
    color: #f5d9e2;
    font-size: 12px;
    white-space: nowrap;
  }

  .admin-wheel-table tr:last-child td {
    border-bottom: 0;
  }

  .admin-wheel-table .admin-wheel-table-message {
    text-align: center;
    color: #cbd5e1;
  }

  .admin-wheel-inventory {
    display: grid;
    gap: 5px;
    justify-items: start;
  }

  .admin-wheel-badge {
    display: inline-block;
    padding: 4px 10px;
    border: 1px solid;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }

  .admin-wheel-badge--active {
    border-color: #16a34a;
    background: rgba(22, 163, 74, 0.16);
    color: #bbf7d0;
  }

  .admin-wheel-badge--inactive {
    border-color: #94a3b8;
    background: rgba(148, 163, 184, 0.16);
    color: #e5e7eb;
  }

  .admin-wheel-stock--unlimited {
    border-color: #8973b1;
    background: #362548;
    color: #f1e5ff;
  }

  .admin-wheel-stock--empty {
    border-color: #d07888;
    background: #49212e;
    color: #ffdde3;
  }

  .admin-wheel-stock--available {
    border-color: #559775;
    background: #17372b;
    color: #cff5df;
  }

  .admin-wheel-stock-detail { color: #dbc4ca; }
  .admin-wheel-weight { font-weight: 750; font-variant-numeric: tabular-nums; }
  .admin-wheel-mobile-label { display: none; }

  @media (max-width: 768px) {
    .admin-wheel-card {
      padding: 20px 14px 16px;
    }

    .admin-wheel-form-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .admin-wheel-form-actions > button { flex: 1 1 130px; }

    .admin-wheel-table-wrap { border: 0; }
    .admin-wheel-table,
    .admin-wheel-table tbody { display: block; }
    .admin-wheel-table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .admin-wheel-table tbody tr {
      display: grid;
      margin-bottom: 10px;
      padding: 12px;
      border: 1px solid #75404e;
      border-radius: 12px;
      background: #23131d;
    }

    .admin-wheel-table tbody td {
      display: grid;
      grid-template-columns: minmax(0, 5.1rem) minmax(0, 1fr);
      gap: 8px;
      min-width: 0;
      padding: 7px 0;
      border-bottom: 1px solid #593240;
    }

    .admin-wheel-table tbody td:last-child { border-bottom: 0; }
    .admin-wheel-table tbody .admin-wheel-table-message { display: block; }
    .admin-wheel-mobile-label { display: block; color: #dbc4ca; font-weight: 650; }
    .admin-wheel-actions { justify-content: flex-start; }
  }
`;

export default function AdminWheelItemsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const mutationInFlight = useRef(false);
  const titleInput = useRef(null);

  const isMutating = saving || deactivatingId !== null;
  const editingItem = items.find(item => item._id === editingId);

  useEffect(() => {
    let active = true;

    getWheelItems()
      .then(response => {
        if (active) setItems(response.data);
      })
      .catch(err => {
        if (active) {
          setError(
            err?.response?.data?.message || 'Unable to load wheel items.'
          );
        }
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function refreshItems() {
    try {
      const response = await getWheelItems();
      setItems(response.data);
    } catch {
      setError('Reload the page to refresh the inventory list.');
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleEdit(item) {
    setError('');
    setMessage('');
    setEditingId(item._id);
    setForm({
      title: item.title ?? '',
      description: item.description ?? '',
      imageUrl: item.imageUrl ?? '',
      probabilityWeight: item.probabilityWeight ?? 1,
      quantityTotal: item.quantityTotal ?? '',
    });
    titleInput.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loadingList || mutationInFlight.current) return;

    setError('');
    setMessage('');

    const quantityInput = event.currentTarget.elements.namedItem('quantityTotal');
    const weight = String(form.probabilityWeight).trim();
    const quantity = String(form.quantityTotal).trim();

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      probabilityWeight: Number(weight),
      quantityTotal: quantity === '' ? null : Number(quantity),
    };

    if (!payload.title) {
      setError('Enter a prize title.');
      return;
    }

    if (
      weight === '' ||
      !Number.isFinite(payload.probabilityWeight) ||
      payload.probabilityWeight < 0
    ) {
      setError('Enter a non-negative probability weight.');
      return;
    }

    if (
      quantityInput.validity.badInput ||
      (
        payload.quantityTotal !== null &&
        (!Number.isSafeInteger(payload.quantityTotal) || payload.quantityTotal < 0)
      )
    ) {
      setError('Enter a non-negative whole number for quantity, or leave it blank.');
      return;
    }

    mutationInFlight.current = true;
    setSaving(true);

    try {
      if (editingId) {
        await updateWheelItem(editingId, payload);
        setMessage('Prize updated.');
      } else {
        await createWheelItem(payload);
        setMessage('Prize created.');
      }

      resetForm();
      await refreshItems();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to confirm the save.');
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  async function handleDeactivate(item) {
    if (mutationInFlight.current || item.isActive === false) return;
    if (!window.confirm(`Deactivate "${item.title}"?`)) return;

    mutationInFlight.current = true;
    setDeactivatingId(item._id);
    setError('');
    setMessage('');

    try {
      const response = await deleteWheelItem(item._id);

      setItems(current =>
        current.map(currentItem =>
          currentItem._id === item._id
            ? { ...currentItem, isActive: false }
            : currentItem
        )
      );

      if (editingId === item._id) resetForm();

      setMessage(response.data?.message || 'Prize deactivated.');
      await refreshItems();
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Unable to confirm deactivation.'
      );
    } finally {
      mutationInFlight.current = false;
      setDeactivatingId(null);
    }
  }

  return (
    <div className="admin-wheel-page">
      <style>{pageStyles}</style>

      <div className="admin-wheel-card">
        <header className="admin-wheel-header">
          <h1 className="admin-wheel-title">Wheel Items</h1>
          <p className="admin-wheel-subtitle">
            Manage prizes, draw weights, and inventory.
          </p>
        </header>

        {message && (
          <div
            className="admin-wheel-alert admin-wheel-alert--success"
            role="status"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="admin-wheel-alert admin-wheel-alert--error"
            role="alert"
          >
            {error}
          </div>
        )}

        <h2 id="wheel-editor-title" className="admin-wheel-section-title">
          {editingId ? 'Edit Prize' : 'Create Prize'}
          {editingItem && ` — ${editingItem.title}`}
        </h2>

        <form className="admin-wheel-form" aria-labelledby="wheel-editor-title" onSubmit={handleSubmit} noValidate>
          <div className="admin-wheel-form-grid">
            <div className="admin-wheel-form-column">
              <div className="admin-wheel-form-group">
                <label htmlFor="wheelTitle" className="admin-wheel-label">
                  Title
                </label>
                <input
                  ref={titleInput}
                  id="wheelTitle"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  disabled={isMutating}
                  placeholder="e.g. Free Fries"
                  className="admin-wheel-input"
                  required
                />
              </div>

              <div className="admin-wheel-form-group">
                <label htmlFor="wheelDescription" className="admin-wheel-label">
                  Description
                </label>
                <textarea
                  id="wheelDescription"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  disabled={isMutating}
                  placeholder="Prize details or conditions"
                  className="admin-wheel-input"
                  rows={2}
                />
              </div>

              <div className="admin-wheel-form-group">
                <label htmlFor="wheelImageUrl" className="admin-wheel-label">
                  Image URL
                </label>
                <input
                  id="wheelImageUrl"
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  disabled={isMutating}
                  placeholder="https://…"
                  className="admin-wheel-input"
                />
              </div>
            </div>

            <div className="admin-wheel-form-column">
              <div className="admin-wheel-form-group">
                <label htmlFor="wheelWeight" className="admin-wheel-label">
                  Probability Weight
                </label>
                <span id="wheelWeightHint" className="admin-wheel-label-hint">
                  Higher weights are more likely to be drawn.
                </span>
                <input
                  id="wheelWeight"
                  name="probabilityWeight"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={form.probabilityWeight}
                  onChange={handleChange}
                  disabled={isMutating}
                  aria-describedby="wheelWeightHint"
                  className="admin-wheel-input"
                  required
                />
              </div>

              <div className="admin-wheel-form-group">
                <label htmlFor="wheelQuantity" className="admin-wheel-label">
                  Quantity Total
                </label>
                <span id="wheelQuantityHint" className="admin-wheel-label-hint">
                  Leave blank for unlimited stock.
                </span>
                <input
                  id="wheelQuantity"
                  name="quantityTotal"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={form.quantityTotal}
                  onChange={handleChange}
                  disabled={isMutating}
                  aria-describedby="wheelQuantityHint"
                  placeholder="e.g. 100"
                  className="admin-wheel-input"
                />
              </div>
            </div>
          </div>

          <div className="admin-wheel-form-actions">
            <button
              type="submit"
              className="admin-wheel-button admin-wheel-button--primary"
              disabled={loadingList || isMutating}
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Item'}
            </button>

            {editingId && (
              <button
                type="button"
                className="admin-wheel-button"
                onClick={resetForm}
                disabled={isMutating}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <h2 id="wheel-list-title" className="admin-wheel-section-title">Items on Wheel</h2>

        <div className="admin-wheel-table-wrap">
          <table className="admin-wheel-table" role="table" aria-labelledby="wheel-list-title" aria-busy={loadingList}>
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Title</th>
                <th role="columnheader" scope="col">Weight</th>
                <th role="columnheader" scope="col">Inventory</th>
                <th role="columnheader" scope="col">Status</th>
                <th role="columnheader" scope="col">Created</th>
                <th role="columnheader" scope="col" style={{ textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody role="rowgroup">
              {loadingList || items.length === 0 ? (
                <tr role="row">
                  <td role="cell" colSpan={6} className="admin-wheel-table-message">
                    {loadingList
                      ? 'Loading wheel items…'
                      : 'No wheel items to display.'}
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const inactive = item.isActive === false;
                  const { allocated, stockLabel, stockTone } = getInventory(item);

                  return (
                    <tr key={item._id} role="row">
                      <td role="cell">
                        <span className="admin-wheel-mobile-label" aria-hidden="true">Title</span>
                        <strong>{item.title}</strong>
                      </td>

                      <td role="cell">
                        <span className="admin-wheel-mobile-label" aria-hidden="true">Weight</span>
                        <span className="admin-wheel-weight">{item.probabilityWeight ?? '—'}</span>
                      </td>

                      <td role="cell">
                        <span className="admin-wheel-mobile-label" aria-hidden="true">Stock</span>
                        <div className="admin-wheel-inventory">
                          <span className={'admin-wheel-badge admin-wheel-stock--' + stockTone}>
                            {stockLabel}
                          </span>
                          {item.quantityTotal != null && (
                            <span className="admin-wheel-stock-detail">Total {item.quantityTotal}</span>
                          )}
                          <span className="admin-wheel-stock-detail">
                            Allocated {allocated} · Redeemed {item.quantityRedeemed ?? 0}
                          </span>
                        </div>
                      </td>

                      <td role="cell">
                        <span className="admin-wheel-mobile-label" aria-hidden="true">Status</span>
                        <div>
                          <span className={'admin-wheel-badge admin-wheel-badge--' + (inactive ? 'inactive' : 'active')}>
                            {inactive ? 'Inactive' : 'Active'}
                          </span>
                        </div>
                      </td>

                      <td role="cell">
                        <span className="admin-wheel-mobile-label" aria-hidden="true">Created</span>
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</span>
                      </td>

                      <td role="cell">
                        <span className="admin-wheel-mobile-label" aria-hidden="true">Actions</span>
                        <div className="admin-wheel-actions">
                          <button
                            type="button"
                            className="admin-wheel-button admin-wheel-button--edit"
                            disabled={isMutating}
                            onClick={() => handleEdit(item)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="admin-wheel-button admin-wheel-button--deactivate"
                            disabled={isMutating || inactive}
                            onClick={() => void handleDeactivate(item)}
                          >
                            {deactivatingId === item._id
                              ? 'Deactivating…'
                              : 'Deactivate'}
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
      </div>
    </div>
  );
}
