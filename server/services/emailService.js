// server/services/emailService.js
const transporter = require('../config/mailer');

// OTP email for registration / verification
exports.sendOtpEmail = async (to, otp) => {
  const text = `Your OTP code is ${otp}. It expires in 10 minutes.`;
  await transporter.sendMail({
    from: `"Spin to Win" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your OTP Code',
    text
  });
};

// Prize email with attached QR (cid image)
exports.sendPrizeEmail = async ({
  to,
  name,
  prizeTitle,
  prizeDescription,
  qrBuffer, // 👈 PNG buffer
  qrToken
}) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="margin-bottom:8px;">🎉 Congratulations, ${name}!</h2>
      <p style="margin:0 0 8px;">You won: <strong>${prizeTitle}</strong></p>
      ${
        prizeDescription
          ? `<p style="margin:0 0 16px;">${prizeDescription}</p>`
          : ''
      }

      <p style="margin:0 0 8px;">Please show this QR code at the vendor to redeem your prize:</p>

      <div style="margin: 16px 0;">
        <img
          src="cid:prizeqr"
          alt="Prize QR code"
          style="max-width: 220px; border: 4px solid #291874ff; border-radius: 12px; display:block;"
        />
      </div>

      <p style="font-size: 12px; color:#777; margin-top:12px;">
        Backup code (if QR cannot be scanned):<br/>
        <code>${qrToken || 'N/A'}</code>
      </p>

      <p style="margin-top: 20px;">
        Thank you for playing Spin &amp; Win with us! 🎁
      </p>

      <hr style="margin:20px 0; border:none; border-top:1px solid #eee;" />

      <p style="font-size: 11px; color:#555; margin:0 0 4px;">
        <strong>Terms &amp; Conditions:</strong>
      </p>
      <ul style="font-size: 11px; color:#777; padding-left:18px; margin:4px 0 0;">
        <li>Winning prizes are redeemable only on <strong>18 December (Qatar National Day)</strong>.</li>
        <li>Offers are applicable only for <strong>dine-in</strong> orders.</li>
        <li>Offer is valid only on selected items and cannot be replaced, exchanged, or upgraded.</li>
        <li>The Jackpot box prize is limited to <strong>3 members</strong> only.</li>
      </ul>
    </div>
  `;

  const attachments = qrBuffer
    ? [
        {
          filename: 'prize-qr.png',
          content: qrBuffer,
          cid: 'prizeqr' // must match src="cid:prizeqr"
        }
      ]
    : [];

  await transporter.sendMail({
    from: `"Spin to Win" <${process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER}>`,
    to,
    subject: `You won: ${prizeTitle}!`,
    html,
    attachments
  });
};

// Email when vendor redeems prize
exports.sendRedemptionEmail = async ({ to, userName, prizeTitle, vendorName }) => {
  const html = `
    <h2>Prize Redeemed</h2>
    <p>Hello ${userName},</p>
    <p>Your prize <strong>${prizeTitle}</strong> has been redeemed at vendor <strong>${vendorName}</strong>.</p>
  `;
  await transporter.sendMail({
    from: `"Spin to Win" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Prize redeemed: ${prizeTitle}`,
    html
  });
};
