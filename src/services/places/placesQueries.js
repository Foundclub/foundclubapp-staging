import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createLieu, getPlacesFromCoordinates, searchPlaces } from './placesService';

/**
 * Get places query.
 * @param {object} param - The parameters.
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [param.options]
 * @param {string} param.searchParam - The search parameter
 * @param {string} [param.type] - The type of the input.
 * @returns {import('@tanstack/react-query').UseQueryResult<Place[]>}
 */
export const useGetPlaces = ({ options, searchParam, type }) => useQuery({
  // Les adresses BAN sont stables : éviter de re-taper la Géoplateforme pour un
  // préfixe déjà résolu dans l'heure.
  gcTime: 60 * 60 * 1000,
  queryFn: () => searchPlaces(searchParam, type),
  queryKey: ['places', searchParam, type],
  staleTime: 60 * 60 * 1000,
  ...options,
});

/**
 * Get places from coordinates query.
 * @param {object} param - The parameters.
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [param.options]
 * @param {number} param.lat - The latitude
 * @param {number} param.lon - The longitude
 * @returns {import('@tanstack/react-query').UseQueryResult<{data: Place, isLoading: boolean}>}
 */
export const useGetPlacesFromCoordinates = ({ lat, lon, options }) => useQuery({
  queryFn: () => getPlacesFromCoordinates({ lat, lon }),
  queryKey: ['places', lat, lon],
  ...options,
});

/**
 * ADRESSE-CARTE (07/10) — poser un lieu sur la carte. Le refus se dit DANS la carte (traduit par
 * l'écran) : le filet global ne pose pas d'alerte par-dessus. Après un lieu posé, les recherches
 * d'adresse gardées une heure sur l'appareil sont oubliées : la suivante doit le proposer.
 * @returns {import('@tanstack/react-query').UseMutationResult<{ existing: boolean, place: Place }, unknown, Parameters<typeof createLieu>[0]>}
 */
export const useCreateLieu = () => {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { preventToastError: true },
    mutationFn: createLieu,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['places'] }),
  });
};
