import { useQuery } from '@tanstack/react-query';

import { getMyFbrRoles } from './api';

const useMyFbrRoles = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['my-fbr-roles'],
    queryFn: getMyFbrRoles,
    staleTime: 5 * 60 * 1000,
  });
  return { roles: data ?? [], isLoading };
};

export default useMyFbrRoles;
