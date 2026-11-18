// Export only the bounded page already returned by the administrator report contract.
export function reportCsv(rows) {
  if (!Array.isArray(rows) || rows.length > 50) throw new Error('Invalid export page');
  if (!rows.length) return '';
  const fields = Object.keys(rows[0]);
  const cell = value => {
    let text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 32000);
    if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return [fields.map(cell).join(','), ...rows.map(row => fields.map(f => cell(row[f])).join(','))].join('\r\n');
}
