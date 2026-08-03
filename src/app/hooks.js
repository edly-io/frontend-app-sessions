import { useEffect, useState } from 'react';
import {
  getPrograms, getProgramCourses, getLearnerCourseMap, getMyCertificate,
} from './api';

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

export const useProgramCourses = (programKey) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!programKey) { return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await getProgramCourses(programKey);
        if (!cancelled) { setCourses(data); }
      } catch (err) {
        if (!cancelled) { setError(err?.message || 'Failed to load courses'); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [programKey]);

  return { courses, loading, error };
};

export const useMyCertificate = (programKey) => {
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!programKey) { return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyCertificate(programKey);
        if (!cancelled) { setCertificate(data); }
      } catch (err) {
        if (cancelled) { return; }
        // 404 = this learner has no active certificate for the program (the
        // normal "not issued yet" case), distinct from a real load failure.
        if (err?.response?.status === 404) { setNotFound(true); } else { setError(err?.message || 'Failed to load certificate'); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [programKey]);

  return {
    certificate, loading, notFound, error,
  };
};

export const useLearnerCourseMap = () => {
  const [courseMap, setCourseMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await getLearnerCourseMap();
        if (!cancelled) { setCourseMap(map); }
      } catch {
        // Learner enrichment data is optional — degrade gracefully
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { courseMap, loading };
};
