import { useQuery } from '@tanstack/react-query';
import { getSessionsConfig } from '../calendar/api';

// Fetches the app config once per session and caches it globally via React Query.
// Every component calling useConfig() shares the same in-flight request and cached result.
export const useConfig = () => useQuery({
  queryKey: ['config'],
  queryFn: getSessionsConfig,
  staleTime: 5 * 60 * 1000,
});
