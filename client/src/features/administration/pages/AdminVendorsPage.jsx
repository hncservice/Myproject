// client/src/pages/admin/AdminVendorsPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createVendor, getVendors, updateVendor } from '../api/adminApi';
const initialForm = { name: '', email: '', password: '', isActive: true, revokeSessions: false };

const AdminVendorsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState('create'); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, q: '', active: 'all', sort: 'newest' });
  const [pages, setPages] = useState(1);
  const listRequest = useRef(0);
  const nameInput = useRef(null);
  const mutationInFlight = useRef(false);
  const [listError, setListError] = useState(null);

  const loadVendors = async () => {
    const request = ++listRequest.current;
    setListError(null);
    setLoadingList(true);
    try {
      const res = await getVendors(query);
      if (request !== listRequest.current) return;
      setVendors(Array.isArray(res.data) ? res.data : res.data?.items || []);
      setPages(res.data?.pages || 1);
    } catch (err) {
      if (request !== listRequest.current) return;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load vendors';
      setListError(msg);
    } finally {
      if (request === listRequest.current) setLoadingList(false);
    }
  };

  useEffect(() => {
    loadVendors();
    return () => { listRequest.current++; };
  }, [query]);

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
      isActive: vendor.isActive !== false,
      revokeSessions: false,
    });
    nameInput.current?.focus();
  };

  const handleCancelEdit = () => {
    resetFormToCreate();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;

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
        return;
      }

      if (mode === 'create') {
        if (!basePayload.password) {
          setError('Please set a password for the new vendor.');
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
          isActive: form.isActive,
          revokeSessions: form.revokeSessions,
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
      mutationInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-vendors-page" aria-labelledby="vendors-title">
      <style>{pageStyles}</style>
      <header className="admin-vendors-header">
        <h1 id="vendors-title">Vendors</h1>
      </header>

      <form className="admin-vendors-panel" aria-labelledby="vendor-editor-title" onSubmit={handleSubmit}>
        <h2 id="vendor-editor-title">{mode === 'create' ? 'Create Vendor' : 'Edit Vendor'}</h2>
        {msg && <p className="admin-vendors-notice" role="status">{msg}</p>}
        {error && <p className="admin-vendors-alert" role="alert">{error}</p>}

        <fieldset disabled={submitting}>
          <div className="admin-vendors-fields">
            <label htmlFor="vendorName">
              Name
              <input ref={nameInput} id="vendorName" name="name" value={form.name}
                onChange={handleChange} required placeholder="Vendor name" />
            </label>
            <label htmlFor="vendorEmail">
              Email
              <input id="vendorEmail" name="email" type="email" autoComplete="off"
                value={form.email} onChange={handleChange} required placeholder="vendor@example.com" />
            </label>
            <label htmlFor="vendorPassword">
              Password <span className="admin-vendors-hint">{mode === 'create' ? '(required)' : '(optional – fill to reset)'}</span>
              <input id="vendorPassword" name="password" type="password" autoComplete="new-password"
                value={form.password} onChange={handleChange} required={mode === 'create'} />
            </label>
          </div>

          {mode === 'edit' && (
            <fieldset className="admin-vendors-access">
              <legend>Account access</legend>
              <div className="admin-vendors-actions">
                <label className="admin-vendors-check">
                  <input type="checkbox" checked={form.isActive}
                    onChange={event => setForm(previous => ({ ...previous, isActive: event.target.checked }))} />
                  Vendor active
                </label>
                <label className="admin-vendors-check">
                  <input type="checkbox" checked={form.revokeSessions}
                    onChange={event => setForm(previous => ({ ...previous, revokeSessions: event.target.checked }))} />
                  Revoke existing sessions
                </label>
              </div>
              <p className="admin-vendors-hint">Changing activation or password revokes existing sessions.</p>
            </fieldset>
          )}

          <div className="admin-vendors-actions">
            <button type="submit" className="admin-vendors-primary">
              {mode === 'create'
                ? (submitting ? 'Creating…' : 'Create Vendor')
                : (submitting ? 'Updating…' : 'Save Changes')}
            </button>
            {mode === 'edit' && (
              <button type="button" onClick={handleCancelEdit}>Cancel edit</button>
            )}
          </div>
        </fieldset>
      </form>

      <section className="admin-vendors-panel" aria-labelledby="vendors-list-title">
        <h2 id="vendors-list-title">Vendor List</h2>
        <fieldset className="admin-vendors-fields" disabled={submitting} aria-label="Vendor filters">
          <label>
            Search vendors
            <input type="search" maxLength={100} value={query.q}
              onChange={event => setQuery(previous => ({ ...previous, q: event.target.value, page: 1 }))} />
          </label>
          <label>
            Account status
            <select value={query.active}
              onChange={event => setQuery(previous => ({ ...previous, active: event.target.value, page: 1 }))}>
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Vendor sort
            <select value={query.sort}
              onChange={event => setQuery(previous => ({ ...previous, sort: event.target.value, page: 1 }))}>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
            </select>
          </label>
        </fieldset>

        {loadingList ? <p role="status">Loading vendors…</p> : listError ? (
          <>
            <p className="admin-vendors-alert" role="alert">{listError}</p>
            <button type="button" disabled={submitting} onClick={loadVendors}>Try again</button>
          </>
        ) : vendors.length === 0 ? <p>No vendors found.</p> : (
          <table className="admin-vendors-table" role="table" aria-labelledby="vendors-list-title">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Name</th>
                <th role="columnheader" scope="col">Email</th>
                <th role="columnheader" scope="col">Status</th>
                <th role="columnheader" scope="col">Created At</th>
                <th role="columnheader" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {vendors.map(vendor => {
                const inactive = vendor.isActive === false;
                const date = vendor.createdAt ? new Date(vendor.createdAt) : null;
                const dateValid = date && Number.isFinite(date.getTime());

                return (
                  <tr key={vendor._id} role="row">
                    <td role="cell">
                      <span className="admin-vendors-mobile-label" aria-hidden="true">Name</span>
                      <strong>{vendor.name}</strong>
                    </td>
                    <td role="cell">
                      <span className="admin-vendors-mobile-label" aria-hidden="true">Email</span>
                      <span>{vendor.email}</span>
                    </td>
                    <td role="cell">
                      <span className="admin-vendors-mobile-label" aria-hidden="true">Status</span>
                      <div><span className={'admin-vendors-badge' + (inactive ? ' admin-vendors-badge--inactive' : '')}>
                        {inactive ? 'Inactive' : 'Active'}
                      </span></div>
                    </td>
                    <td role="cell">
                      <span className="admin-vendors-mobile-label" aria-hidden="true">Created At</span>
                      {dateValid ? <time dateTime={date.toISOString()}>{date.toLocaleString()}</time> : <span>—</span>}
                    </td>
                    <td role="cell">
                      <span className="admin-vendors-mobile-label" aria-hidden="true">Actions</span>
                      <div><button type="button" disabled={submitting} onClick={() => handleEditClick(vendor)}>Edit</button></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <nav className="admin-vendors-actions admin-vendors-pages" aria-label="Vendor pages">
          <button type="button" disabled={submitting || loadingList || query.page <= 1}
            onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))}>
            Previous vendors
          </button>
          <span aria-live="polite">Page {query.page} of {pages}</span>
          <button type="button" disabled={submitting || loadingList || Boolean(listError) || query.page >= pages}
            onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))}>
            Next vendors
          </button>
        </nav>
      </section>
    </section>
  );
};

const pageStyles = `
  .admin-vendors-page {
    --vendors-border: #75404e;
    --vendors-text: #fff7f6;
    --vendors-muted: #dcc8d0;
    width: min(100%, 1160px);
    margin-inline: auto;
    padding-block: clamp(16px, 3vw, 36px);
    color: var(--vendors-text);
    overflow-wrap: anywhere;
  }
  .admin-vendors-header { margin-bottom: 16px; }
  .admin-vendors-page h1 { margin: 0; font-size: clamp(28px, 5vw, 42px); font-weight: 800; }
  .admin-vendors-page h2 { margin: 0 0 14px; font-size: clamp(19px, 3vw, 25px); font-weight: 750; }
  .admin-vendors-panel {
    min-width: 0;
    margin-bottom: 14px;
    padding: clamp(14px, 2.5vw, 24px);
    border: 1px solid var(--vendors-border);
    border-radius: 14px;
    background: #23131d;
  }
  .admin-vendors-page fieldset { min-width: 0; padding: 0; border: 0; }
  .admin-vendors-fields {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px 14px;
    margin-bottom: 14px;
  }
  .admin-vendors-fields label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    font-size: 14px;
    font-weight: 650;
  }
  .admin-vendors-hint { color: var(--vendors-muted); font-size: 13px; font-weight: 400; }
  .admin-vendors-fields input { scroll-margin-top: 96px; }
  .admin-vendors-page :is(input:not([type='checkbox']), select, button) {
    min-height: 44px;
    padding: 7px 12px;
    border: 1px solid #a47082;
    border-radius: 8px;
    background: #39202e;
    color: var(--vendors-text);
    font: inherit;
  }
  .admin-vendors-page :is(input:not([type='checkbox']), select) {
    width: 100%;
    min-width: 0;
    margin-top: auto;
    font-size: 16px;
  }
  .admin-vendors-page input::placeholder { color: var(--vendors-muted); }
  .admin-vendors-page button { cursor: pointer; }
  .admin-vendors-page button:hover:not(:disabled) { filter: brightness(1.16); }
  .admin-vendors-page :is(input, select, button):disabled { opacity: 0.60; cursor: default; }
  .admin-vendors-page :is(input, select, button):focus-visible { outline: 2px solid #ffc5cb; outline-offset: 2px; }
  .admin-vendors-page button.admin-vendors-primary { background: #a51d37; }

  .admin-vendors-page fieldset.admin-vendors-access {
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid var(--vendors-border);
    border-radius: 9px;
    background: #301b28;
  }
  .admin-vendors-access legend { float: none; width: auto; padding-inline: 4px; font-size: 15px; font-weight: 750; }
  .admin-vendors-access p { margin: 4px 0 0; }
  .admin-vendors-check { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; }
  .admin-vendors-check input { width: 18px; height: 18px; margin: 0; accent-color: #b9253d; }
  .admin-vendors-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .admin-vendors-pages { justify-content: space-between; margin-top: 14px; font-size: 14px; }
  .admin-vendors-alert, .admin-vendors-notice { padding: 10px 12px; border-radius: 8px; }
  .admin-vendors-alert { background: #481825; color: #ffe1e5; }
  .admin-vendors-notice { background: #17372b; color: #cff5df; }

  .admin-vendors-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .admin-vendors-table :is(th, td) { padding: 10px; border-bottom: 1px solid #593240; text-align: start; vertical-align: top; }
  .admin-vendors-table th { background: #39202e; color: #f5d9e2; }
  .admin-vendors-badge {
    display: inline-block;
    padding: 3px 8px;
    border: 1px solid #559775;
    border-radius: 999px;
    background: #17372b;
    color: #cff5df;
    font-size: 12px;
    font-weight: 700;
  }
  .admin-vendors-badge--inactive { border-color: #a47082; background: #39202e; color: #f5dce6; }
  .admin-vendors-mobile-label { display: none; }

  @media (max-width: 700px) {
    .admin-vendors-fields { grid-template-columns: minmax(0, 1fr); }
    .admin-vendors-table, .admin-vendors-table tbody { display: block; }
    .admin-vendors-table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .admin-vendors-table tbody tr {
      display: grid;
      gap: 8px;
      margin-bottom: 8px;
      padding: 10px;
      border: 1px solid var(--vendors-border);
      border-radius: 10px;
      background: #301b28;
    }
    .admin-vendors-table td {
      display: grid;
      grid-template-columns: minmax(0, 5.5rem) minmax(0, 1fr);
      gap: 8px;
      padding: 0;
      border: 0;
    }
    .admin-vendors-mobile-label { display: block; color: var(--vendors-muted); font-size: 12px; font-weight: 650; }
  }
`;

export default AdminVendorsPage;
