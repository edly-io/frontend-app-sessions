import { useCallback, useEffect, useState } from 'react';
import { getPrograms } from './api';
import { getLocations } from '../locations/api';
import { getHolidays } from '../holidays/api';

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

export const useHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getHolidays();
      setHolidays(data);
    } catch (err) {
      setError(err?.message || 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getHolidays();
        if (!cancelled) { setHolidays(data); }
      } catch (err) {
        if (!cancelled) { setError(err?.message || 'Failed to load holidays'); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    holidays, loading, error, refresh,
  };
};
