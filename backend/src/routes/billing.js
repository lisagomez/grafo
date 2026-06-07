/**
 * Billing Routes (Stripe Integration)
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { asyncHandler, HttpErrors } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

// Initialize Stripe (only if key is provided)
const stripe = config.stripe.secretKey 
  ? new Stripe(config.stripe.secretKey) 
  : null;

/**
 * GET /billing/subscription
 * Get current subscription
 */
router.get('/subscription', authenticate, asyncHandler(async (req, res) => {
  // In production, fetch subscription from database/Stripe
  const subscription = {
    id: 'sub_demo',
    plan: 'pro',
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
  };

  res.json({
    success: true,
    data: subscription,
  });
}));

/**
 * POST /billing/checkout
 * Create Stripe checkout session
 */
router.post('/checkout', authenticate, asyncHandler(async (req, res) => {
  const { priceId } = req.body;

  if (!priceId) {
    throw HttpErrors.badRequest('Price ID required');
  }

  if (!stripe) {
    throw HttpErrors.internal('Stripe not configured');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${config.corsOrigin}/dashboard/billing?success=true`,
    cancel_url: `${config.corsOrigin}/dashboard/billing?canceled=true`,
    customer_email: req.user.email,
    metadata: {
      userId: req.user.id,
    },
  });

  res.json({
    success: true,
    data: {
      url: session.url,
      sessionId: session.id,
    },
  });
}));

/**
 * POST /billing/portal
 * Create Stripe customer portal session
 */
router.post('/portal', authenticate, asyncHandler(async (req, res) => {
  if (!stripe) {
    throw HttpErrors.internal('Stripe not configured');
  }

  // In production, get customer ID from database
  const customerId = req.body.customerId || 'cus_demo';

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${config.corsOrigin}/dashboard/billing`,
  });

  res.json({
    success: true,
    data: {
      url: session.url,
    },
  });
}));

/**
 * GET /billing/invoices
 * Get invoice history
 */
router.get('/invoices', authenticate, asyncHandler(async (req, res) => {
  // In production, fetch from Stripe
  const invoices = [
    {
      id: 'inv_001',
      number: 'INV-001',
      amount: 2900,
      currency: 'usd',
      status: 'paid',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      pdfUrl: '#',
    },
    {
      id: 'inv_002',
      number: 'INV-002',
      amount: 2900,
      currency: 'usd',
      status: 'paid',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      pdfUrl: '#',
    },
  ];

  res.json({
    success: true,
    data: invoices,
  });
}));

/**
 * GET /billing/plans
 * Get available plans
 */
router.get('/plans', asyncHandler(async (req, res) => {
  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      description: 'Perfect for getting started',
      price: 900,
      interval: 'month',
      features: [
        '5 team members',
        '10 projects',
        '5GB storage',
        'Basic analytics',
        'Email support',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Best for growing teams',
      price: 2900,
      interval: 'month',
      popular: true,
      features: [
        '25 team members',
        'Unlimited projects',
        '100GB storage',
        'Advanced analytics',
        'Priority support',
        'Custom integrations',
        'API access',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations',
      price: 9900,
      interval: 'month',
      features: [
        'Unlimited team members',
        'Unlimited projects',
        'Unlimited storage',
        'Custom analytics',
        '24/7 phone support',
        'Custom integrations',
        'API access',
        'SLA guarantee',
        'Dedicated manager',
      ],
    },
  ];

  res.json({
    success: true,
    data: plans,
  });
}));

export default router;

