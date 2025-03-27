import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './EXAMPLE-authService';

/**
 * Hook to get the current authenticated user
 * @returns {import('@tanstack/react-query').UseQueryResult<User, Error>}
 */
export const useGetCurrentUser = () => useQuery({
  queryKey: ['currentUser'],
  queryFn: getCurrentUser,
});
