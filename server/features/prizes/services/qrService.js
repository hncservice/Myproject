// server/services/qrService.js
const QRCode = require('qrcode');

// returns QR code as data URL (already used)
exports.generateQrDataUrl = async (token) => {
  const url = `${process.env.CLIENT_URL}/redeem/${token}`;
  return QRCode.toDataURL(url);
};

// returns QR code as PNG buffer for email attachment
exports.generateQrBuffer = async (token) => {
  const url = `${process.env.CLIENT_URL}/redeem/${token}`;
  return QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2
  });
};
