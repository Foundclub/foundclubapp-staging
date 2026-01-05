import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAvailability, createBooking, getBookableFacilities, getFacilities, getFacility } from './facilityService';

/**
 * Hook to get availability for a facility on a specific date
 */
export const useGetFacilityAvailability = (facilityId, date, options = {}) => {
  return useQuery({
    queryKey: ['facility-availability', facilityId, date],
    queryFn: () => getAvailability(facilityId, date),
    enabled: !!facilityId && !!date,
    staleTime: 1000 * 60, // 1 minute - slots can change
    ...options,
  });
};

/**
 * Hook to get all bookable facilities
 */
export const useGetBookableFacilities = (options = {}) => {
  return useQuery({
    queryKey: ['bookable-facilities'],
    queryFn: getBookableFacilities,
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
};

/**
 * Hook to get facilities for a club
 */
export const useGetFacilities = (clubId, options = {}) => {
  return useQuery({
    queryKey: ['facilities', clubId],
    queryFn: () => getFacilities(clubId),
    enabled: !!clubId,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook to get a single facility
 */
export const useGetFacility = (facilityId, options = {}) => {
  return useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => getFacility(facilityId),
    enabled: !!facilityId,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Hook to create a booking
 */
export const useCreateBooking = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBooking,
    onSuccess: (data, variables) => {
      // Invalidate availability for this facility
      queryClient.invalidateQueries({ 
        queryKey: ['facility-availability', variables.facilityId] 
      });
      // Invalidate events/reservations
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    ...options,
  });
};
