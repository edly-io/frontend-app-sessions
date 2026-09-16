import { useQuery } from '@tanstack/react-query';
import { getAdminDashboard } from '../app/api';

const useAdminDashboard = () => useQuery({
  queryKey: ['admin-dashboard'],
  queryFn: getAdminDashboard,
  staleTime: 60 * 1000,
});

export default useAdminDashboard;
