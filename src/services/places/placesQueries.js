import { useQuery } from '@tanstack/react-query';

import { searchPlaces } from './placesService';

/**
 * Get places query.
 * @param {object} param - The parameters.
 * @param {import('@tanstack/react-query').QueriesOptions<any>} param.options - The query options
 * @param {string} param.searchParam - The search parameter
 * @returns {{data: PlaceSearch, isLoading: boolean}} - The query object
 */
export const useGetPlaces = ({ options, searchParam }) => useQuery({
  queryFn: () => searchPlaces(searchParam),
  queryKey: ['places', searchParam],
  ...options,
});
