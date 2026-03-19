/**
 * frontend/components/PaymentForm.jsx
 * Stripe payment form — uses Stripe Elements
 */
import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';

export default function PaymentForm({ clientSecret, onSuccess, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (result.error) throw new Error(result.error.message);
      if (result.paymentIntent.status === 'succeeded') {
        toast.success('Payment successful!');
        onSuccess(result.paymentIntent);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ padding: '12px', border: '1px solid #E5E2DA', borderRadius: 8, background: '#FAFAF8', marginBottom: '1rem' }}>
        <CardElement options={{ style: { base: { fontSize: '14px', color: '#1A1814', '::placeholder': { color: '#9B9890' } } } }} />
      </div>
      <p style={{ fontSize: 12, color: '#9B9890', marginBottom: '1rem' }}>Use test card: 4242 4242 4242 4242 • 12/34 • 123</p>
      <button type="submit" disabled={!stripe || loading} style={{ width: '100%', padding: '12px', background: loading ? '#E5E2DA' : '#D97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Processing...' : `Pay $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
}
