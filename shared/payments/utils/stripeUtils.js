/**
 * Stripe Utility Functions
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a new Stripe customer
 */
export const createCustomer = async ({ email, name, metadata = {} }) => {
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
};

/**
 * Get or create Stripe customer
 */
export const getOrCreateCustomer = async ({ email, name, userId }) => {
  // Search for existing customer
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    return customers.data[0];
  }

  // Create new customer
  return createCustomer({
    email,
    name,
    metadata: { userId },
  });
};

/**
 * Get pricing plans
 */
export const getPricingPlans = async () => {
  const prices = await stripe.prices.list({
    active: true,
    type: 'recurring',
    expand: ['data.product'],
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId: price.product.id,
    name: price.product.name,
    description: price.product.description,
    amount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring.interval,
    features: price.product.metadata.features 
      ? JSON.parse(price.product.metadata.features) 
      : [],
  }));
};

/**
 * Format price for display
 */
export const formatPrice = (amount, currency = 'usd') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

/**
 * Calculate prorated amount for plan change
 */
export const calculateProration = async (subscriptionId, newPriceId) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  const proration = await stripe.invoices.retrieveUpcoming({
    customer: subscription.customer,
    subscription: subscriptionId,
    subscription_items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
  });

  return {
    amount: proration.amount_due,
    currency: proration.currency,
  };
};

export default {
  createCustomer,
  getOrCreateCustomer,
  getPricingPlans,
  formatPrice,
  calculateProration,
};

