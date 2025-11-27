// client/src/pages/admin/AdminVendorsPage.jsx
import React, { useEffect, useState } from 'react';
import { createVendor, getVendors } from '../../api/adminApi';
import { Card, Form, Button, Alert, Table, Spinner } from 'react-bootstrap';

const initialForm = { name: '', email: '', password: '' };

const AdminVendorsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating) return;

    setError(null);
    setMsg(null);
    setCreating(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      if (!payload.name || !payload.email || !payload.password) {
        setError('Please fill in all fields.');
        setCreating(false);
        return;
      }

      await createVendor(payload);

      setMsg('Vendor created successfully.');
      setForm(initialForm);
      await loadVendors();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create vendor';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Vendors</h3>

      {msg && <Alert variant="success">{msg}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Create Vendor Form */}
      <Form className="mb-4" onSubmit={handleCreate} noValidate>
        <Form.Group className="mb-2" controlId="vendorName">
          <Form.Label>Name</Form.Label>
          <Form.Control
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group className="mb-2" controlId="vendorEmail">
          <Form.Label>Email</Form.Label>
          <Form.Control
            name="email"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group className="mb-2" controlId="vendorPassword">
          <Form.Label>Password</Form.Label>
          <Form.Control
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Button type="submit" disabled={creating}>
          {creating ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                className="me-2"
              />
              Creating…
            </>
          ) : (
            'Create Vendor'
          )}
        </Button>
      </Form>

      {/* Vendors Table */}
      <div className="table-responsive">
        <Table striped bordered size="sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr>
                <td colSpan={3} className="text-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Loading vendors…
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted">
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
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  );
};

export default AdminVendorsPage;
