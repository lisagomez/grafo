/**
 * Resend Email Provider
 */

export class ResendProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = 'https://api.resend.com';
    
    if (!this.apiKey) {
      console.warn('Resend API key not provided. Emails will not be sent.');
    }
  }

  async send({ from, to, replyTo, subject, html, text }) {
    if (!this.apiKey) {
      console.log('[Email Preview]', { to, subject });
      return { id: 'preview', success: true };
    }

    const response = await fetch(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        reply_to: replyTo,
        subject,
        html,
        text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send email via Resend');
    }

    return response.json();
  }
}

export default ResendProvider;

