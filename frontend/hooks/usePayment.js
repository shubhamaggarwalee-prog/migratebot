/**
 * frontend/hooks/usePayment.js
 * Create payment intent and manage payment state
 */
import { useState } from 'react';
import { apiClient } from '../lib/api';

export function usePayment() {
  const [clientSecret, setClientSecret] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const createPaymentIntent = async (migrationId, tier) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post('/api/payments/create-intent', { migrationId, tier });
      setClientSecret(data.clientSecret);
      setError(null);
      return data.clientSecret;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { clientSecret, isLoading, error, createPaymentIntent };
}
