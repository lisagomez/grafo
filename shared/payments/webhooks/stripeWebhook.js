/**
 * Stripe Webhook Handler
 * Processes webhook events from Stripe
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Event handlers for different Stripe events
 */
const eventHandlers = {
  /**
   * Handle successful checkout session
   */
  'checkout.session.completed': async (session) => {
    console.log('Checkout completed:', session.id);
    
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    
    // TODO: Update user's subscription in database
    // await updateUserSubscription(session.metadata.userId, {
    //   stripeCustomerId: customerId,
    //   stripeSubscriptionId: subscriptionId,
    //   status: 'active',
    // });
  },

  /**
   * Handle subscription created
   */
  'customer.subscription.created': async (subscription) => {
    console.log('Subscription created:', subscription.id);
    
    // TODO: Update subscription record in database
  },

  /**
   * Handle subscription updated
   */
  'customer.subscription.updated': async (subscription) => {
    console.log('Subscription updated:', subscription.id);
    
    // TODO: Update subscription status in database
    // Handle plan changes, cancellations, etc.
  },

  /**
   * Handle subscription deleted
   */
  'customer.subscription.deleted': async (subscription) => {
    console.log('Subscription deleted:', subscription.id);
    
    // TODO: Downgrade user to free plan
    // await downgradeUser(subscription.metadata.userId);
  },

  /**
   * Handle successful payment
   */
  'invoice.payment_succeeded': async (invoice) => {
    console.log('Payment succeeded:', invoice.id);
    
    // TODO: Record payment, send receipt email
  },

  /**
   * Handle failed payment
   */
  'invoice.payment_failed': async (invoice) => {
    console.log('Payment failed:', invoice.id);
    
    // TODO: Notify user, maybe pause their subscription
    // await sendPaymentFailedEmail(invoice.customer_email);
  },
};

/**
 * Main webhook handler
 */
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  const handler = eventHandlers[event.type];
  
  if (handler) {
    try {
      await handler(event.data.object);
    } catch (error) {
      console.error(`Error handling ${event.type}:`, error);
      // Don't return error to Stripe, just log it
    }
  } else {
    console.log(`Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt
  res.json({ received: true });
};

/**
 * Express route handler for webhooks
 * Note: Requires raw body parser for this route
 */
export const webhookRoute = (req, res) => {
  handleWebhook(req, res);
};

export default {
  handleWebhook,
  webhookRoute,
};

