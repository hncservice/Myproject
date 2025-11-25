// client/src/pages/admin/AdminWheelItemsPage.jsx
import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Table, Badge } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import {
  getWheelItems,
  createWheelItem,
  updateWheelItem,
  deleteWheelItem
} from '../../api/adminApi';

const emptyForm = {
  title: '',
  description: '',
  imageUrl: '',
  probabilityWeight: 1,
  quantityTotal: ''
};

const AdminWheelItemsPage = () => {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    try {
      const res = await getWheelItems(token);
      setItems(res.data);
    } catch (err) {
      setError('Failed to load wheel items');
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setError(null);
    setMsg(null);
    setLoading(true);

    const payload = {
      title: form.title,
      description: form.description || '',
      imageUrl: form.imageUrl || '',
      probabilityWeight: Number(form.probabilityWeight),
      quantityTotal: form.quantityTotal === '' ? null : Number(form.quantityTotal)
    };

    try {
      if (editingId) {
        await updateWheelItem(token, editingId, payload);
        setMsg('Wheel item updated');
      } else {
        await createWheelItem(token, payload);
        setMsg('Wheel item created');
      }
      resetForm();
      loadItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title,
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      probabilityWeight: item.probabilityWeight,
      quantityTotal: item.quantityTotal ?? ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this wheel item?')) return;
    setError(null);
    setMsg(null);
    try {
      await deleteWheelItem(token, id);
      setMsg('Wheel item deleted');
      loadItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete item');
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Wheel Items</h3>
      {msg && <Alert variant="success">{msg}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Create / Edit form */}
      <Form onSubmit={handleSubmit} className="mb-4">
        <Form.Group className="mb-2">
          <Form.Label>Title</Form.Label>
          <Form.Control
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Description</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            name="description"
            value={form.description}
            onChange={handleChange}
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Image URL (optional)</Form.Label>
          <Form.Control
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
          />
        </Form.Group>
        <Form.Group className="mb-2">
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
        <Form.Group className="mb-2">
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
          <Button type="submit" disabled={loading}>
            {editingId
              ? loading
                ? 'Saving...'
                : 'Save Changes'
              : loading
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
          {items.map((item) => (
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
              <td>{new Date(item.createdAt).toLocaleString()}</td>
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
                    onClick={() => handleDelete(item._id)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
};

export default AdminWheelItemsPage;
