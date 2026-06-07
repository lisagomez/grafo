/**
 * Stripe Payment Routes
 * Handles all Stripe-related API endpoints
 */

import { Router } from 'express';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a checkout session
 */
router.post('/checkout', async (req, res) => {
  try {
    const { priceId, customerId } = req.body;

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      success: true,
      data: {
        url: session.url,
        sessionId: session.id,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Create a customer portal session
 */
router.post('/portal', async (req, res) => {
  try {
    const { customerId } = req.body;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/billing`,
    });

    res.json({
      success: true,
      data: { url: session.url },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get subscription details
 */
router.get('/subscription/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.json({ success: true, data: null });
    }

    const subscription = subscriptions.data[0];

    res.json({
      success: true,
      data: {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.items.data[0].price.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Cancel subscription
 */
router.post('/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({
      success: true,
      data: {
        cancelAt: new Date(subscription.current_period_end * 1000),
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get invoices
 */
router.get('/invoices/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 10,
    });

    res.json({
      success: true,
      data: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_paid,
        status: inv.status,
        date: new Date(inv.created * 1000),
        pdfUrl: inv.invoice_pdf,
      })),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

