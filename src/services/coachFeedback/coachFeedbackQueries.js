import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCoachFeedbackFollow, updateCoachFeedbackFollow } from './coachFeedbackService';

export const COACH_FEEDBACK_FOLLOW_QUERY_KEY = ['coachFeedbackFollow'];

/**
 * ST-RETOURS — ce que j ai deja lu des retours du coach (moi et mes enfants mineurs).
 * @param {object} [options] - Les options react-query de l appelant.
 * @returns {any} - Le resultat de la requete.
 */
export const useGetCoachFeedbackFollow = (options = {}) => useQuery({
  queryFn: getCoachFeedbackFollow,
  queryKey: COACH_FEEDBACK_FOLLOW_QUERY_KEY,
  staleTime: 1000 * 30,
  ...options,
});

/**
 * ST-RETOURS — marquer lu, et l alerte du parent. La carte rendue par le serveur remplace
 * celle en cache : « Mes enfants » et la fiche se mettent a jour sans relire.
 * @returns {any} - La mutation.
 */
export const useUpdateCoachFeedbackFollow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCoachFeedbackFollow,
    onSuccess: (follow) => {
      if (follow && typeof follow === 'object') {
        queryClient.setQueryData(COACH_FEEDBACK_FOLLOW_QUERY_KEY, follow);
      }
    },
  });
};
