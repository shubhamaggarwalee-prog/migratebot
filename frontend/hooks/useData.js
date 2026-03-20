/**
 * frontend/hooks/useData.js
 * Hook to fetch and expose user credentials map.
 */
import { useState, useEffect } from 'react';
import { credentials } from '../lib/api';

export function useCredentials() {
  const [credMap, setCredMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    credentials.list()
      .then((data) => {
        const map = {};
        (data.credentials || []).forEach((c) => { map[c.platform] = c; });
        setCredMap(map);
      })
      .catch(() => setCredMap({}))
      .finally(() => setLoading(false));
  }, []);

  return { credMap, loading };
}
