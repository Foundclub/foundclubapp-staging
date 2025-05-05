import { useQuery } from '@tanstack/react-query';

import { searchPlaces } from './placesService';

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
