const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

// Sends mail when SMTP is configured; otherwise logs it so local development
// still works (e.g. to grab a password-reset link from the console).
async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[mail] SMTP not configured — would send to ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}

module.exports = { sendMail };
