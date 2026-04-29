import { useCallback, useEffect, useState } from 'react';
import { getPrograms } from './api';
import { getLocations } from '../locations/api';

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

export const useLocations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (err) {
      setError(err?.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLocations();
        if (!cancelled) { setLocations(data); }
      } catch (err) {
        if (!cancelled) { setError(err?.message || 'Failed to load locations'); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    locations, loading, error, refresh,
  };
};
