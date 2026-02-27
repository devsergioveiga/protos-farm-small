import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { loadEnv } from '../../config/env';
import { logger } from '../utils/logger';

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const env = loadEnv();

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    ...(env.SMTP_USER && {
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    }),
  });

  return transporter;
}

export async function sendMail(options: MailOptions): Promise<void> {
  const env = loadEnv();

  const mailOptions = {
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    ...(options.html && { html: options.html }),
  };

  try {
    const transport = getTransporter();
    await transport.sendMail(mailOptions);
    logger.info({ to: options.to, subject: options.subject }, 'Email sent successfully');
  } catch (err) {
    logger.error({ to: options.to, subject: options.subject, err }, 'Failed to send email');
    throw err;
  }
}

/** Reset transporter — for testing only */
export function _resetTransporter(): void {
  transporter = null;
}
