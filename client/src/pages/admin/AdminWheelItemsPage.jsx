// client/src/pages/admin/AdminWheelItemsPage.jsx
import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Table, Badge, Spinner } from 'react-bootstrap';
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
    <Card className="p-4">
      <h3 className="mb-3">Wheel Items</h3>

      {msg && <Alert variant="success">{msg}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Create / Edit form */}
      <Form onSubmit={handleSubmit} className="mb-4" noValidate>
        <Form.Group className="mb-2" controlId="wheelTitle">
          <Form.Label>Title</Form.Label>
          <Form.Control
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group className="mb-2" controlId="wheelDescription">
          <Form.Label>Description</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            name="description"
            value={form.description}
            onChange={handleChange}
          />
        </Form.Group>

        <Form.Group className="mb-2" controlId="wheelImageUrl">
          <Form.Label>Image URL (optional)</Form.Label>
          <Form.Control
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
          />
        </Form.Group>

        <Form.Group className="mb-2" controlId="wheelWeight">
          <Form.Label>Probability Weight</Form.Label>
          <Form.Control
            type="number"
            min="0"
            step="0.1"
            name="probabilityWeight"
            value={form.probabilityWeight}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group className="mb-2" controlId="wheelQuantity">
          <Form.Label>Quantity Total (blank = unlimited)</Form.Label>
          <Form.Control
            type="number"
            min="0"
            name="quantityTotal"
            value={form.quantityTotal}
            onChange={handleChange}
          />
        </Form.Group>

        <div className="d-flex gap-2 mt-2">
          <Button type="submit" disabled={saving}>
            {editingId
              ? saving
                ? 'Saving...'
                : 'Save Changes'
              : saving
              ? 'Creating...'
              : 'Create Item'}
          </Button>
          {editingId && (
            <Button variant="secondary" type="button" onClick={resetForm}>
              Cancel Edit
            </Button>
          )}
        </div>
      </Form>

      {/* Items table */}
      <div className="table-responsive">
        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              <th>Title</th>
              <th>Weight</th>
              <th>Qty (Total / Redeemed)</th>
              <th>Active</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr>
                <td colSpan={6} className="text-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Loading wheel items…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted">
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
                      '∞'
                    ) : (
                      <>
                        {item.quantityTotal} / {item.quantityRedeemed}
                      </>
                    )}
                  </td>
                  <td>
                    {item.isActive ? (
                      <Badge bg="success">Active</Badge>
                    ) : (
                      <Badge bg="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : '-'}
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={deletingId === item._id}
                        onClick={() => handleDelete(item._id)}
                      >
                        {deletingId === item._id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
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

export default AdminWheelItemsPage;
