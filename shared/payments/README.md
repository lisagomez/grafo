# 💳 Payments Module (Stripe)

Complete Stripe integration for subscriptions, one-time payments, and billing management.

---

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Dependencies](#-dependencies)
3. [Environment Variables](#-environment-variables)
4. [Step-by-Step Setup](#-step-by-step-setup)
5. [API Reference](#-api-reference)
6. [Webhook Setup](#-webhook-setup)
7. [Frontend Integration](#-frontend-integration)
8. [Testing](#-testing)

---

## 🚀 Quick Start

```bash
# Add payments module
npx saas-factory add payments

# Install dependencies
cd backend && npm install stripe

# Configure Stripe keys in .env
# Set up webhook endpoint

# Start development
npm run dev
```

---

## 📦 Dependencies

### Backend (Node.js)

```bash
cd backend
npm install stripe
```

### Frontend (Next.js)

```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

---

## 🔧 Environment Variables

```env
# ================================
# Stripe Configuration
# ================================
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# ================================
# Stripe Price IDs
# ================================
# Create these in Stripe Dashboard > Products
STRIPE_PRICE_FREE=price_free_tier_id
STRIPE_PRICE_PRO_MONTHLY=price_1234567890
STRIPE_PRICE_PRO_YEARLY=price_0987654321
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_enterprise_monthly
STRIPE_PRICE_ENTERPRISE_YEARLY=price_enterprise_yearly

# ================================
# URLs
# ================================
FRONTEND_URL=http://localhost:3000
```

---

## 📝 Step-by-Step Setup

### Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete your account setup
3. Get your API keys from **Developers > API Keys**

### Step 2: Create Products & Prices

In Stripe Dashboard:

1. Go to **Products > Add Product**
2. Create your subscription tiers:

   **Free Plan:**
   - Name: "Free"
   - Price: $0/month
   - Billing: Recurring (monthly)

   **Pro Plan:**
   - Name: "Pro"
   - Monthly: $29/month
   - Yearly: $290/year (save 17%)

   **Enterprise Plan:**
   - Name: "Enterprise"
   - Monthly: $99/month
   - Yearly: $990/year

3. Copy each Price ID to your `.env` file

### Step 3: Configure Webhook

1. Go to **Developers > Webhooks**
2. Click **Add endpoint**
3. URL: `https://yourapp.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the **Signing secret** to `STRIPE_WEBHOOK_SECRET`

### Step 4: Database Schema

Add to your Prisma schema:

```prisma
model User {
  id               String   @id @default(cuid())
  email            String   @unique
  // ... other fields
  
  stripeCustomerId String?  @unique
  subscription     Subscription?
}

model Subscription {
  id                   String   @id @default(cuid())
  
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id])
  
  stripeSubscriptionId String   @unique
  stripePriceId        String
  stripeCustomerId     String
  
  plan                 String   // 'free', 'pro', 'enterprise'
  status               String   // 'active', 'canceled', 'past_due'
  
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean  @default(false)
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

model Invoice {
  id              String   @id @default(cuid())
  
  userId          String
  stripeInvoiceId String   @unique
  
  amount          Int
  currency        String   @default("usd")
  status          String   // 'paid', 'open', 'void', 'uncollectible'
  
  invoiceUrl      String?
  invoicePdf      String?
  
  paidAt          DateTime?
  createdAt       DateTime @default(now())
}
```

### Step 5: Apply Database Changes

```bash
cd backend
npx prisma db push
```

### Step 6: Register Routes

```javascript
// backend/src/index.js
import billingRoutes from './routes/billing.js';
import { stripeWebhook } from './webhooks/stripe.js';

// Webhook (must be before JSON body parser)
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }), 
  stripeWebhook
);

// Billing routes (protected)
app.use('/api/billing', authMiddleware, billingRoutes);
```

---

## 📡 API Reference

### Get Current Subscription

```http
GET /api/billing/subscription
Authorization: Bearer <token>
```

**Response:**
```json
{
  "subscription": {
    "id": "sub_xxx",
    "plan": "pro",
    "status": "active",
    "currentPeriodEnd": "2024-12-31T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

### Create Checkout Session

```http
POST /api/billing/create-checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "priceId": "price_1234567890"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/..."
}
```

### Create Customer Portal Session

```http
POST /api/billing/create-portal
Authorization: Bearer <token>
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

### Get Invoice History

```http
GET /api/billing/invoices
Authorization: Bearer <token>
```

### Cancel Subscription

```http
POST /api/billing/cancel
Authorization: Bearer <token>
```

---

## 🔗 Webhook Setup

### Webhook Handler

```javascript
// webhooks/stripe.js
import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function stripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

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

async function handleCheckoutComplete(session) {
  const userId = session.metadata.userId;
  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      stripePriceId: subscription.items.data[0].price.id,
      plan: getPlanFromPriceId(subscription.items.data[0].price.id),
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      plan: getPlanFromPriceId(subscription.items.data[0].price.id),
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    }
  });
}
```

### Local Webhook Testing

```bash
# Install Stripe CLI
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Login
stripe login

# Forward webhooks to localhost
stripe listen --forward-to localhost:8000/api/webhooks/stripe
```

---

## 🖥️ Frontend Integration

### Pricing Page

```tsx
// app/pricing/page.tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    priceId: { monthly: null, yearly: null },
    features: ['3 projects', '1 team member', 'Basic support'],
    cta: 'Get Started'
  },
  {
    name: 'Pro',
    price: { monthly: 29, yearly: 290 },
    priceId: { 
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY
    },
    features: ['Unlimited projects', '10 team members', 'Priority support', 'API access'],
    cta: 'Start Free Trial',
    popular: true
  },
  {
    name: 'Enterprise',
    price: { monthly: 99, yearly: 990 },
    priceId: { 
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_MONTHLY,
      yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE_YEARLY
    },
    features: ['Everything in Pro', 'Unlimited members', 'SSO', 'SLA', 'Dedicated support'],
    cta: 'Contact Sales'
  }
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);

  const handleSubscribe = async (plan) => {
    const priceId = isYearly ? plan.priceId.yearly : plan.priceId.monthly;
    
    if (!priceId) {
      window.location.href = '/auth/register';
      return;
    }

    const res = await fetch('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });

    const { url } = await res.json();
    window.location.href = url;
  };

  return (
    <div className="py-24 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple Pricing</h1>
        
        {/* Billing Toggle */}
        <div className="flex justify-center items-center gap-4">
          <span className={!isYearly ? 'font-bold' : ''}>Monthly</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`w-14 h-8 rounded-full transition-colors ${
              isYearly ? 'bg-primary-500' : 'bg-gray-300'
            }`}
          >
            <span className={`block w-6 h-6 bg-white rounded-full transform transition-transform ${
              isYearly ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
          <span className={isYearly ? 'font-bold' : ''}>
            Yearly <span className="text-green-500 text-sm">Save 17%</span>
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {PLANS.map(plan => (
          <div 
            key={plan.name}
            className={`p-8 rounded-2xl border-2 ${
              plan.popular ? 'border-primary-500 shadow-xl' : 'border-gray-200'
            }`}
          >
            {plan.popular && (
              <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-sm">
                Most Popular
              </span>
            )}
            
            <h3 className="text-2xl font-bold mt-4">{plan.name}</h3>
            
            <div className="mt-4">
              <span className="text-4xl font-bold">
                ${isYearly ? plan.price.yearly : plan.price.monthly}
              </span>
              <span className="text-gray-500">
                /{isYearly ? 'year' : 'month'}
              </span>
            </div>

            <ul className="mt-6 space-y-3">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan)}
              className={`w-full mt-8 py-3 rounded-lg font-semibold ${
                plan.popular
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🧪 Testing

### Test Cards

| Card Number | Description |
|-------------|-------------|
| `4242424242424242` | Successful payment |
| `4000000000000002` | Card declined |
| `4000002500003155` | Requires authentication |
| `4000000000009995` | Insufficient funds |

### Test Webhook

```bash
# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.paid
```

---

## ❓ Troubleshooting

### "No such price" error
- Verify Price ID exists in Stripe Dashboard
- Check you're using correct mode (test vs live)

### Webhook 400 error
- Verify webhook secret is correct
- Ensure raw body parser for webhook route

### Subscription not updating
- Check webhook events are being received
- Verify database user has stripeCustomerId

---

## 📚 Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
