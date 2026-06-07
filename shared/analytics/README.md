# 📊 Analytics & SEO Module

This module provides plug-and-play analytics and SEO optimization.

## 📦 Dependencies

Add these to your `package.json`:

### Frontend (Next.js)
```json
{
  "dependencies": {
    "posthog-js": "^1.96.0",
    "@vercel/analytics": "^1.1.1"
  }
}
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Analytics Provider
NEXT_PUBLIC_ANALYTICS_PROVIDER=posthog  # or 'ga', 'vercel'

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Vercel Analytics (auto-configured on Vercel)
```

## 📁 Files Added

```
your-project/
├── frontend/
│   ├── app/
│   │   └── providers.tsx      # Updated with analytics
│   ├── components/
│   │   └── Analytics.tsx      # Analytics wrapper
│   └── lib/
│       ├── analytics.ts       # Analytics helper
│       └── seo.ts            # SEO utilities
└── shared/analytics/
    └── README.md
```

## 🚀 Usage

### Analytics Provider Setup

```tsx
// app/providers.tsx
'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') {
            posthog.debug();
          }
        },
        capture_pageview: false // We capture manually
      });
    }
  }, []);

  return (
    <PostHogProvider client={posthog}>
      {children}
    </PostHogProvider>
  );
}
```

### Track Events

```typescript
// lib/analytics.ts
import posthog from 'posthog-js';

export const analytics = {
  // Track page views
  pageView: (url: string) => {
    if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === 'ga') {
      window.gtag?.('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        page_path: url
      });
    } else {
      posthog.capture('$pageview', { $current_url: url });
    }
  },

  // Track custom events
  track: (event: string, properties?: Record<string, any>) => {
    if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === 'ga') {
      window.gtag?.('event', event, properties);
    } else {
      posthog.capture(event, properties);
    }
  },

  // Identify user
  identify: (userId: string, traits?: Record<string, any>) => {
    if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === 'ga') {
      window.gtag?.('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        user_id: userId
      });
    } else {
      posthog.identify(userId, traits);
    }
  },

  // Track conversion events
  trackSignUp: (method: string) => {
    analytics.track('user_signed_up', { method });
  },

  trackSubscription: (plan: string, value: number) => {
    analytics.track('subscription_started', { plan, value });
  },

  trackFeatureUsed: (feature: string) => {
    analytics.track('feature_used', { feature });
  },

  // Reset on logout
  reset: () => {
    posthog.reset();
  }
};
```

### Usage in Components

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analytics } from '@/lib/analytics';

// Track page views
export function PageViewTracker() {
  const pathname = usePathname();
  
  useEffect(() => {
    analytics.pageView(pathname);
  }, [pathname]);
  
  return null;
}

// Track button clicks
export function SignUpButton() {
  const handleClick = () => {
    analytics.track('cta_clicked', { button: 'signup', location: 'hero' });
  };
  
  return (
    <button onClick={handleClick}>
      Get Started
    </button>
  );
}

// Track form submissions
export function ContactForm() {
  const handleSubmit = async (data) => {
    await submitForm(data);
    analytics.track('form_submitted', { form: 'contact' });
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### SEO Utilities

```tsx
// lib/seo.ts
import { Metadata } from 'next';

interface SEOProps {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: 'website' | 'article';
}

export function generateSEO({
  title,
  description,
  url,
  image = '/og-image.png',
  type = 'website'
}: SEOProps): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourapp.com';
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl;
  const fullImage = image.startsWith('http') ? image : `${siteUrl}${image}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: fullUrl,
      siteName: 'Your App Name',
      images: [{ url: fullImage, width: 1200, height: 630 }],
      type
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [fullImage]
    },
    alternates: {
      canonical: fullUrl
    }
  };
}

// Usage in page.tsx
export const metadata = generateSEO({
  title: 'Pricing - Your App',
  description: 'Simple, transparent pricing for teams of all sizes.',
  url: '/pricing'
});
```

### Google Analytics Script

```tsx
// components/GoogleAnalytics.tsx
'use client';

import Script from 'next/script';

export function GoogleAnalytics() {
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  
  if (!GA_ID) return null;
  
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
```

### Structured Data (JSON-LD)

```tsx
// components/StructuredData.tsx
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Your Company',
    url: 'https://yourapp.com',
    logo: 'https://yourapp.com/logo.png',
    sameAs: [
      'https://twitter.com/yourapp',
      'https://linkedin.com/company/yourapp',
      'https://github.com/yourapp'
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function ProductSchema({ product }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: product.name,
    description: product.description,
    applicationCategory: 'BusinessApplication',
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD'
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

## 📊 Common Events to Track

```typescript
// E-commerce / SaaS Events
analytics.track('page_viewed', { page: 'pricing' });
analytics.track('cta_clicked', { button: 'start_trial', location: 'hero' });
analytics.track('signup_started', { method: 'email' });
analytics.track('signup_completed', { method: 'google' });
analytics.track('trial_started', { plan: 'pro' });
analytics.track('subscription_started', { plan: 'pro', value: 29 });
analytics.track('subscription_cancelled', { plan: 'pro', reason: 'too_expensive' });
analytics.track('feature_used', { feature: 'export_csv' });
analytics.track('error_occurred', { error: 'payment_failed', code: 'card_declined' });
```

## 📊 Provider Comparison

| Feature | PostHog | Google Analytics | Vercel |
|---------|---------|------------------|--------|
| Free Tier | 1M events | Unlimited | 2.5K |
| Self-host | ✅ | ❌ | ❌ |
| Session Replay | ✅ | ❌ | ❌ |
| Feature Flags | ✅ | ❌ | ❌ |
| Privacy | High | Low | Medium |

## ❓ Need Help?

- [PostHog Documentation](https://posthog.com/docs)
- [Google Analytics Documentation](https://developers.google.com/analytics)
- [SaaS Factory GitHub](https://github.com/drdhavaltrivedi/saas-factory)

