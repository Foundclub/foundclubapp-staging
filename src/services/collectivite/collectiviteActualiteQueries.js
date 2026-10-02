import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getActualiteRecipients,
  getCollectiviteActualites,
  modifyActualite,
  publishActualite,
  retireActualite,
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
