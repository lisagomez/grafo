/**
 * Email Templates
 */

import { baseLayout } from './base-layout.js';

// Welcome Email
export const welcome = {
  subject: 'Welcome to {{appName}}! 🎉',
  html: baseLayout(`
    <h1 style="color: #1f2937; margin-bottom: 16px;">Welcome, {{name}}!</h1>
    <p style="color: #4b5563; line-height: 1.6;">
      Thanks for signing up for {{appName}}. We're excited to have you on board!
    </p>
    <p style="color: #4b5563; line-height: 1.6;">
      Get started by exploring your dashboard and setting up your first project.
    </p>
    <div style="margin: 32px 0;">
      <a href="{{loginUrl}}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Go to Dashboard →
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      If you have any questions, just reply to this email. We're always happy to help!
    </p>
  `),
  text: `Welcome to {{appName}}!

Hi {{name}},

Thanks for signing up. We're excited to have you on board!

Get started here: {{loginUrl}}

If you have any questions, just reply to this email.

Best,
The {{appName}} Team`
};

// Verify Email
export const verifyEmail = {
  subject: 'Verify your email address',
  html: baseLayout(`
    <h1 style="color: #1f2937; margin-bottom: 16px;">Verify your email</h1>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi {{name}}, please verify your email address by clicking the button below.
    </p>
    <div style="margin: 32px 0;">
      <a href="{{verifyUrl}}" style="background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Verify Email Address
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in {{expiresIn}}. If you didn't create an account, you can safely ignore this email.
    </p>
  `),
  text: `Verify your email

Hi {{name}},

Please verify your email by clicking this link: {{verifyUrl}}

This link will expire in {{expiresIn}}.

If you didn't create an account, you can safely ignore this email.`
};

// Reset Password
export const resetPassword = {
  subject: 'Reset your password',
  html: baseLayout(`
    <h1 style="color: #1f2937; margin-bottom: 16px;">Reset your password</h1>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi {{name}}, we received a request to reset your password. Click the button below to set a new password.
    </p>
    <div style="margin: 32px 0;">
      <a href="{{resetUrl}}" style="background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in {{expiresIn}}. If you didn't request this, you can safely ignore this email.
    </p>
  `),
  text: `Reset your password

Hi {{name}},

We received a request to reset your password. Click here to set a new password: {{resetUrl}}

This link will expire in {{expiresIn}}.

If you didn't request this, you can safely ignore this email.`
};

// Team Invite
export const teamInvite = {
  subject: '{{inviterName}} invited you to join {{teamName}}',
  html: baseLayout(`
    <h1 style="color: #1f2937; margin-bottom: 16px;">You're invited!</h1>
    <p style="color: #4b5563; line-height: 1.6;">
      <strong>{{inviterName}}</strong> has invited you to join <strong>{{teamName}}</strong> as a <strong>{{role}}</strong>.
    </p>
    <div style="margin: 32px 0;">
      <a href="{{inviteUrl}}" style="background: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Accept Invitation
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      This invitation will expire in 7 days.
    </p>
  `),
  text: `You're invited!

{{inviterName}} has invited you to join {{teamName}} as a {{role}}.

Accept here: {{inviteUrl}}

This invitation will expire in 7 days.`
};

// Invoice
export const invoice = {
  subject: 'Invoice {{invoiceNumber}} from {{appName}}',
  html: baseLayout(`
    <h1 style="color: #1f2937; margin-bottom: 16px;">Invoice {{invoiceNumber}}</h1>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi {{customerName}}, here's your invoice for {{appName}}.
    </p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Amount Due</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937; font-size: 24px;">{{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Due Date</td>
          <td style="padding: 8px 0; text-align: right; color: #1f2937;">{{dueDate}}</td>
        </tr>
      </table>
    </div>
    <div style="margin: 32px 0;">
      <a href="{{invoiceUrl}}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        View Invoice
      </a>
    </div>
  `),
  text: `Invoice {{invoiceNumber}}

Hi {{customerName}},

Amount Due: {{amount}}
Due Date: {{dueDate}}

View invoice: {{invoiceUrl}}`
};

// Payment Success
export const paymentSuccess = {
  subject: 'Payment received - Thank you!',
  html: baseLayout(`
    <div style="text-align: center; padding: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
      <h1 style="color: #1f2937; margin-bottom: 16px;">Payment Successful!</h1>
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi {{customerName}}, we've received your payment of <strong>{{amount}}</strong>.
    </p>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="color: #166534; margin: 0;">
        Your subscription is now active. Thank you for your business!
      </p>
    </div>
    <div style="margin: 32px 0;">
      <a href="{{dashboardUrl}}" style="background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Go to Dashboard
      </a>
    </div>
  `),
  text: `Payment Successful!

Hi {{customerName}},

We've received your payment of {{amount}}.

Your subscription is now active. Thank you for your business!

Go to dashboard: {{dashboardUrl}}`
};

