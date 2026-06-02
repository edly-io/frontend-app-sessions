import { useEffect, useState } from 'react';
import { getPrograms } from './api';

export const usePrograms = () => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPrograms();
        if (!cancelled) { setPrograms(data); }
      } catch (err) {
        if (!cancelled) { setError(err?.message || 'Failed to load programs'); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { programs, loading, error };
};
