# 🔗 Webhooks Module

This module provides webhook handling infrastructure.

## 📦 Dependencies

```json
{
  "dependencies": {
    "crypto": "built-in",
    "svix": "^1.15.0"
  }
}
```

## 🔧 Environment Variables

```env
# Webhook Secrets
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
GITHUB_WEBHOOK_SECRET=xxxxx
CLERK_WEBHOOK_SECRET=xxxxx

# Outgoing Webhooks
WEBHOOK_SIGNING_SECRET=your-signing-secret
```

## 📁 Files Added

```
your-project/
├── backend/
│   ├── routes/webhooks.js
│   └── middleware/webhookVerify.js
└── shared/webhooks/
    ├── lib/
    │   ├── webhookHandler.js
    │   ├── signatures.js
    │   └── retry.js
    └── README.md
```

## 🚀 Incoming Webhooks

### Webhook Router

```javascript
// routes/webhooks.js
import { Router } from 'express';
import { verifyStripeSignature, verifyGitHubSignature } from '../middleware/webhookVerify.js';

const router = Router();

// Stripe webhooks
router.post('/stripe',
  express.raw({ type: 'application/json' }),
  verifyStripeSignature,
  async (req, res) => {
    const event = req.stripeEvent;
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
    }
    
    res.json({ received: true });
  }
);

// GitHub webhooks
router.post('/github',
  express.json(),
  verifyGitHubSignature,
  async (req, res) => {
    const event = req.headers['x-github-event'];
    const payload = req.body;
    
    switch (event) {
      case 'push':
        await handleGitHubPush(payload);
        break;
      case 'pull_request':
        await handlePullRequest(payload);
        break;
      case 'issues':
        await handleIssue(payload);
        break;
    }
    
    res.json({ received: true });
  }
);

// Generic webhook endpoint
router.post('/incoming/:source',
  express.json(),
  async (req, res) => {
    const { source } = req.params;
    
    // Log webhook
    await prisma.webhookLog.create({
      data: {
        source,
        payload: req.body,
        headers: req.headers,
        receivedAt: new Date()
      }
    });
    
    // Process webhook
    await processWebhook(source, req.body);
    
    res.json({ received: true });
  }
);

export default router;
```

### Signature Verification

```javascript
// middleware/webhookVerify.js
import crypto from 'crypto';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe signature verification
export const verifyStripeSignature = (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    req.stripeEvent = event;
    next();
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }
};

// GitHub signature verification
export const verifyGitHubSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};

// Generic HMAC signature verification
export const verifyHmacSignature = (secret, header = 'x-signature') => {
  return (req, res, next) => {
    const signature = req.headers[header];
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    const hmac = crypto.createHmac('sha256', secret);
    const expected = hmac.update(JSON.stringify(req.body)).digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
  };
};
```

## 📤 Outgoing Webhooks

### Webhook Sender

```javascript
// lib/webhookSender.js
import crypto from 'crypto';

class WebhookSender {
  constructor(config = {}) {
    this.signingSecret = config.signingSecret || process.env.WEBHOOK_SIGNING_SECRET;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Sign webhook payload
   */
  sign(payload, timestamp) {
    const toSign = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(toSign)
      .digest('hex');
  }

  /**
   * Send webhook with retry logic
   */
  async send(url, event, data, options = {}) {
    const timestamp = Date.now();
    const payload = { event, data, timestamp };
    const signature = this.sign(payload, timestamp);

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': timestamp.toString(),
            'X-Webhook-Event': event,
            ...options.headers
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(options.timeout || 30000)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        // Log success
        await this.logDelivery({
          url, event, status: 'success', attempt, responseStatus: response.status
        });

        return { success: true, attempt };
      } catch (error) {
        lastError = error;
        
        // Log attempt
        await this.logDelivery({
          url, event, status: 'failed', attempt, error: error.message
        });

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries failed
    throw new Error(`Webhook delivery failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  async logDelivery(data) {
    await prisma.webhookDelivery.create({ data });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const webhookSender = new WebhookSender();
```

### Webhook Subscriptions

```javascript
// routes/webhookSubscriptions.js
router.get('/subscriptions', authMiddleware, async (req, res) => {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { userId: req.user.id }
  });
  res.json(subscriptions);
});

router.post('/subscriptions', authMiddleware, async (req, res) => {
  const { url, events, secret } = req.body;
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const subscription = await prisma.webhookSubscription.create({
    data: {
      userId: req.user.id,
      url,
      events,
      secret: secret || crypto.randomBytes(32).toString('hex'),
      active: true
    }
  });

  res.json(subscription);
});

// Trigger webhooks for an event
export async function triggerWebhooks(event, data) {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      active: true,
      events: { has: event }
    }
  });

  await Promise.allSettled(
    subscriptions.map(sub => 
      webhookSender.send(sub.url, event, data, { 
        headers: { 'X-Webhook-Secret': sub.secret }
      })
    )
  );
}
```

## 🗄️ Database Schema

```prisma
model WebhookSubscription {
  id        String   @id @default(cuid())
  userId    String
  url       String
  events    String[]
  secret    String
  active    Boolean  @default(true)
  
  user      User     @relation(fields: [userId], references: [id])
  deliveries WebhookDelivery[]
  
  createdAt DateTime @default(now())
}

model WebhookDelivery {
  id             String   @id @default(cuid())
  subscriptionId String?
  subscription   WebhookSubscription? @relation(fields: [subscriptionId], references: [id])
  
  url            String
  event          String
  payload        Json
  status         String   // 'success', 'failed', 'pending'
  attempt        Int
  responseStatus Int?
  error          String?
  
  createdAt      DateTime @default(now())
}

model WebhookLog {
  id         String   @id @default(cuid())
  source     String
  payload    Json
  headers    Json
  processed  Boolean  @default(false)
  error      String?
  receivedAt DateTime @default(now())
}
```

## 🧪 Testing Webhooks

```bash
# Test Stripe webhooks locally
stripe listen --forward-to localhost:8000/api/webhooks/stripe

# Test with ngrok
ngrok http 8000
# Then configure webhook URL in provider dashboard
```

## ❓ Need Help?

- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [GitHub Webhooks](https://docs.github.com/webhooks)
- [Svix (Webhook Infrastructure)](https://svix.com)

