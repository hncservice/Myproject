import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { downloadReport } from '../../api/adminApi';
import { Card, Button, Alert } from 'react-bootstrap';

const AdminReportPage = () => {
  const { token } = useAuth();
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setError(null);
    try {
      const res = await downloadReport(token);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'spin_report.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download report');
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Reports</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      <Button onClick={handleDownload}>Download Excel Report</Button>
    </Card>
  );
};

export default AdminReportPage;
