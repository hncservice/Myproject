'use strict';
function safeExcelText(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  if (/^[\s]*[=+\-@]/u.test(text)) text = "'" + text;
  return text.slice(0, 32000);
}
module.exports = { safeExcelText };
