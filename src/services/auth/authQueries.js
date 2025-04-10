import { useQuery } from '@tanstack/react-query';

import { getMe } from './authService';

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
