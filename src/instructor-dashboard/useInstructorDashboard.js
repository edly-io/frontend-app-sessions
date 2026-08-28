import { useQuery } from '@tanstack/react-query';

import { getInstructorDashboard } from '../app/api';

const useInstructorDashboard = () => useQuery({
  queryKey: ['instructor-dashboard'],
  queryFn: getInstructorDashboard,
  staleTime: 60 * 1000,
});

export default useInstructorDashboard;
