import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getFeedbackDetail, submitFeedback } from '../app/api';

const useFeedback = requestId => {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['feedback', requestId],
    queryFn: () => getFeedbackDetail(requestId),
    enabled: requestId !== null,
  });
  const submitMutation = useMutation({
    mutationFn: ({ id, payload }) => submitFeedback(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['instructor-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['trainee-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-feedback'] }),
    ]),
  });

  return {
    feedback: detailQuery.data,
    isLoading: detailQuery.isLoading,
    loadError: detailQuery.error,
    submit: (id, payload) => submitMutation.mutateAsync({ id, payload }),
  };
};

export default useFeedback;
