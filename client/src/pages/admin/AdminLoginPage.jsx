// client/src/pages/admin/AdminLoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { Card, Form, Button, Alert } from 'react-bootstrap';

const AdminLoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // prevent double submit

    setError(null);
    setLoading(true);

    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      if (!payload.email || !payload.password) {
        setError('Please enter both email and password.');
        setLoading(false);
        return;
      }

      const res = await loginAdmin(payload);
      const { token, admin } = res.data || {};

      if (!token || !admin) {
        throw new Error('Invalid response from server');
      }

      login('admin', token, admin);
      navigate('/admin/vendors');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Admin Login</h3>
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3" controlId="adminLoginEmail">
          <Form.Label>Email</Form.Label>
          <Form.Control
            name="email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="adminLoginPassword">
          <Form.Label>Password</Form.Label>
          <Form.Control
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Button type="submit" className="w-100" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </Button>
      </Form>
    </Card>
  );
};

export default AdminLoginPage;
