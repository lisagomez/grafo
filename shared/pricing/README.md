# 💰 Pricing Page Module

This module provides a beautiful, conversion-optimized pricing page with Stripe integration.

## 📦 Dependencies

Add these to your `package.json`:

### Frontend (Next.js)
```json
{
  "dependencies": {
    "@stripe/stripe-js": "^2.4.0",
    "lucide-react": "^0.330.0"
  }
}
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx

# Stripe Price IDs
STRIPE_PRICE_FREE=price_free_tier
STRIPE_PRICE_PRO_MONTHLY=price_pro_monthly
STRIPE_PRICE_PRO_YEARLY=price_pro_yearly
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_enterprise_monthly
STRIPE_PRICE_ENTERPRISE_YEARLY=price_enterprise_yearly
```

## 📁 Files Added

```
your-project/
├── frontend/
│   └── app/
│       └── pricing/
│           ├── page.tsx
│           └── components/
│               ├── PricingCard.tsx
│               ├── PricingToggle.tsx
│               ├── FeatureList.tsx
│               └── FAQ.tsx
└── shared/pricing/
    ├── config/plans.js
    └── README.md
```

## 🚀 Usage

### Pricing Configuration

```javascript
// config/plans.js
export const PLANS = {
  free: {
    name: 'Free',
    description: 'Perfect for trying out',
    price: { monthly: 0, yearly: 0 },
    priceId: { monthly: null, yearly: null },
    features: [
      { name: 'Up to 3 projects', included: true },
      { name: '1 team member', included: true },
      { name: 'Basic analytics', included: true },
      { name: 'Community support', included: true },
      { name: 'API access', included: false },
      { name: 'Custom domain', included: false },
    ],
    cta: 'Get Started',
    popular: false
  },
  pro: {
    name: 'Pro',
    description: 'For growing teams',
    price: { monthly: 29, yearly: 290 },
    priceId: { 
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY 
    },
    features: [
      { name: 'Unlimited projects', included: true },
      { name: 'Up to 10 team members', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Priority support', included: true },
      { name: 'API access', included: true },
      { name: 'Custom domain', included: true },
    ],
    cta: 'Start Free Trial',
    popular: true
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For large organizations',
    price: { monthly: 99, yearly: 990 },
    priceId: { 
      monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY 
    },
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Unlimited team members', included: true },
      { name: 'SSO / SAML', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'SLA guarantee', included: true },
      { name: 'Custom integrations', included: true },
    ],
    cta: 'Contact Sales',
    popular: false
  }
};
```

### Pricing Page Component

```tsx
// app/pricing/page.tsx
'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { PLANS } from '@/config/plans';

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);

  const handleSubscribe = async (planKey: string) => {
    const plan = PLANS[planKey];
    const priceId = isYearly ? plan.priceId.yearly : plan.priceId.monthly;
    
    if (!priceId) {
      // Free plan - redirect to signup
      window.location.href = '/auth/register';
      return;
    }

    // Create checkout session
    const response = await fetch('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });

    const { url } = await response.json();
    window.location.href = url;
  };

  return (
    <div className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that's right for you. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center items-center gap-4 mb-12">
          <span className={!isYearly ? 'font-semibold' : 'text-gray-500'}>Monthly</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`
              relative w-14 h-8 rounded-full transition-colors
              ${isYearly ? 'bg-primary-500' : 'bg-gray-300'}
            `}
          >
            <span className={`
              absolute top-1 w-6 h-6 bg-white rounded-full transition-transform
              ${isYearly ? 'left-7' : 'left-1'}
            `} />
          </button>
          <span className={isYearly ? 'font-semibold' : 'text-gray-500'}>
            Yearly
            <span className="ml-2 text-green-500 text-sm font-medium">Save 20%</span>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {Object.entries(PLANS).map(([key, plan]) => (
            <div
              key={key}
              className={`
                relative bg-white rounded-2xl border-2 p-8
                ${plan.popular ? 'border-primary-500 shadow-xl' : 'border-gray-200'}
              `}
            >
              {plan.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              )}

              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${isYearly ? plan.price.yearly : plan.price.monthly}
                  </span>
                  {plan.price.monthly > 0 && (
                    <span className="text-gray-500">
                      /{isYearly ? 'year' : 'month'}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(key)}
                className={`
                  w-full py-3 rounded-lg font-semibold transition-colors
                  ${plan.popular
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }
                `}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          {/* Add FAQ accordion here */}
        </div>
      </div>
    </div>
  );
}
```

### Backend - Checkout Session

```javascript
// routes/billing.js
router.post('/create-checkout', authMiddleware, async (req, res) => {
  const { priceId } = req.body;
  const user = req.user;

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id }
    });
    customerId = customer.id;
    
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId }
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing`,
    subscription_data: {
      trial_period_days: 14
    }
  });

  res.json({ url: session.url });
});
```

## 🎨 Customization

```tsx
// Different pricing layouts
<PricingPage layout="cards" />      // Default card layout
<PricingPage layout="table" />      // Comparison table
<PricingPage layout="horizontal" /> // Side-by-side
```

## ❓ Need Help?

- [Stripe Pricing Documentation](https://stripe.com/docs/billing/prices-guide)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

