/**
 * backend/routes/webhooks.js
 * Stripe webhook handler
 */
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('../utils/supabase');

// POST /webhooks/stripe
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const migrationId = pi.metadata?.migration_id;
        if (migrationId) {
          await supabaseAdmin
            .from('migrations')
            .update({ status: 'paid', stripe_payment_intent_id: pi.id })
            .eq('id', migrationId);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const migrationId = pi.metadata?.migration_id;
        if (migrationId) {
          await supabaseAdmin
            .from('migrations')
            .update({ status: 'payment_failed' })
            .eq('id', migrationId);
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        console.log('Charge refunded:', charge.id);
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
