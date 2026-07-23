import { useEffect, useState } from 'react';
import { getPrograms, getProgramCourses, getLearnerCourseMap } from './api';

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
