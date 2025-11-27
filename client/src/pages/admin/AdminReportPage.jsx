// client/src/pages/admin/AdminReportPage.jsx
import React, { useState } from 'react';
import { downloadReport } from '../../api/adminApi';
import { Card, Button, Alert, Spinner } from 'react-bootstrap';

const AdminReportPage = () => {
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return; // prevent double-click spam

    setError(null);
    setDownloading(true);

    try {
      const res = await downloadReport();

      // Basic safety check
      if (!res || !res.data) {
        throw new Error('Empty response from server');
      }

      const blob = new Blob([res.data], {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      // Optional: add timestamp to filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);

      link.href = url;
      link.setAttribute('download', `spin_report_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to download report';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Reports</h3>

      {error && <Alert variant="danger">{error}</Alert>}

      <Button onClick={handleDownload} disabled={downloading}>
        {downloading ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              className="me-2"
            />
            Downloading…
          </>
        ) : (
          'Download Excel Report'
        )}
      </Button>
      <p className="mt-2 mb-0 small text-muted">
        This report includes all spins, users, prizes, and redemption details.
      </p>
    </Card>
  );
};

export default AdminReportPage;
