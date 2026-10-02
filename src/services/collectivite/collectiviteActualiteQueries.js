import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getActualiteRecipients,
  getClubCollectiviteActualites,
  getCollectiviteActualites,
  getMesActualitesDeLaVille,
  markActualitesVues,
  modifyActualite,
  publishActualite,
  retireActualite,
  setClubCollectiviteActualitesNotify,
} from './collectiviteActualiteService';

/**
 * 📰 COLL-C4A (02/10/2026) — les lectures et les gestes des actualités de la Ville.
 * Un fichier à part (et non `collectiviteQueries.js`) : les lots de la vague 2 tournent en même
 * temps et touchent ce dernier ; ici, rien ne se chevauche à la récolte.
 */

/** @typedef {import('@tanstack/react-query').UseQueryResult<any[], Error>} RowsQuery */

const unwrapRows = (/** @type {any} */ response) => (
  Array.isArray(response?.data) ? response.data : []
);

/**
 * La clef des actualités d'une collectivité (côté mairie).
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteActualitesQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'actualites',
];

/**
 * Les actualités en ligne d'une collectivité (mairie).
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {Record<string, any>} [options] - Options react-query.
 * @returns {RowsQuery} `data` est un tableau.
 */
export const useCollectiviteActualites = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteActualites(String(collectiviteId))),
  queryKey: collectiviteActualitesQueryKey(collectiviteId),
  staleTime: 30_000,
  ...options,
});

/**
 * « Reçue par les membres des n clubs » : relu à chaque changement de destinataires.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {{ audience: string, facilityId?: string | null }} cible - Le choix en cours.
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} `data.clubsCount`.
 */
export const useActualiteRecipients = (collectiviteId, { audience, facilityId }) => useQuery({
  enabled: Boolean(collectiviteId) && (audience !== 'installation' || Boolean(facilityId)),
  queryFn: async () => (await getActualiteRecipients(String(collectiviteId), {
    audience,
    facilityId,
  }))?.data || null,
  queryKey: [
    'collectivite', collectiviteId, 'actualites-destinataires', audience, facilityId || null,
  ],
  staleTime: 60_000,
});

/**
 * Publier, modifier, retirer : chacun relit la liste de la mairie.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {{ modifier: any, publier: any, retirer: any }} Les trois mutations.
 */
export const useActualiteMutations = (collectiviteId) => {
  const queryClient = useQueryClient();
  const relire = () => queryClient.invalidateQueries({
    queryKey: collectiviteActualitesQueryKey(collectiviteId),
  });
  const publier = useMutation({
    mutationFn: (/** @type {Record<string, unknown>} */ data) => publishActualite({
      collectiviteId: String(collectiviteId),
      data,
    }),
    onSuccess: relire,
  });
  const modifier = useMutation({
    mutationFn: (/** @type {{ actualiteId: string, data: Record<string, unknown> }} */ args) => (
      modifyActualite({ ...args, collectiviteId: String(collectiviteId) })
    ),
    onSuccess: relire,
  });
  const retirer = useMutation({
    mutationFn: (/** @type {string} */ actualiteId) => retireActualite({
      actualiteId,
      collectiviteId: String(collectiviteId),
    }),
    onSuccess: relire,
  });
  return { modifier, publier, retirer };
};

// ─── LES MEMBRES (planche 2) ──────────────────────────────────────────────────────────────

/**
 * La clef du bloc « De la Ville » de la fiche d'un club.
 * @param {string | null | undefined} clubId - documentId du club.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const clubCollectiviteActualitesQueryKey = (clubId) => [
  'club', clubId, 'collectivite-actualites',
];

/** La clef du canal de la Ville du membre connecté. */
export const MES_ACTUALITES_QUERY_KEY = ['collectivite-actualites', 'mine'];

/**
 * Le bloc « De la Ville » : {actualites, collectivite, notify} ; collectivite null : aucun bloc.
 * @param {string | null | undefined} clubId - documentId du club.
 * @param {Record<string, any>} [options] - Options react-query (`enabled`).
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} La lecture.
 */
export const useClubCollectiviteActualites = (clubId, options = {}) => useQuery({
  enabled: Boolean(clubId),
  queryFn: async () => (await getClubCollectiviteActualites(String(clubId)))?.data || null,
  queryKey: clubCollectiviteActualitesQueryKey(clubId),
  staleTime: 60_000,
  ...options,
});

/**
 * L'interrupteur D68 : la réponse du serveur remplace la valeur affichée (rien n'est deviné).
 * @param {string | null | undefined} clubId - documentId du club.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, boolean>} La mutation.
 */
export const useClubActualitesNotify = (clubId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {boolean} */ notify) => setClubCollectiviteActualitesNotify({
      clubId: String(clubId),
      notify,
    }),
    onSuccess: (/** @type {any} */ reponse) => {
      queryClient.setQueryData(
        clubCollectiviteActualitesQueryKey(clubId),
        (/** @type {any} */ avant) => (avant
          ? { ...avant, notify: reponse?.data?.notify === true }
          : avant),
      );
    },
  });
};

/**
 * Le canal de la Ville du membre : `{ actualites, collectivites }`.
 * @param {Record<string, any>} [options] - Options react-query.
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} La lecture.
 */
export const useMesActualitesDeLaVille = (options = {}) => useQuery({
  queryFn: async () => (await getMesActualitesDeLaVille())?.data
    || { actualites: [], collectivites: [] },
  queryKey: MES_ACTUALITES_QUERY_KEY,
  staleTime: 60_000,
  ...options,
});

/**
 * Le bandeau part (ouvert ou masqué) : il disparaît TOUT DE SUITE de l'écran, puis le canal est
 * relu (le serveur dit s'il en reste un plus récent).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, Error, string[] | null>} La
 *   mutation (argument : les Villes, ou null pour toutes).
 */
export const useMarquerActualitesVues = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {string[] | null} */ collectiviteIds) => (
      markActualitesVues(collectiviteIds)
    ),
    onMutate: () => {
      queryClient.setQueryData(
        MES_ACTUALITES_QUERY_KEY,
        (/** @type {any} */ avant) => (avant ? { ...avant, bandeau: null } : avant),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: MES_ACTUALITES_QUERY_KEY }),
  });
};
