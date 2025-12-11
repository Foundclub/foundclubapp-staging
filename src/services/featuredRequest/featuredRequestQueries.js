import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelFeaturedRequest,
  getMyFeaturedRequests,
  requestFeatured,
} from './featuredRequestService';

/**
 * Hook to get user's featured requests
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGetMyFeaturedRequests = () => useQuery({
  queryFn: getMyFeaturedRequests,
  queryKey: ['my-featured-requests'],
});

/**
 * Hook to request featured
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useRequestFeatured = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: requestFeatured,
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['my-featured-requests'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
    },
  });
};

/**
 * Hook to cancel featured request
 * @returns {import('@tantml:react-query').UseMutationResult}
 */
export const useCancelFeaturedRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelFeaturedRequest,
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['my-featured-requests'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
    },
  });
};


