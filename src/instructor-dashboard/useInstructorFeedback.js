import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getFeedbackDetail, submitFeedback } from '../app/api';

const useInstructorFeedback = requestId => {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['instructor-feedback', requestId],
    queryFn: () => getFeedbackDetail(requestId),
    enabled: requestId !== null,
  });
  const submitMutation = useMutation({
    mutationFn: ({ id, payload }) => submitFeedback(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructor-dashboard'] }),
  });

  return {
    feedback: detailQuery.data,
    isLoading: detailQuery.isLoading,
    loadError: detailQuery.error,
    submit: (id, payload) => submitMutation.mutateAsync({ id, payload }),
  };
};

export default useInstructorFeedback;
