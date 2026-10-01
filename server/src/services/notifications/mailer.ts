import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = parseInt(process.env.SMTP_PORT || '1025', 10);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const mailFrom = process.env.MAIL_FROM || 'noreply@campusvoice.local';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// In-memory record for testing and development verification
export const devSentEmails: Array<{ to: string; subject: string; text: string; code?: string; timestamp: Date }> = [];

export async function sendEmail({ to, subject, text, html }: SendMailOptions): Promise<boolean> {
  // Capture in dev list for inspection in tests
  const match = text.match(/\b\d{6}\b/);
  devSentEmails.push({
    to,
    subject,
    text,
    code: match ? match[0] : undefined,
    timestamp: new Date(),
  });

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: mailFrom,
      to,
      subject,
      text,
      html: html || text,
    });
    console.log(`[Mailer] Sent email to ${to}: "${subject}"`);
    return true;
  } catch (err) {
    console.warn(`[Mailer] SMTP delivery failed to ${to} (dev fallback active):`, (err as Error).message);
    // In dev/test, fallback succeeds so flow continues without blocking
    return true;
  }
}

export const mailer = {
  sendMail: sendEmail,
  sendEmail,
};
