'use strict';

const transporter = require('../../config/mailer');

const escapeHtml = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]
  );

function getSender() {
  return (
    process.env.SMTP_FROM?.trim() ||
    `"HNC Rewards" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`
  );
}

function emailTemplate({ preview, title, subtitle, content }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>

  <body style="margin:0;padding:0;background-color:#f5f1f2;">
    <div
      style="display:none;font-size:1px;line-height:1px;max-height:0;
        max-width:0;opacity:0;overflow:hidden;mso-hide:all;"
    >${escapeHtml(preview)}</div>

    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background-color:#f5f1f2;"
    >
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="width:100%;max-width:580px;background-color:#ffffff;
              border:1px solid #e7dce0;border-radius:20px;"
          >
            <tr>
              <td
                align="center"
                bgcolor="#401421"
                style="padding:30px 24px;background-color:#401421;
                  border-radius:19px 19px 0 0;"
              >
                <p
                  style="margin:0;color:#f0c87b;font-family:Arial,sans-serif;
                    font-size:12px;font-weight:bold;letter-spacing:3px;"
                >
                  HOT N COOL
                </p>

                <p
                  style="margin:8px 0 0;color:#ffffff;
                    font-family:Arial,sans-serif;font-size:28px;
                    font-weight:bold;line-height:1.2;"
                >
                  HNC Rewards
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 24px 12px;">
                <h1
                  style="margin:0;color:#401421;font-family:Arial,sans-serif;
                    font-size:25px;line-height:1.3;text-align:center;"
                >
                  ${escapeHtml(title)}
                </h1>

                <p
                  style="margin:12px 0 0;color:#6b5960;
                    font-family:Arial,sans-serif;font-size:15px;
                    line-height:1.7;text-align:center;"
                >
                  ${escapeHtml(subtitle)}
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="padding:12px 24px 30px;color:#34272c;
                  font-family:Arial,sans-serif;font-size:15px;line-height:1.7;"
              >
                ${content}
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="padding:22px 24px;border-top:1px solid #eee5e8;"
              >
                <p
                  style="margin:0;color:#401421;font-family:Arial,sans-serif;
                    font-size:13px;font-weight:bold;"
                >
                  Thank you for choosing HOT N COOL
                </p>

                <p
                  style="margin:7px 0 0;color:#78666e;
                    font-family:Arial,sans-serif;font-size:12px;line-height:1.6;"
                >
                  For assistance, WhatsApp
                  <a
                    href="https://wa.me/97459996635"
                    style="color:#a52140;text-decoration:underline;"
                  >+974 5999 6635</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// OTP delivery for registration and verification.
exports.sendOtpEmail = async (to, otp) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment && process.env.HNC_EMAIL_MOCK === 'true') {
    console.log('[EMAIL MOCK] OTP delivery simulated');
    return { accepted: [], mocked: true };
  }

  if (isDevelopment) {
    const allowedEmail = String(process.env.HNC_TEST_EMAIL || '')
      .trim()
      .toLowerCase();

    const recipient = String(to || '').trim().toLowerCase();

    if (!allowedEmail || recipient !== allowedEmail) {
      const error = new Error('Development OTP recipient not allowed');
      error.code = 'DEV_EMAIL_NOT_ALLOWED';
      throw error;
    }
  }

  const code = String(otp ?? '');

  const html = emailTemplate({
    preview: 'Your HNC Rewards verification code expires in 10 minutes.',
    title: 'Verify your email',
    subtitle: 'Enter this verification code to continue with HNC Rewards.',
    content: `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="margin:12px 0 22px;"
      >
        <tr>
          <td
            align="center"
            bgcolor="#fff6f0"
            style="padding:24px 10px;background-color:#fff6f0;
              border:1px solid #efd6bc;border-radius:14px;"
          >
            <p
              style="margin:0 0 10px;color:#7d5c43;font-size:11px;
                font-weight:bold;letter-spacing:2px;"
            >
              VERIFICATION CODE
            </p>

            <p
              dir="ltr"
              style="margin:0;color:#8f1d37;font-family:'Courier New',monospace;
                font-size:36px;font-weight:bold;line-height:1.4;
                letter-spacing:5px;white-space:nowrap;"
            >${escapeHtml(code)}</p>

            <p style="margin:12px 0 0;color:#715c50;font-size:13px;">
              Valid for <strong>10 minutes</strong>
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 12px;">
        Keep this code private. HNC staff will never ask you to share it.
      </p>

      <p style="margin:0;color:#78666e;font-size:13px;">
        If you did not request this code, you can ignore this email.
      </p>
    `,
  });

  return transporter.sendMail({
    from: getSender(),
    to,
    subject: 'Your HNC Rewards verification code',
    text: [
      'HNC Rewards — Email verification',
      '',
      `Your verification code is ${code}.`,
      'It expires in 10 minutes.',
      '',
      'Keep this code private.',
      'If you did not request this code, you can ignore this email.',
    ].join('\n'),
    html,
  });
};

// Prize email with an inline PNG QR attachment.
exports.sendPrizeEmail = async ({
  to,
  name,
  prizeTitle,
  prizeDescription,
  qrBuffer,
  qrToken,
}) => {
  const customerName = name || 'Friend';
  const title = prizeTitle || 'HNC Reward';

  const qrContent = qrBuffer
    ? `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tr>
          <td align="center" style="padding:22px 0 12px;">
            <img
              src="cid:prizeqr"
              alt="Show this QR code to redeem your prize"
              width="220"
              height="220"
              style="display:block;width:220px;max-width:100%;height:auto;
                background-color:#ffffff;"
            />
          </td>
        </tr>
      </table>
    `
    : '';

  const backupContent = qrToken
    ? `
      <div
        style="margin:18px 0;padding:16px;background-color:#faf4f6;
          border:1px dashed #c89aaa;border-radius:12px;"
      >
        <p style="margin:0 0 7px;color:#78666e;font-size:12px;">
          Backup redemption code
        </p>

        <p
          dir="ltr"
          style="margin:0;color:#8f1d37;font-family:'Courier New',monospace;
            font-size:13px;line-height:1.8;word-break:break-all;
            overflow-wrap:anywhere;"
        >${escapeHtml(qrToken)}</p>
      </div>
    `
    : '';

  const html = emailTemplate({
    preview: `Congratulations! You won ${title} with HNC Rewards.`,
    title: 'Your reward is here!',
    subtitle: `Congratulations, ${customerName}!`,
    content: `
      <div
        style="margin:12px 0 20px;padding:22px 18px;text-align:center;
          background-color:#fff6e8;border:1px solid #ead09d;
          border-radius:14px;"
      >
        <p
          style="margin:0 0 8px;color:#856425;font-size:11px;
            font-weight:bold;letter-spacing:2px;"
        >
          YOU WON
        </p>

        <h2 style="margin:0;color:#641a2c;font-size:24px;line-height:1.4;">
          ${escapeHtml(title)}
        </h2>

        ${
          prizeDescription
            ? `
              <p style="margin:10px 0 0;color:#715c50;font-size:14px;">
                ${escapeHtml(prizeDescription)}
              </p>
            `
            : ''
        }
      </div>

      <p style="margin:0;text-align:center;">
        Show your QR code at the HNC branch to redeem your prize.
      </p>

      ${qrContent}
      ${backupContent}

      <div
        style="margin-top:24px;padding:18px;background-color:#f8f6f7;
          border-radius:12px;"
      >
        <h3 style="margin:0 0 10px;color:#401421;font-size:15px;">
          Terms &amp; Conditions
        </h3>

        <ul
          style="margin:0;padding-left:19px;color:#6b5960;
            font-size:12px;line-height:1.9;"
        >
          <li>
            Prizes are redeemable from
            <strong>18 December to 21 December</strong>
            at your nearest HNC branch.
          </li>
          <li>Offers apply to <strong>dine-in orders</strong>.</li>
          <li>
            Valid on selected items. Prizes cannot be replaced,
            exchanged, or upgraded.
          </li>
          <li>
            The Jackpot box prize is limited to
            <strong>3 members</strong>.
          </li>
          <li>
            For further details, WhatsApp
            <a href="https://wa.me/97459996635" style="color:#a52140;">
              +974 5999 6635
            </a>.
          </li>
          <li>Terms and conditions apply.</li>
        </ul>
      </div>
    `,
  });

  const attachments = qrBuffer
    ? [
        {
          filename: 'hnc-prize-qr.png',
          content: qrBuffer,
          contentType: 'image/png',
          cid: 'prizeqr',
          contentDisposition: 'inline',
        },
      ]
    : [];

  return transporter.sendMail({
    from: getSender(),
    to,
    subject: `You won ${title} — HNC Rewards`,
    text: [
      `Congratulations, ${customerName}!`,
      '',
      `You won: ${title}`,
      prizeDescription || '',
      '',
      'Show the attached QR code at the HNC branch to redeem your prize.',
      qrToken ? `Backup redemption code: ${qrToken}` : '',
      '',
      'Terms & Conditions',
      'Redeemable from 18 December to 21 December at your nearest HNC branch.',
      'Dine-in orders only. Valid on selected items.',
      'Prizes cannot be replaced, exchanged, or upgraded.',
      'The Jackpot box prize is limited to 3 members.',
      'For further details, WhatsApp +974 5999 6635.',
      'Terms and conditions apply.',
    ].join('\n'),
    html,
    attachments,
  });
};

// Confirmation after a vendor redeems the prize.
exports.sendRedemptionEmail = async ({
  to,
  userName,
  prizeTitle,
  vendorName,
}) => {
  const customerName = userName || 'Friend';
  const title = prizeTitle || 'HNC Reward';
  const branch = vendorName || 'HNC branch';

  const html = emailTemplate({
    preview: `Your ${title} prize has been redeemed.`,
    title: 'Prize redeemed',
    subtitle: `Hello ${customerName}, your redemption is confirmed.`,
    content: `
      <div
        style="margin:12px 0 20px;padding:16px;text-align:center;
          background-color:#edf8f0;border:1px solid #b7ddc1;
          border-radius:12px;color:#25653b;font-weight:bold;"
      >
        Redemption successful
      </div>

      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="border:1px solid #eadde2;border-radius:12px;"
      >
        <tr>
          <td
            width="30%"
            style="padding:16px 12px;color:#78666e;font-size:13px;
              vertical-align:top;"
          >
            Your prize
          </td>

          <td
            style="padding:16px 12px;color:#401421;font-weight:bold;
              word-break:break-word;"
          >
            ${escapeHtml(title)}
          </td>
        </tr>

        <tr>
          <td
            style="padding:16px 12px;border-top:1px solid #eadde2;
              color:#78666e;font-size:13px;vertical-align:top;"
          >
            Redeemed at
          </td>

          <td
            style="padding:16px 12px;border-top:1px solid #eadde2;
              color:#401421;font-weight:bold;word-break:break-word;"
          >
            ${escapeHtml(branch)}
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0;text-align:center;">
        Enjoy your reward! We look forward to welcoming you again.
      </p>
    `,
  });

  return transporter.sendMail({
    from: getSender(),
    to,
    subject: `Prize redeemed: ${title} — HNC Rewards`,
    text: [
      `Hello ${customerName},`,
      '',
      'Your prize redemption is confirmed.',
      `Prize: ${title}`,
      `Redeemed at: ${branch}`,
      '',
      'Thank you for choosing HOT N COOL.',
      'For assistance, WhatsApp +974 5999 6635.',
    ].join('\n'),
    html,
  });
};