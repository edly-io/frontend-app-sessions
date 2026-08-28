import { useQuery } from '@tanstack/react-query';

import { getTraineeDashboard } from '../app/api';

const useTraineeDashboard = programKey => useQuery({
  queryKey: ['trainee-dashboard', programKey || 'default'],
  queryFn: () => getTraineeDashboard(programKey),
  staleTime: 60 * 1000,
});

export default useTraineeDashboard;
