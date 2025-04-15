import { useQuery } from '@tanstack/react-query';

import { getAllRoles, getMe } from './authService';

/**
 * Get current login user
 * @param {import('@tanstack/react-query').UseQueryOptions<User, Error, User, string[]>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<User, Error>} The query result.
 */
export const useGetMe = (options) => useQuery({
  queryFn: () => getMe(),
  queryKey: ['get-me'],
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
