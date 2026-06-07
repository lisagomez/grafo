# 📧 Email Module

This module provides transactional email support with pre-built templates.

## 📦 Dependencies

Add these to your `package.json`:

### Backend (Node.js/Express)
```json
{
  "dependencies": {
    "resend": "^3.2.0",
    "nodemailer": "^6.9.13"
  }
}
```

**OR** for Postmark:
```json
{
  "dependencies": {
    "postmark": "^4.0.2"
  }
}
```

### Backend (Python/FastAPI)
```txt
# Add to requirements.txt
resend==0.7.0
# OR
postmarker==1.0
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Email Provider (choose one)
EMAIL_PROVIDER=resend  # or 'postmark', 'smtp'

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx

# Postmark
POSTMARK_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
POSTMARK_FROM_EMAIL=noreply@yourapp.com

# SMTP (fallback)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password

# Common
FROM_EMAIL=noreply@yourapp.com
FROM_NAME=Your App Name
REPLY_TO_EMAIL=support@yourapp.com
```

## 📁 Files Added

```
your-project/
├── shared/email/
│   ├── lib/
│   │   ├── email.js          # Email service abstraction
│   │   ├── providers/
│   │   │   ├── resend.js
│   │   │   ├── postmark.js
│   │   │   └── smtp.js
│   │   └── templates/
│   │       ├── welcome.js
│   │       ├── reset-password.js
│   │       ├── verify-email.js
│   │       ├── invoice.js
│   │       ├── team-invite.js
│   │       └── base-layout.js
│   └── README.md
```

## 🚀 Usage

### Initialize Email Service

```javascript
import { EmailService } from './lib/email.js';

const emailService = new EmailService({
  provider: process.env.EMAIL_PROVIDER || 'resend',
  apiKey: process.env.RESEND_API_KEY,
  from: {
    email: process.env.FROM_EMAIL,
    name: process.env.FROM_NAME
  }
});
```

### Send Welcome Email

```javascript
await emailService.send({
  template: 'welcome',
  to: user.email,
  data: {
    name: user.name,
    loginUrl: `${process.env.FRONTEND_URL}/auth/login`
  }
});
```

### Send Password Reset Email

```javascript
await emailService.send({
  template: 'reset-password',
  to: user.email,
  data: {
    name: user.name,
    resetUrl: `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`,
    expiresIn: '1 hour'
  }
});
```

### Send Invoice Email

```javascript
await emailService.send({
  template: 'invoice',
  to: customer.email,
  data: {
    customerName: customer.name,
    invoiceNumber: 'INV-001',
    amount: '$99.00',
    dueDate: 'December 15, 2024',
    items: [
      { name: 'Pro Plan', quantity: 1, price: '$99.00' }
    ],
    invoiceUrl: invoiceUrl
  }
});
```

### Send Team Invite

```javascript
await emailService.send({
  template: 'team-invite',
  to: inviteeEmail,
  data: {
    inviterName: currentUser.name,
    teamName: team.name,
    role: 'Member',
    inviteUrl: `${process.env.FRONTEND_URL}/invite?token=${token}`
  }
});
```

### Custom Email

```javascript
await emailService.send({
  to: 'user@example.com',
  subject: 'Custom Email',
  html: '<h1>Hello!</h1><p>This is a custom email.</p>',
  // OR use text
  text: 'Hello! This is a custom email.'
});
```

## 📝 Email Templates

### Template Structure

```javascript
// templates/welcome.js
export const welcomeEmail = {
  subject: 'Welcome to {{appName}}!',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Welcome, {{name}}!</h1>
      <p>Thanks for signing up. We're excited to have you on board.</p>
      <a href="{{loginUrl}}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Get Started
      </a>
    </div>
  `
};
```

### Creating Custom Templates

```javascript
// templates/custom.js
export const customTemplate = {
  subject: 'Your {{subject}}',
  html: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 20px; background: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
          {{content}}
        </div>
      </body>
    </html>
  `
};
```

## 🔧 API Routes

```javascript
// routes/email.js (for testing)
router.post('/send-test', authMiddleware, async (req, res) => {
  const { template, to, data } = req.body;
  
  try {
    await emailService.send({ template, to, data });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 📊 Email Provider Comparison

| Feature | Resend | Postmark | SMTP |
|---------|--------|----------|------|
| Free Tier | 3,000/mo | 100/mo | Varies |
| API | REST | REST | Protocol |
| Templates | ✅ | ✅ | ❌ |
| Analytics | ✅ | ✅ | ❌ |
| Setup | Easy | Easy | Complex |

## ❓ Need Help?

- [Resend Documentation](https://resend.com/docs)
- [Postmark Documentation](https://postmarkapp.com/developer)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

