import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveFacilityOverrideRequest,
  createBooking,
  getAvailability,
  getBookableFacilities,
  getClubFacilityContext,
  getFacilities,
  getFacility,
  getOccupancy,
  getPendingFacilityOverrideRequests,
  refuseFacilityOverrideRequest,
} from './facilityService';

/**
 * Hook to get availability for a facility on a specific date
 * @param facilityId
 * @param date
 * @param options
 */
export const useGetFacilityAvailability = (facilityId, date, options = {}) => useQuery({
  enabled: !!facilityId && !!date,
  queryFn: () => getAvailability(facilityId, date),
  queryKey: ['facility-availability', facilityId, date],
  staleTime: 1000 * 60, // 1 minute - slots can change
  ...options,
});

export const useGetFacilityOccupancy = (facilityId, window, options = {}) => {
  const start = window?.start || null;
  const end = window?.end || null;
  const excludeEventId = window?.excludeEventId || null;

  return useQuery({
    enabled: Boolean(facilityId && start && end),
    queryFn: () => getOccupancy(facilityId, { end, excludeEventId, start }),
    queryKey: ['facility-occupancy', facilityId, start, end, excludeEventId || 'none'],
    staleTime: 30_000,
    ...options,
  });
};

/**
 * Hook to get all bookable facilities
 * @param options
 */
export const useGetBookableFacilities = (options = {}) => useQuery({
  queryFn: getBookableFacilities,
  queryKey: ['bookable-facilities'],
  staleTime: 1000 * 60 * 5, // 5 minutes
  ...options,
});

/**
 * Hook to get facilities for a club
 * @param clubId
 * @param options
 */
export const useGetFacilities = (clubId, options = {}) => useQuery({
  enabled: !!clubId,
  queryFn: () => getFacilities(clubId),
  queryKey: ['facilities', clubId],
  staleTime: 1000 * 60 * 5,
  ...options,
});

/**
 * Hook to get local + shared facilities for a club context.
 * @param {{ clubId?: string | null, cmId?: string | null }} context
 * @param options
 */
export const useClubFacilityContext = (context = {}, options = {}) => {
  const { clubId = null, cmId = null } = context;
  const { resolveCmId = true, ...queryOptions } = options;
  return useQuery({
    enabled: Boolean(clubId || cmId),
    queryFn: () => getClubFacilityContext(clubId, cmId, { resolveCmId }),
    queryKey: ['club-facility-context', clubId || 'none', cmId || 'auto'],
    staleTime: 1000 * 60 * 5,
    ...queryOptions,
  });
};

/**
 * Hook to get a single facility
 * @param facilityId
 * @param options
 */
export const useGetFacility = (facilityId, options = {}) => useQuery({
  enabled: !!facilityId,
  queryFn: () => getFacility(facilityId),
  queryKey: ['facility', facilityId],
  staleTime: 1000 * 60 * 5,
  ...options,
});

/**
 * Hook to create a booking
 * @param options
 */
export const useCreateBooking = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBooking,
    onSuccess: (data, variables) => {
      // Invalidate availability for this facility
      queryClient.invalidateQueries({
        queryKey: ['facility-availability', variables.facilityId],
      });
      queryClient.invalidateQueries({
        queryKey: ['facility-occupancy', variables.facilityId],
      });
      // Invalidate events/reservations
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    ...options,
  });
};

export const useGetPendingFacilityOverrideRequests = (clubId, options = {}) => useQuery({
  enabled: Boolean(clubId),
  queryFn: () => getPendingFacilityOverrideRequests(clubId),
  queryKey: ['facility-override-requests', clubId],
  staleTime: 15_000,
  ...options,
});

export const useApproveFacilityOverrideRequest = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ decisionReason, requestId }) => approveFacilityOverrideRequest(requestId, decisionReason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-override-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['requestsHub'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);
    },
    ...options,
  });
};

export const useRefuseFacilityOverrideRequest = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ decisionReason, requestId }) => refuseFacilityOverrideRequest(requestId, decisionReason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-override-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['requestsHub'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);
    },
    ...options,
  });
};
