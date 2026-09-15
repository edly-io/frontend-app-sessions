import { useQuery } from '@tanstack/react-query';

import { getPendingFeedback } from '../app/api';

const usePendingFeedback = () => useQuery({
  queryKey: ['pending-feedback'],
  queryFn: getPendingFeedback,
});

export default usePendingFeedback;
