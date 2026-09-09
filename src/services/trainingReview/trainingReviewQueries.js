import { useQuery } from '@tanstack/react-query';

import { getPendingTrainingReviews, getTrainingReviews } from './trainingReviewService';

const TRAINING_REVIEW_STALE_MS = 30_000;

export const PENDING_TRAINING_REVIEWS_QUERY_KEY = ['pendingTrainingReviews'];

/**
 * Les entrainements que le porteur du jeton peut encore noter.
 * @param {object} [options] - Les options react-query de l appelant.
 * @returns {any} - Le resultat de la requete.
 */
export const useGetPendingTrainingReviews = (options = {}) => useQuery({
  queryFn: getPendingTrainingReviews,
  queryKey: PENDING_TRAINING_REVIEWS_QUERY_KEY,
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? TRAINING_REVIEW_STALE_MS,
  ...options,
});

/**
 * Les avis d un entrainement, pour son encadrant.
 * @param {string | null | undefined} eventId - L entrainement.
 * @param {object} [options] - Les options react-query de l appelant.
 * @returns {any} - Le resultat de la requete.
 */
export const useGetTrainingReviews = (eventId, options = {}) => useQuery({
  enabled: Boolean(eventId),
  queryFn: () => getTrainingReviews(eventId),
  queryKey: ['trainingReviews', eventId],
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? TRAINING_REVIEW_STALE_MS,
  ...options,
});
