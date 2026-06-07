# 🚩 Feature Flags Module

This module provides feature flag management for controlled rollouts.

## 📦 Dependencies

```json
{
  "dependencies": {
    "@vercel/flags": "^1.0.0"
  }
}
```

**Or for LaunchDarkly:**
```json
{
  "dependencies": {
    "launchdarkly-node-server-sdk": "^7.0.0",
    "launchdarkly-react-client-sdk": "^3.0.0"
  }
}
```

## 🔧 Environment Variables

```env
# Feature Flags Provider
FLAG_PROVIDER=custom  # or 'launchdarkly', 'flagsmith'

# LaunchDarkly
LAUNCHDARKLY_SDK_KEY=sdk-xxxxx
LAUNCHDARKLY_CLIENT_ID=xxxxx

# Flagsmith
FLAGSMITH_API_KEY=xxxxx
```

## 📁 Files Added

```
your-project/
├── frontend/
│   ├── lib/flags.ts
│   └── hooks/useFeatureFlag.ts
├── backend/
│   ├── lib/flags.js
│   └── routes/flags.js
└── shared/feature-flags/
    └── README.md
```

## 🚀 Custom Feature Flags

### Database Schema

```prisma
model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique
  name        String
  description String?
  enabled     Boolean  @default(false)
  
  // Targeting
  percentage  Int?     // Gradual rollout percentage
  userIds     String[] // Specific user IDs
  emails      String[] // Specific emails
  plans       String[] // Subscription plans
  
  // A/B Testing
  variants    Json?    // { "control": 50, "variant_a": 25, "variant_b": 25 }
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Backend Flag Service

```javascript
// lib/flags.js
import { prisma } from './prisma.js';
import crypto from 'crypto';

class FeatureFlagService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60000; // 1 minute
  }

  async getFlag(key) {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.flag;
    }

    const flag = await prisma.featureFlag.findUnique({
      where: { key }
    });

    if (flag) {
      this.cache.set(key, { flag, timestamp: Date.now() });
    }

    return flag;
  }

  async isEnabled(key, context = {}) {
    const flag = await this.getFlag(key);
    
    if (!flag) return false;
    if (!flag.enabled) return false;

    // Check user targeting
    if (flag.userIds?.length > 0) {
      if (context.userId && flag.userIds.includes(context.userId)) {
        return true;
      }
    }

    // Check email targeting
    if (flag.emails?.length > 0) {
      if (context.email && flag.emails.includes(context.email)) {
        return true;
      }
    }

    // Check plan targeting
    if (flag.plans?.length > 0) {
      if (context.plan && flag.plans.includes(context.plan)) {
        return true;
      }
    }

    // Check percentage rollout
    if (flag.percentage !== null && flag.percentage !== undefined) {
      const hash = this.hashUser(key, context.userId || context.email || 'anonymous');
      return hash < flag.percentage;
    }

    return flag.enabled;
  }

  async getVariant(key, context = {}) {
    const flag = await this.getFlag(key);
    
    if (!flag?.variants) return 'control';

    const hash = this.hashUser(key, context.userId || 'anonymous');
    let cumulative = 0;

    for (const [variant, percentage] of Object.entries(flag.variants)) {
      cumulative += percentage;
      if (hash < cumulative) {
        return variant;
      }
    }

    return 'control';
  }

  hashUser(flagKey, userId) {
    const hash = crypto
      .createHash('md5')
      .update(`${flagKey}:${userId}`)
      .digest('hex');
    
    return parseInt(hash.substring(0, 8), 16) % 100;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const flags = new FeatureFlagService();
```

### Backend Usage

```javascript
// In your routes
import { flags } from '../lib/flags.js';

router.get('/dashboard', authMiddleware, async (req, res) => {
  const showNewDashboard = await flags.isEnabled('new-dashboard', {
    userId: req.user.id,
    email: req.user.email,
    plan: req.user.subscription?.plan
  });

  if (showNewDashboard) {
    return res.json(await getNewDashboardData());
  }
  
  return res.json(await getLegacyDashboardData());
});

// A/B test
router.get('/pricing', async (req, res) => {
  const variant = await flags.getVariant('pricing-experiment', {
    userId: req.user?.id
  });

  return res.json({
    variant,
    prices: getPricesByVariant(variant)
  });
});
```

### Admin Routes

```javascript
// routes/flags.js
router.get('/', adminMiddleware, async (req, res) => {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(flags);
});

router.post('/', adminMiddleware, async (req, res) => {
  const flag = await prisma.featureFlag.create({
    data: req.body
  });
  flags.clearCache();
  res.json(flag);
});

router.put('/:id', adminMiddleware, async (req, res) => {
  const flag = await prisma.featureFlag.update({
    where: { id: req.params.id },
    data: req.body
  });
  flags.clearCache();
  res.json(flag);
});

router.delete('/:id', adminMiddleware, async (req, res) => {
  await prisma.featureFlag.delete({
    where: { id: req.params.id }
  });
  flags.clearCache();
  res.json({ success: true });
});
```

### Frontend Hook

```typescript
// hooks/useFeatureFlag.ts
'use client';

import { useState, useEffect } from 'react';

export function useFeatureFlag(key: string, defaultValue = false) {
  const [enabled, setEnabled] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/flags/${key}`)
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled);
        setLoading(false);
      })
      .catch(() => {
        setEnabled(defaultValue);
        setLoading(false);
      });
  }, [key, defaultValue]);

  return { enabled, loading };
}

export function useVariant(key: string) {
  const [variant, setVariant] = useState('control');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/flags/${key}/variant`)
      .then(res => res.json())
      .then(data => {
        setVariant(data.variant);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [key]);

  return { variant, loading };
}
```

### Frontend Usage

```tsx
'use client';

import { useFeatureFlag, useVariant } from '@/hooks/useFeatureFlag';

export function Dashboard() {
  const { enabled: showBeta, loading } = useFeatureFlag('beta-features');
  
  if (loading) return <Skeleton />;

  return (
    <div>
      <h1>Dashboard</h1>
      {showBeta && <BetaFeatures />}
    </div>
  );
}

export function PricingPage() {
  const { variant } = useVariant('pricing-experiment');

  return (
    <div>
      {variant === 'control' && <StandardPricing />}
      {variant === 'variant_a' && <DiscountPricing />}
      {variant === 'variant_b' && <AnnualPricing />}
    </div>
  );
}
```

### Feature Gate Component

```tsx
// components/FeatureGate.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface Props {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ flag, children, fallback = null }: Props) {
  const { enabled, loading } = useFeatureFlag(flag);
  
  if (loading) return null;
  if (!enabled) return fallback;
  
  return children;
}

// Usage
<FeatureGate flag="new-feature" fallback={<OldFeature />}>
  <NewFeature />
</FeatureGate>
```

## 📊 Admin UI

```tsx
// app/admin/feature-flags/page.tsx
'use client';

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState([]);

  const toggleFlag = async (id: string, enabled: boolean) => {
    await fetch(`/api/admin/flags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
    refetch();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Feature Flags</h1>
      
      <div className="space-y-4">
        {flags.map(flag => (
          <div key={flag.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
            <div>
              <h3 className="font-medium">{flag.name}</h3>
              <p className="text-sm text-gray-500">{flag.key}</p>
              {flag.percentage && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {flag.percentage}% rollout
                </span>
              )}
            </div>
            <Toggle
              checked={flag.enabled}
              onChange={(enabled) => toggleFlag(flag.id, enabled)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## ❓ Need Help?

- [LaunchDarkly Docs](https://docs.launchdarkly.com)
- [Flagsmith Docs](https://docs.flagsmith.com)

