// server/config/mailer.js
const nodemailer = require('nodemailer');

if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn(' Email environment variables are not fully set. Mailer will not work.');
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: Number(process.env.EMAIL_PORT) === 465, // only true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    // In production you usually want this true
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Optional: verify at startup
transporter.verify((err, success) => {
  if (err) {
    console.warn(' Email transporter verification failed:', err.message);
  } else {
    console.log(' Email transporter ready');
  }
});

module.exports = transporter;
