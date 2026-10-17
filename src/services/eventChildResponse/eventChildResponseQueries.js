import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  answerForChild,
  getChildEventResponsesForOrganizer,
  getMyChildEventResponses,
} from './eventChildResponseService';

/**
 * Event-scoped cache shared by the parent and staff projections.
 * @param {string} eventId - Event document identifier.
 * @returns {string[]} Cache prefix.
 */
export const childEventResponseKey = (eventId) => ['child-event-responses', eventId];
/**
 * Read this parent's eligible children and their persisted replies.
 * @param {string} eventId - Event document identifier.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Query state.
 */
export const useMyChildEventResponses = (eventId) => {
  const query = useQuery({
    enabled: Boolean(eventId),
    queryFn: () => getMyChildEventResponses(eventId),
    queryKey: [...childEventResponseKey(eventId), 'mine'],
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
  return query;
};
/**
 * Read replies for authorized event staff.
 * @param {string} eventId - Event document identifier.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Query state.
 */
export const useChildEventResponsesForOrganizer = (eventId) => {
  const query = useQuery({
    enabled: Boolean(eventId),
    queryFn: () => getChildEventResponsesForOrganizer(eventId),
    queryKey: [...childEventResponseKey(eventId), 'organizer'],
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
  return query;
};
/**
 * Persist one child's reply and re-read the server result.
 * @param {string} eventId - Event document identifier.
 * @typedef {{ answer: string, child: string }} ChildReply
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, ChildReply>} Mutation state.
 */
export const useAnswerForChild = (eventId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ answer: string, child: string }} */ response) => (
      answerForChild(eventId, response)
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: childEventResponseKey(eventId) });
    },
  });
};
