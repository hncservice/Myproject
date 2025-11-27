// client/src/pages/user/RegisterPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../../api/authApi';
import { Form, Button, Alert, Card } from 'react-bootstrap';

const RegisterPage = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
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

    setMsg(null);
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      };

      if (!payload.name || payload.name.length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        setLoading(false);
        return;
      }

      if (!payload.email) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      await registerUser(payload);
      setMsg('OTP sent to your email.');

      // pass normalized email via state
      navigate('/verify-otp', { state: { email: payload.email } });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Register &amp; Get OTP</h3>

      {msg && <Alert variant="success">{msg}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3" controlId="registerName">
          <Form.Label>Name</Form.Label>
          <Form.Control
            name="name"
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="registerEmail">
          <Form.Label>Email</Form.Label>
          <Form.Control
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="registerPhone">
          <Form.Label>Phone (optional)</Form.Label>
          <Form.Control
            name="phone"
            value={form.phone}
            onChange={handleChange}
            autoComplete="tel"
          />
        </Form.Group>

        <Button type="submit" className="w-100" disabled={loading}>
          {loading ? 'Sending OTP…' : 'Register'}
        </Button>
      </Form>

      {/* extra section for admin/vendor login */}
      <div className="mt-4 d-flex flex-column gap-2">
        <Button
          variant="outline-dark"
          className="w-100"
          onClick={() => navigate('/admin/login')}
        >
          Admin Login
        </Button>

        <Button
          variant="outline-secondary"
          className="w-100"
          onClick={() => navigate('/vendor/login')}
        >
          Vendor Login
        </Button>
      </div>
    </Card>
  );
};

export default RegisterPage;
