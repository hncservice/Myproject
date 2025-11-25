import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createVendor, getVendors } from '../../api/adminApi';
import { Card, Form, Button, Alert, Table } from 'react-bootstrap';

const AdminVendorsPage = () => {
  const { token } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const loadVendors = async () => {
    try {
      const res = await getVendors(token);
      setVendors(res.data);
    } catch (err) {
      setError('Failed to load vendors');
    }
  };

  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await createVendor(token, form);
      setMsg('Vendor created');
      setForm({ name: '', email: '', password: '' });
      loadVendors();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create vendor');
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Vendors</h3>
      {msg && <Alert variant="success">{msg}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Form className="mb-4" onSubmit={handleCreate}>
        <Form.Group className="mb-2">
          <Form.Label>Name</Form.Label>
          <Form.Control name="name" value={form.name} onChange={handleChange} required />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Email</Form.Label>
          <Form.Control
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Password</Form.Label>
          <Form.Control
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </Form.Group>
        <Button type="submit">Create Vendor</Button>
      </Form>

      <Table striped bordered size="sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v._id}>
              <td>{v.name}</td>
              <td>{v.email}</td>
              <td>{new Date(v.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
};

export default AdminVendorsPage;
