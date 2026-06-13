import { useQuery } from '@tanstack/react-query';

import { useClubScope } from '@/context/ClubScopeContext';
import { useGetMe } from '@/services/auth/authQueries';
import { getMultisportClubById } from '@/services/multisportClub/multisportClubService';

/**
 * Resolve a multisport club from the current route or the authenticated user.
 * @param {string | undefined} routeCmId
 */
function useResolvedMultisportClub(routeCmId) {
  const clubScope = useClubScope() || {};
  const {
    data: userData,
    error: userDataError,
    isLoading: isLoadingUserData,
    refetch: refetchUserData,
  } = useGetMe();

  const resolvedCmId = routeCmId
    || clubScope.activeMultisportClubId
    || userData?.multisportClubs?.[0]?.documentId
    || '';

  const {
    data: cmData,
    error: cmError,
    isFetching: isFetchingCmData,
    isLoading: isLoadingCmData,
    refetch: refetchCm,
  } = useQuery({
    enabled: !!resolvedCmId,
    queryFn: () => getMultisportClubById(resolvedCmId),
    queryKey: ['multisport-club', resolvedCmId],
  });

  return {
    cmData,
    cmError,
    isFetchingCmData,
    isLoadingCmData,
    isLoadingUserData,
    refetchCm,
    refetchUserData,
    resolvedCmId,
    userData,
    userDataError,
  };
}

export default useResolvedMultisportClub;
