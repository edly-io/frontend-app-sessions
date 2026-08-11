import { useQuery } from '@tanstack/react-query';

import { getMyFbrRoles } from './api';

export const useMyFbrRoles = () => useQuery({
  queryKey: ['my-fbr-roles'],
  queryFn: getMyFbrRoles,
  staleTime: 5 * 60 * 1000,
});
