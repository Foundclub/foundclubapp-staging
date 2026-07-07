import { useQuery } from '@tanstack/react-query';

import useAuth from '@/domains/auth/useAuth';

import { getMultisportClubById } from '@/services/multisportClub/multisportClubService';

import { useClubScope } from '@/context/ClubScopeContext';

const normalizeId = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const getManagedMultisportClubIds = (userData) => new Set(
  (Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : [])
    .map((multisportClub) => normalizeId(multisportClub?.documentId || multisportClub?.id))
    .filter(Boolean),
);

/**
 * Resolve a multisport club from the current route or the authenticated user.
 * @param {string | undefined} routeCmId
 */
function useResolvedMultisportClub(routeCmId) {
  const clubScope = useClubScope() || {};
  const {
    refetchUserData,
    userData,
    userDataError,
    userDataLoading: isLoadingUserData,
  } = useAuth();

  const managedMultisportClubIds = getManagedMultisportClubIds(userData);
  const resolvedRouteCmId = normalizeId(routeCmId);
  const resolvedScopeCmId = normalizeId(clubScope.activeMultisportClubId);
  const resolvedFallbackCmId = normalizeId(
    userData?.multisportClubs?.[0]?.documentId || userData?.multisportClubs?.[0]?.id,
  );
  const resolvedCmId = (
    (resolvedRouteCmId && managedMultisportClubIds.has(resolvedRouteCmId) && resolvedRouteCmId)
    || (resolvedScopeCmId && managedMultisportClubIds.has(resolvedScopeCmId) && resolvedScopeCmId)
    || resolvedFallbackCmId
    || ''
  );

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
