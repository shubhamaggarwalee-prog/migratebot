/**
 * frontend/lib/stripe.js
 * Stripe.js loader
 */
import { loadStripe } from '@stripe/stripe-js';

let stripePromise;
export const getStripe = () => {
  if (!stripePromise) stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  return stripePromise;
};
