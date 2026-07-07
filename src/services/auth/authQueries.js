import { useQuery } from '@tanstack/react-query';

import { getAuthTokens } from '@/domains/auth/authUseCases';

import { getAllRoles, getMe, getUserById } from './authService';

/**
 * Get current login user
 * @param {import('@tanstack/react-query').UseQueryOptions<User, Error, User, string[]>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<User, Error>} The query result.
 */
export const useGetMe = (options) => useQuery({
  enabled: Boolean(getAuthTokens()?.token),
  queryFn: () => getMe(),
  queryKey: ['get-me', getAuthTokens()?.token || 'no-token'],
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: 1000 * 60 * 5,
  ...options,
});

/**
 * Get all roles
 * @param {import('@tanstack/react-query').UseQueryOptions<
 * Role[], Error, Role[], string[]>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Role[], Error>} The query result.
 */
export const useGetRoles = (options) => useQuery({
  queryFn: () => getAllRoles(),
  queryKey: ['get-roles'],
  ...options,
});

/**
 * Get user by id
 * @param {string} userId - The user id
 * @param {import('@tanstack/react-query').UseQueryOptions<
 * User, Error, User, string[]>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<User, Error>} The query result.
 */
export const useGetUserById = (userId, options) => useQuery({
  queryFn: () => getUserById(userId),
  queryKey: ['get-user-by-id', userId],
  ...options,
});
