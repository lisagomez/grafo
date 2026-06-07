# ⚡ Background Jobs Module

This module provides background job processing for async tasks.

## 📦 Dependencies

### For Inngest (Serverless)
```json
{
  "dependencies": {
    "inngest": "^3.9.0"
  }
}
```

### For BullMQ (Redis-based)
```json
{
  "dependencies": {
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2"
  }
}
```

## 🔧 Environment Variables

```env
# Job Provider
JOB_PROVIDER=inngest  # or 'bullmq'

# Inngest
INNGEST_EVENT_KEY=xxxxx
INNGEST_SIGNING_KEY=xxxxx

# BullMQ (Redis)
REDIS_URL=redis://localhost:6379

# Job Configuration
JOB_CONCURRENCY=5
JOB_MAX_RETRIES=3
```

## 📁 Files Added

```
your-project/
├── backend/
│   ├── jobs/
│   │   ├── index.js
│   │   ├── emailJobs.js
│   │   ├── billingJobs.js
│   │   └── cleanupJobs.js
│   └── routes/jobs.js
└── shared/jobs/
    └── README.md
```

## 🚀 Inngest Setup

### Define Functions

```javascript
// jobs/index.js
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'my-app' });

// Email job
export const sendWelcomeEmail = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/created' },
  async ({ event, step }) => {
    const { user } = event.data;
    
    await step.run('send-email', async () => {
      await emailService.send({
        to: user.email,
        template: 'welcome',
        data: { name: user.name }
      });
    });
    
    // Wait 24 hours then send onboarding tips
    await step.sleep('wait-24h', '24h');
    
    await step.run('send-tips', async () => {
      await emailService.send({
        to: user.email,
        template: 'onboarding-tips'
      });
    });
  }
);

// Scheduled job (cron)
export const dailyReport = inngest.createFunction(
  { id: 'daily-report' },
  { cron: '0 9 * * *' }, // Every day at 9 AM
  async ({ step }) => {
    const stats = await step.run('get-stats', async () => {
      return await getYesterdayStats();
    });
    
    await step.run('send-report', async () => {
      await sendSlackMessage({
        channel: '#reports',
        text: `Daily Report: ${stats.revenue} revenue, ${stats.signups} signups`
      });
    });
  }
);

// Billing job with retry
export const processSubscription = inngest.createFunction(
  { 
    id: 'process-subscription',
    retries: 3
  },
  { event: 'billing/subscription.due' },
  async ({ event, step }) => {
    const { subscriptionId } = event.data;
    
    const result = await step.run('charge', async () => {
      return await stripe.invoices.create({
        subscription: subscriptionId,
        auto_advance: true
      });
    });
    
    if (result.status === 'paid') {
      await step.run('notify-success', async () => {
        await notifyUser(result.customer, 'Payment successful');
      });
    }
  }
);

export const functions = [
  sendWelcomeEmail,
  dailyReport,
  processSubscription
];
```

### Register with Express

```javascript
// routes/jobs.js
import { serve } from 'inngest/express';
import { inngest, functions } from '../jobs/index.js';

// Inngest webhook endpoint
router.use('/inngest', serve({ client: inngest, functions }));

// Trigger events
export async function triggerJob(eventName, data) {
  await inngest.send({ name: eventName, data });
}
```

### Trigger Jobs

```javascript
// After user signup
await inngest.send({
  name: 'user/created',
  data: { user: { id: user.id, email: user.email, name: user.name } }
});

// After subscription renewal due
await inngest.send({
  name: 'billing/subscription.due',
  data: { subscriptionId: sub.id }
});
```

---

## 🔴 BullMQ Setup

### Queue Configuration

```javascript
// jobs/queue.js
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL);

// Create queues
export const emailQueue = new Queue('email', { connection });
export const billingQueue = new Queue('billing', { connection });
export const cleanupQueue = new Queue('cleanup', { connection });

// Queue events
const queueEvents = new QueueEvents('email', { connection });

queueEvents.on('completed', ({ jobId }) => {
  console.log(`Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed: ${failedReason}`);
});
```

### Define Workers

```javascript
// jobs/workers/emailWorker.js
import { Worker } from 'bullmq';
import { emailService } from '../lib/email.js';

const emailWorker = new Worker('email', async (job) => {
  const { type, data } = job.data;
  
  switch (type) {
    case 'welcome':
      await emailService.send({
        to: data.email,
        template: 'welcome',
        data: { name: data.name }
      });
      break;
      
    case 'password-reset':
      await emailService.send({
        to: data.email,
        template: 'resetPassword',
        data: { resetUrl: data.resetUrl }
      });
      break;
      
    case 'invoice':
      await emailService.send({
        to: data.email,
        template: 'invoice',
        data: data
      });
      break;
  }
}, {
  connection,
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000 // 100 emails per minute
  }
});

emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job.id} failed:`, err);
});

export default emailWorker;
```

### Add Jobs to Queue

```javascript
// Add single job
await emailQueue.add('send-welcome', {
  type: 'welcome',
  data: { email: user.email, name: user.name }
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 }
});

// Add delayed job
await emailQueue.add('send-reminder', {
  type: 'reminder',
  data: { userId: user.id }
}, {
  delay: 24 * 60 * 60 * 1000 // 24 hours
});

// Add recurring job (cron)
await cleanupQueue.add('cleanup-sessions', {}, {
  repeat: { cron: '0 0 * * *' } // Daily at midnight
});

// Bulk add
await emailQueue.addBulk([
  { name: 'newsletter', data: { userId: '1' } },
  { name: 'newsletter', data: { userId: '2' } },
  { name: 'newsletter', data: { userId: '3' } }
]);
```

### Job Dashboard (Bull Board)

```javascript
// routes/admin/queues.js
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(billingQueue),
    new BullMQAdapter(cleanupQueue)
  ],
  serverAdapter
});

router.use('/queues', adminMiddleware, serverAdapter.getRouter());
```

## 📊 Common Job Patterns

```javascript
// Email queue jobs
await emailQueue.add('welcome', { userId });
await emailQueue.add('password-reset', { email, token });
await emailQueue.add('invoice', { invoiceId });
await emailQueue.add('newsletter', { campaignId, userIds });

// Billing jobs
await billingQueue.add('process-subscription', { subscriptionId });
await billingQueue.add('send-reminder', { invoiceId });
await billingQueue.add('retry-payment', { paymentId });

// Cleanup jobs
await cleanupQueue.add('expired-sessions', {});
await cleanupQueue.add('old-logs', { olderThan: '30d' });
await cleanupQueue.add('unverified-users', { olderThan: '7d' });

// Data processing
await processingQueue.add('generate-report', { reportId });
await processingQueue.add('export-data', { userId, format: 'csv' });
await processingQueue.add('import-data', { fileUrl });
```

## 📊 Provider Comparison

| Feature | Inngest | BullMQ |
|---------|---------|--------|
| Infrastructure | Serverless | Redis |
| Cron Jobs | ✅ | ✅ |
| Retries | ✅ | ✅ |
| Dashboard | Cloud | Bull Board |
| Scaling | Auto | Manual |
| Cost | Free tier | Redis cost |

## ❓ Need Help?

- [Inngest Documentation](https://inngest.com/docs)
- [BullMQ Documentation](https://docs.bullmq.io)

