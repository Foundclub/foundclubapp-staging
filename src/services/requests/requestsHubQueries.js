import { useQuery } from '@tanstack/react-query';

import {
  EMPTY_REQUESTS_HUB_DATA,
  getRequestsHubData,
  hasAnyRequestsContext,
  normalizeRequestsHubContext,
} from './requestsHubService';

/**
 * @param {import('./requestsHubService').RequestsHubContext} context
 */
export const getRequestsHubQueryKey = (context) => [
  'requestsHub',
  context.clubId || 'no-club',
  context.cmId || 'no-cm',
  context.teamIds,
];

/** La fraicheur de la liste : un retour sur l'onglet avant ce delai ne relit rien. */
export const REQUESTS_HUB_STALE_TIME_MS = 30_000;

/**
 * @param {Partial<import('./requestsHubService').RequestsHubContext>} rawContext
 * @param {import('@tanstack/react-query').UseQueryOptions<any>} [options]
 */
export const useRequestsHubData = (rawContext = {}, options = {}) => {
  const context = normalizeRequestsHubContext(rawContext);
  const baseEnabled = options?.enabled ?? true;
  const enabled = Boolean(baseEnabled) && hasAnyRequestsContext(context);

  return useQuery({
    ...options,
    enabled,
    // 🫥 DEMR — une liste vide de REPLI ne vaut que pour une lecture qui ne
    // partira pas (aucun club, aucune equipe). Posee aussi pendant la premiere
    // lecture, elle rendait `isPending` et `isLoading` faux des le depart :
    // l'ecran disait « Aucune demande en attente » pendant qu'il chargeait.
    // La liste precedente, elle, reste affichee quand le perimetre change.
    placeholderData: (previousData) => (
      previousData || (enabled ? undefined : EMPTY_REQUESTS_HUB_DATA)
    ),
    // DEMR — le signal coupe le HTTP et la chaine de pages d'une lecture
    // remplacee (tirer-pour-rafraichir, notification, acceptation).
    queryFn: ({ signal }) => getRequestsHubData(context, { signal }),
    queryKey: getRequestsHubQueryKey(context),
    staleTime: REQUESTS_HUB_STALE_TIME_MS,
  });
};

/**
 * DEMR — le retour sur l'onglet relit la liste SEULEMENT si elle est perimee,
 * et ne coupe jamais une lecture deja en vol (il la rejoint).
 *
 * Avant : `refetch()` a chaque prise de focus, qui ignore `staleTime` et, une
 * fois des donnees presentes, ANNULE la lecture en cours pour en relancer une.
 * @param {import('@tanstack/react-query').QueryClient} queryClient - Le cache.
 * @param {Partial<import('./requestsHubService').RequestsHubContext>} rawContext - Le perimetre.
 * @returns {Promise<void>} Quand la relecture eventuelle est terminee.
 */
export const refreshRequestsHubIfStale = (queryClient, rawContext = {}) => (
  queryClient.refetchQueries(
    {
      exact: true,
      predicate: (query) => query.isStaleByTime(REQUESTS_HUB_STALE_TIME_MS),
      queryKey: getRequestsHubQueryKey(normalizeRequestsHubContext(rawContext)),
      type: 'active',
    },
    { cancelRefetch: false },
  )
);
