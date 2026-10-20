import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  getContactsDeLaVille, getMembresDuFil, getMesCanauxDeLaVille,
} from './collectiviteCanauxService';

/**
 * 🏛️ COLL-C4A2 (02/10/2026) — les lectures des canaux de la Ville. Un fichier à part : les lots
 * de la vague 2 touchent `collectiviteQueries.js` en même temps. (« Écrire aux dirigeants »
 * appelle son service directement : components/EcrireAuxDirigeants.js.)
 */

export const MES_CANAUX_QUERY_KEY = ['collectivite-canaux', 'mine'];

/**
 * La clef de « Qui est dans ce canal ».
 * @param {string | null | undefined} chatId - Le fil.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const membresDuFilQueryKey = (chatId) => ['collectivite-canaux', 'membres', chatId];

/**
 * Les canaux des dirigeants de ce compte (vide pour qui n'en a pas).
 * @param {Record<string, any>} [options] - Options react-query.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} `data` est un tableau.
 */
export const useMesCanauxDeLaVille = (options = {}) => useQuery({
  queryFn: async () => {
    const reponse = await getMesCanauxDeLaVille();
    return Array.isArray(reponse?.data) ? reponse.data : [];
  },
  queryKey: MES_CANAUX_QUERY_KEY,
  staleTime: 60_000,
  ...options,
});

/**
 * Qui est dans ce fil de la Ville (calculé par le serveur).
 * @param {string | null | undefined} chatId - Le fil.
 * @param {Record<string, any>} [options] - Options react-query (`enabled`).
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} `data` : l'objet du
 *   serveur.
 */
export const useMembresDuFil = (chatId, options = {}) => useQuery({
  enabled: Boolean(chatId),
  queryFn: async () => (await getMembresDuFil(String(chatId)))?.data || null,
  queryKey: membresDuFilQueryKey(chatId),
  retry: false,
  staleTime: 60_000,
  ...options,
});

/** MSG-VILLE-NOUVELLE — une page de contacts : 50 personnes (le serveur en rend au plus 200). */
export const CONTACTS_PAR_PAGE = 50;

/**
 * MSG-VILLE-NOUVELLE (20/10/2026) — les personnes à qui la Ville peut écrire, page par page
 * (« Afficher plus ») : une Ville peut avoir des dizaines de clubs, l'écran en ouvre un à la fois.
 * @param {string | null | undefined} collectiviteId - La Ville (documentId).
 * @param {{ club?: string | null, q?: string }} [filtres] - Le club ouvert, le texte cherché.
 * @param {Record<string, any>} [options] - Options react-query (`enabled`).
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<any, Error>} Les pages.
 */
export const useContactsDeLaVille = (
  collectiviteId,
  { club = null, q = '' } = {},
  options = {},
) => (
  useInfiniteQuery({
    enabled: Boolean(collectiviteId),
    getNextPageParam: (/** @type {any} */ page) => {
      const recus = Array.isArray(page?.contacts) ? page.contacts.length : 0;
      const vus = Number(page?.start || 0) + recus;
      return vus < Number(page?.total || 0) ? vus : undefined;
    },
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => (await getContactsDeLaVille(String(collectiviteId), {
      club,
      limit: CONTACTS_PAR_PAGE,
      q,
      start: pageParam,
    }))?.data || null,
    queryKey: ['collectivite-canaux', 'contacts', collectiviteId, club || null, q || ''],
    staleTime: 30_000,
    ...options,
  })
);
