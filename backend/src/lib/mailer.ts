import nodemailer from "nodemailer";

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in backend/.env.");
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  return { host, port, secure: process.env.SMTP_SECURE === "true" || port === 465, auth: { user, pass }, from };
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const config = smtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Reset your TeachTrack password",
    text: `We received a request to reset your TeachTrack password. Use this link within one hour: ${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your TeachTrack password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in one hour. If you did not request it, you can safely ignore this email.</p>`,
  });
}
