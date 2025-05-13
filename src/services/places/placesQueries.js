import { useQuery } from '@tanstack/react-query';

import { getPlacesFromCoordinates, searchPlaces } from './placesService';

/**
 * Get places query.
 * @param {object} param - The parameters.
 * @param {import('@tanstack/react-query').QueriesOptions<any>} param.options - The query options
 * @param {string} param.searchParam - The search parameter
 * @param {string} [param.type] - The type of the input.
 * @returns {{data: PlaceSearch, isLoading: boolean}} - The query object
 */
export const useGetPlaces = ({ options, searchParam, type }) => useQuery({
  queryFn: () => searchPlaces(searchParam, type),
  queryKey: ['places', searchParam],
  ...options,
});

/**
 * Get places from coordinates query.
 * @param {object} param - The parameters.
 * @param {import('@tanstack/react-query').QueriesOptions<any>} [param.options] - The query options
 * @param {number} param.lat - The latitude
 * @param {number} param.lon - The longitude
 * @returns {{data: Place, isLoading: boolean}} - The query object
 */
export const useGetPlacesFromCoordinates = ({ lat, lon, options }) => useQuery({
  queryFn: () => getPlacesFromCoordinates({ lat, lon }),
  queryKey: ['places', lat, lon],
  ...options,
});
