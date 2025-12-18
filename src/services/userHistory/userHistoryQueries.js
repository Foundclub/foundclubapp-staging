import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createHistory,
  deleteHistory,
  getMyHistories,
  getUserHistories,
  updateHistory,
} from './userHistoryService';

/**
 * React Query hook to fetch user's own history
 * @param {object} options - Query options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGetMyHistories = (options = {}) => useQuery({
  queryFn: getMyHistories,
  queryKey: ['userHistories', 'mine'],
  ...options,
});

/**
 * React Query hook to fetch a specific user's history
 * @param {string} userId - The user's documentId
 * @param {object} options - Query options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGetUserHistories = (userId, options = {}) => useQuery({
  queryFn: () => getUserHistories(userId),
  queryKey: ['userHistories', userId],
  enabled: !!userId,
  ...options,
});

/**
 * React Query mutation hook to create a history entry
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useCreateHistory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userHistories'] });
    },
  });
};

/**
 * React Query mutation hook to update a history entry
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useUpdateHistory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => updateHistory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userHistories'] });
    },
  });
};

/**
 * React Query mutation hook to delete a history entry
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useDeleteHistory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userHistories'] });
    },
  });
};
