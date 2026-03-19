/**
 * backend/services/stripe.js
 * Stripe payment intent creation and management
 */
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  standard: 10000, // $100.00 in cents
  pro: 25000,       // $250.00 in cents
};

async function createPaymentIntent(migrationId, tier = 'standard', email) {
  const amount = PRICES[tier] || PRICES.standard;
  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: { migration_id: migrationId, tier },
    receipt_email: email,
    description: `MigrateBot ${tier.charAt(0).toUpperCase() + tier.slice(1)} Migration`,
  });
  return intent;
}

async function getPaymentIntent(id) {
  return stripe.paymentIntents.retrieve(id);
}

async function refundPayment(paymentIntentId, reason = 'requested_by_customer') {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!intent.latest_charge) throw new Error('No charge found for this payment intent');
  return stripe.refunds.create({ charge: intent.latest_charge, reason });
}

module.exports = { createPaymentIntent, getPaymentIntent, refundPayment, PRICES };
