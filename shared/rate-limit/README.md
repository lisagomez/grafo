# 🛡️ Rate Limiting Module

This module provides API rate limiting for protection and fair usage.

## 📦 Dependencies

```json
{
  "dependencies": {
    "rate-limiter-flexible": "^4.0.0",
    "ioredis": "^5.3.2"
  }
}
```

## 🔧 Environment Variables

```env
# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# Per-plan limits
RATE_LIMIT_FREE=60
RATE_LIMIT_PRO=300
RATE_LIMIT_ENTERPRISE=1000
```

## 📁 Files Added

```
your-project/
├── backend/
│   └── middleware/
│       └── rateLimit.js
└── shared/rate-limit/
    └── README.md
```

## 🚀 Usage

### Rate Limit Middleware

```javascript
// middleware/rateLimit.js
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';

// Use Redis for distributed systems, memory for single instance
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : null;

// Default rate limiter
const defaultLimiter = redis
  ? new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl',
      points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      duration: 60, // per minute
    })
  : new RateLimiterMemory({
      points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      duration: 60,
    });

// Per-plan rate limiters
const planLimiters = {
  free: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:free',
    points: parseInt(process.env.RATE_LIMIT_FREE) || 60,
    duration: 60,
  }),
  pro: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:pro',
    points: parseInt(process.env.RATE_LIMIT_PRO) || 300,
    duration: 60,
  }),
  enterprise: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:enterprise',
    points: parseInt(process.env.RATE_LIMIT_ENTERPRISE) || 1000,
    duration: 60,
  }),
};

/**
 * Rate limit middleware
 */
export function rateLimit(options = {}) {
  return async (req, res, next) => {
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }

    // Get rate limiter based on user plan
    const plan = req.user?.subscription?.plan || 'free';
    const limiter = planLimiters[plan] || defaultLimiter;

    // Use user ID or IP as key
    const key = req.user?.id || req.ip;

    try {
      const result = await limiter.consume(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());

      next();
    } catch (error) {
      // Rate limit exceeded
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + error.msBeforeNext).toISOString());
      res.setHeader('Retry-After', Math.ceil(error.msBeforeNext / 1000));

      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(error.msBeforeNext / 1000)
      });
    }
  };
}

/**
 * Strict rate limit for sensitive endpoints
 */
export function strictRateLimit(points = 5, duration = 60) {
  const limiter = redis
    ? new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl:strict',
        points,
        duration,
        blockDuration: 300, // Block for 5 minutes after exceeding
      })
    : new RateLimiterMemory({ points, duration, blockDuration: 300 });

  return async (req, res, next) => {
    const key = req.ip;

    try {
      await limiter.consume(key);
      next();
    } catch (error) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'You have been temporarily blocked. Please try again later.',
        retryAfter: Math.ceil(error.msBeforeNext / 1000)
      });
    }
  };
}

/**
 * Per-endpoint rate limit
 */
export function endpointRateLimit(endpoint, points = 10, duration = 60) {
  const limiter = redis
    ? new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `rl:${endpoint}`,
        points,
        duration,
      })
    : new RateLimiterMemory({ points, duration });

  return async (req, res, next) => {
    const key = req.user?.id || req.ip;

    try {
      await limiter.consume(key);
      next();
    } catch (error) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${endpoint}`,
        retryAfter: Math.ceil(error.msBeforeNext / 1000)
      });
    }
  };
}
```

### Apply Rate Limiting

```javascript
// Apply globally
app.use(rateLimit());

// Or per route group
app.use('/api', rateLimit());

// Strict limit for auth endpoints
app.use('/api/auth/login', strictRateLimit(5, 60)); // 5 attempts per minute
app.use('/api/auth/register', strictRateLimit(3, 60)); // 3 registrations per minute
app.use('/api/auth/forgot-password', strictRateLimit(3, 300)); // 3 per 5 minutes

// Custom limits per endpoint
app.use('/api/ai/chat', endpointRateLimit('ai-chat', 20, 60)); // 20 AI requests/min
app.use('/api/export', endpointRateLimit('export', 5, 300)); // 5 exports per 5 min
app.use('/api/webhooks', endpointRateLimit('webhooks', 1000, 60)); // High limit for webhooks
```

### Sliding Window Rate Limiter

```javascript
// For more accurate rate limiting
import { RateLimiterRedis } from 'rate-limiter-flexible';

const slidingWindowLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:sliding',
  points: 100,
  duration: 60,
  execEvenly: true, // Distribute requests evenly
  blockDuration: 0,
});

export function slidingWindowRateLimit() {
  return async (req, res, next) => {
    try {
      const result = await slidingWindowLimiter.consume(req.ip);
      
      res.setHeader('X-RateLimit-Limit', 100);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      
      next();
    } catch (error) {
      res.status(429).json({ error: 'Rate limit exceeded' });
    }
  };
}
```

### Token Bucket Rate Limiter

```javascript
// For burst handling
const tokenBucketLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:bucket',
  points: 100, // Bucket size
  duration: 1, // Refill rate: 100 tokens per second
});

export function tokenBucketRateLimit(tokens = 1) {
  return async (req, res, next) => {
    try {
      await tokenBucketLimiter.consume(req.ip, tokens);
      next();
    } catch (error) {
      res.status(429).json({ error: 'Rate limit exceeded' });
    }
  };
}

// Usage: Different cost per endpoint
app.get('/api/simple', tokenBucketRateLimit(1));  // Costs 1 token
app.post('/api/complex', tokenBucketRateLimit(10)); // Costs 10 tokens
```

### Rate Limit by API Key

```javascript
export function apiKeyRateLimit() {
  return async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    // Get API key config from database
    const keyConfig = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: { include: { subscription: true } } }
    });

    if (!keyConfig) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const plan = keyConfig.user.subscription?.plan || 'free';
    const limiter = planLimiters[plan];

    try {
      await limiter.consume(apiKey);
      req.apiKey = keyConfig;
      next();
    } catch (error) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        limit: limiter.points,
        retryAfter: Math.ceil(error.msBeforeNext / 1000)
      });
    }
  };
}
```

### Frontend Rate Limit Handler

```typescript
// lib/api.ts
async function fetchWithRateLimit(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const seconds = parseInt(retryAfter || '60');
    
    // Show user-friendly message
    toast.error(`Rate limit exceeded. Please wait ${seconds} seconds.`);
    
    // Or auto-retry after delay
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return fetchWithRateLimit(url, options);
  }
  
  return response;
}
```

## 📊 Rate Limit Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests allowed |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | When limit resets (ISO date) |
| `Retry-After` | Seconds until retry (on 429) |

## ❓ Need Help?

- [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible)

