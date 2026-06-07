/**
 * Email Service
 * Unified email sending with multiple provider support
 */

import { ResendProvider } from './providers/resend.js';
import { PostmarkProvider } from './providers/postmark.js';
import { SMTPProvider } from './providers/smtp.js';
import * as templates from './templates/index.js';

export class EmailService {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || process.env.EMAIL_PROVIDER || 'resend',
      from: config.from || {
        email: process.env.FROM_EMAIL || 'noreply@example.com',
        name: process.env.FROM_NAME || 'Your App'
      },
      replyTo: config.replyTo || process.env.REPLY_TO_EMAIL,
      ...config
    };

    this.provider = this._initProvider();
    this.templates = templates;
  }

  /**
   * Initialize the email provider
   */
  _initProvider() {
    switch (this.config.provider) {
      case 'resend':
        return new ResendProvider({
          apiKey: this.config.apiKey || process.env.RESEND_API_KEY
        });
      case 'postmark':
        return new PostmarkProvider({
          apiKey: this.config.apiKey || process.env.POSTMARK_API_KEY
        });
      case 'smtp':
        return new SMTPProvider({
          host: this.config.host || process.env.SMTP_HOST,
          port: this.config.port || process.env.SMTP_PORT,
          user: this.config.user || process.env.SMTP_USER,
          password: this.config.password || process.env.SMTP_PASSWORD
        });
      default:
        throw new Error(`Unknown email provider: ${this.config.provider}`);
    }
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} [options.template] - Template name
   * @param {Object} [options.data] - Template data
   * @param {string} [options.subject] - Email subject
   * @param {string} [options.html] - HTML content
   * @param {string} [options.text] - Plain text content
   */
  async send(options) {
    const { to, template, data = {}, subject, html, text } = options;

    let emailContent = { subject, html, text };

    // If template is specified, render it
    if (template && this.templates[template]) {
      emailContent = this._renderTemplate(template, {
        appName: this.config.from.name,
        ...data
      });
    }

    // Validate
    if (!to) throw new Error('Recipient email (to) is required');
    if (!emailContent.subject) throw new Error('Subject is required');
    if (!emailContent.html && !emailContent.text) {
      throw new Error('Either html or text content is required');
    }

    // Send via provider
    return this.provider.send({
      from: `${this.config.from.name} <${this.config.from.email}>`,
      to,
      replyTo: this.config.replyTo,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    });
  }

  /**
   * Send email to multiple recipients
   */
  async sendBatch(recipients, options) {
    const results = await Promise.allSettled(
      recipients.map(to => this.send({ ...options, to }))
    );

    return results.map((result, index) => ({
      to: recipients[index],
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * Render a template with data
   */
  _renderTemplate(templateName, data) {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    let { subject, html, text } = template;

    // Replace placeholders {{variable}}
    const replacePlaceholders = (str) => {
      if (!str) return str;
      return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
      });
    };

    return {
      subject: replacePlaceholders(subject),
      html: replacePlaceholders(html),
      text: replacePlaceholders(text)
    };
  }
}

export default EmailService;

