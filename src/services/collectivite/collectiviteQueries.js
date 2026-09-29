import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getCollectiviteRequests,
  getMyCollectivites,
  saveCollectiviteInstallation,
} from './collectiviteService';

/**
 * COLLECTIVITES 1c (2026-09-29) — les lectures et l ecriture de « Ma collectivite ».
 *
 * Les demandes vivent sous la clef `['facility-override-requests', ...]` : accepter ou
 * refuser passe par les mutations du lot 3a (`facilityQueries`), qui invalident deja ce
 * prefixe — les deux listes (en attente, traitees) et la pastille de l accueil suivent
 * sans code en plus.
 */

/** @typedef {import('@tanstack/react-query').UseQueryResult<any[], Error>} RowsQuery */
/** @typedef {Record<string, any>} QueryOptions */

/**
 * Les lignes d une reponse `{ data: [...] }`, ou un tableau vide.
 * @param {any} response - La reponse du service.
 * @returns {any[]} Les lignes.
 */
const unwrapRows = (response) => (Array.isArray(response?.data) ? response.data : []);

export const MY_COLLECTIVITES_QUERY_KEY = ['collectivites', 'mine'];

/**
 * La clef des demandes d une collectivite (prefixe partage avec le lot 3a).
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {'pending' | 'decided'} status - En attente ou traitees.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteRequestsQueryKey = (collectiviteId, status) => [
  'facility-override-requests', 'collectivite', collectiviteId, status,
];

/**
 * La clef des installations d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteInstallationsQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'installations',
];

/**
 * La clef des clubs rattaches a une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteClubsQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'clubs',
];

/**
 * Les collectivites que je gere : la porte d entree s ouvre si la liste n est pas vide.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useMyCollectivites = (options = {}) => useQuery({
  queryFn: async () => unwrapRows(await getMyCollectivites()),
  queryKey: MY_COLLECTIVITES_QUERY_KEY,
  staleTime: 5 * 60 * 1000,
  ...options,
});

/**
 * Les demandes d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {'pending' | 'decided'} status - En attente ou traitees.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteRequests = (collectiviteId, status, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteRequests(String(collectiviteId), status)),
  queryKey: collectiviteRequestsQueryKey(collectiviteId, status),
  staleTime: 15_000,
  ...options,
});

/**
 * Les installations d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteInstallations = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteInstallations(String(collectiviteId))),
  queryKey: collectiviteInstallationsQueryKey(collectiviteId),
  staleTime: 60_000,
  ...options,
});

/**
 * Les clubs rattaches a une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteClubs = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteClubs(String(collectiviteId))),
  queryKey: collectiviteClubsQueryKey(collectiviteId),
  staleTime: 5 * 60 * 1000,
  ...options,
});

/**
 * Cree (sans `facilityId`) ou modifie une installation, puis relit la liste.
 * @param {QueryOptions} [options] - Options react-query (`onSuccess` compris).
 * @returns {any} La mutation ; variables `{ collectiviteId, data, facilityId? }`.
 */
export const useSaveCollectiviteInstallation = (options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options;
  return useMutation({
    mutationFn: saveCollectiviteInstallation,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: collectiviteInstallationsQueryKey(variables?.collectiviteId),
      });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};
