/**
 * frontend/hooks/useMigrations.js
 * Fetch and manage user's migrations
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

export function useMigrations() {
  const [migrations, setMigrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get('/api/migrations');
      setMigrations(data.migrations || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { migrations, isLoading, error, refresh: fetch };
}
