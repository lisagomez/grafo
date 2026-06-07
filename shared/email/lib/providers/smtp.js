/**
 * SMTP Email Provider (using Nodemailer)
 */

import nodemailer from 'nodemailer';

export class SMTPProvider {
  constructor(config) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port) || 587,
      secure: config.port === '465',
      auth: {
        user: config.user,
        pass: config.password
      }
    });
  }

  async send({ from, to, replyTo, subject, html, text }) {
    const result = await this.transporter.sendMail({
      from,
      to: Array.isArray(to) ? to.join(',') : to,
      replyTo,
      subject,
      html,
      text
    });

    return {
      id: result.messageId,
      success: true
    };
  }

  async verify() {
    return this.transporter.verify();
  }
}

export default SMTPProvider;

