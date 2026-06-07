/**
 * Postmark Email Provider
 */

export class PostmarkProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = 'https://api.postmarkapp.com';
    
    if (!this.apiKey) {
      console.warn('Postmark API key not provided. Emails will not be sent.');
    }
  }

  async send({ from, to, replyTo, subject, html, text }) {
    if (!this.apiKey) {
      console.log('[Email Preview]', { to, subject });
      return { MessageID: 'preview', success: true };
    }

    const response = await fetch(`${this.baseUrl}/email`, {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        From: from,
        To: Array.isArray(to) ? to.join(',') : to,
        ReplyTo: replyTo,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        MessageStream: 'outbound'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.Message || 'Failed to send email via Postmark');
    }

    return response.json();
  }
}

export default PostmarkProvider;

