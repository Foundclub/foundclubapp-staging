import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  answerCollectiviteAttachRequest,
  answerCollectiviteProposal,
  cancelCollectiviteProposal,
  getClubCollectiviteRequests,
  getCollectiviteClubRequests,
  getMaCollectivite,
  getMesCollectivites,
  notifyMairie,
  proposeCollectiviteClub,
  remindCollectiviteProposal,
  requestClubAttach,
  searchCollectiviteClubs,
  searchCollectivitesForClub,
} from './collectiviteRattachementService';

/**
 * 🏛️ VILLE-INVITER-CLUB (07/10/2026) — les lectures et les gestes du rattachement dans les deux
 * sens. Un fichier à part, qui n'importe PAS `collectiviteQueries.js` : celui-ci charge le client
 * HTTP dès son import, et la carte du club vit dans la fiche du club (ClubDetails), dont les
 * témoins ne le doublent pas.
 * Les clefs de la Ville commencent par `['collectivite', id]`, comme celles de
 * `collectiviteQueries.js` : un geste invalide ce préfixe, donc aussi la liste des clubs
 * rattachés et les invitations. Celles du club par `['club', id]` : la fiche du club, son bloc
 * « De la Ville » et son offre suivent un rattachement.
 */

const unwrapRows = (/** @type {any} */ response) => (
  Array.isArray(response?.data) ? response.data : []
);

/**
 * La clef de la recherche de clubs de la Ville.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {string} q - Le texte cherché.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteClubSearchQueryKey = (collectiviteId, q) => [
  'collectivite', collectiviteId, 'club-search', q,
];

/**
 * La clef des demandes de rattachement de la Ville.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteClubRequestsQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'club-requests',
];

/**
 * La clef des demandes de rattachement d'un club.
 * @param {string | null | undefined} clubId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const clubCollectiviteRequestsQueryKey = (clubId) => [
  'club', clubId, 'collectivite-requests',
];

/**
 * La Ville cherche un club déjà sur FoundClub. Sans texte : les clubs de sa commune.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {string} q - Le texte cherché (au moins 2 caractères pour chercher hors de la commune).
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} La lecture.
 */
export const useCollectiviteClubSearch = (collectiviteId, q) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await searchCollectiviteClubs(String(collectiviteId), q)),
  queryKey: collectiviteClubSearchQueryKey(collectiviteId, q),
  staleTime: 30_000,
});

/**
 * Les demandes de rattachement de la Ville, dans les deux sens.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} La lecture.
 */
export const useCollectiviteClubRequests = (collectiviteId) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteClubRequests(String(collectiviteId))),
  queryKey: collectiviteClubRequestsQueryKey(collectiviteId),
  staleTime: 60_000,
});

/**
 * Un geste de la Ville, puis la relecture de tout ce qui porte sa clef (recherche, demandes,
 * clubs rattachés, invitations).
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste du service.
 * @returns {any} La mutation ; variables avec `collectiviteId`.
 */
const useGesteDeLaVille = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: async (_data, _erreur, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['collectivite', variables?.collectiviteId],
      });
    },
  });
};

/**
 * « Envoyer la demande » : variables `{ collectiviteId, clubId }`.
 * @returns {any} La mutation.
 */
export const useProposeCollectiviteClub = () => useGesteDeLaVille(proposeCollectiviteClub);
/**
 * « Relancer » : variables `{ collectiviteId, invitationId }`.
 * @returns {any} La mutation.
 */
export const useRemindCollectiviteProposal = () => useGesteDeLaVille(remindCollectiviteProposal);
/**
 * « Annuler » : variables `{ collectiviteId, invitationId }`.
 * @returns {any} La mutation.
 */
export const useCancelCollectiviteProposal = () => useGesteDeLaVille(cancelCollectiviteProposal);
/**
 * « Accepter » / « Refuser » une demande venue du lien :
 * `{ collectiviteId, invitationId, accept }`.
 * @returns {any} La mutation.
 */
export const useAnswerCollectiviteAttachRequest = () => useGesteDeLaVille(
  answerCollectiviteAttachRequest,
);

/**
 * Les demandes de rattachement d'un club, pour ses dirigeants.
 * @param {string | null | undefined} clubId - documentId du club.
 * @param {{ enabled?: boolean }} [options] - `enabled` : le compte dirige ce club.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} La lecture.
 */
export const useClubCollectiviteRequests = (clubId, { enabled = true } = {}) => useQuery({
  enabled: Boolean(clubId) && enabled,
  queryFn: async () => unwrapRows(await getClubCollectiviteRequests(String(clubId))),
  queryKey: clubCollectiviteRequestsQueryKey(clubId),
  // Un dirigeant qui n'a pas le droit de lire (dirigeant d'un club parent, par exemple) : la
  // carte ne s'affiche pas, inutile d'insister.
  retry: false,
  staleTime: 60_000,
});

/**
 * R17-INVITER (19/10) — les collectivités que le compte gère, pour la fiche du club (qui ne charge
 * pas `collectiviteQueries.js`). MÊME clé et MÊME forme (un tableau) que `useMyCollectivites` :
 * les deux lectures partagent leur cache.
 * @param {{ enabled?: boolean }} [options] - `enabled` : un compte sans rôle sportif.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} La lecture.
 */
export const useMesVillesGerees = ({ enabled = true } = {}) => useQuery({
  enabled,
  queryFn: async () => unwrapRows(await getMesCollectivites()),
  // = MY_COLLECTIVITES_QUERY_KEY de collectiviteQueries.js (non importé : il charge le client).
  queryKey: ['collectivites', 'mine'],
  staleTime: 5 * 60 * 1000,
});

// ─── VOIE 3 (« collectivité A », 07/10) : « Ma collectivité » ────────────────────────────────

/**
 * La case « Ma collectivité » du dirigeant : `{ attached, commune, lead }`.
 * @param {string | null | undefined} clubId - documentId du club.
 * @param {{ enabled?: boolean }} [options] - `enabled` : le compte dirige ce club.
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} La lecture.
 */
export const useMaCollectivite = (clubId, { enabled = true } = {}) => useQuery({
  enabled: Boolean(clubId) && enabled,
  queryFn: async () => (await getMaCollectivite(String(clubId)))?.data ?? null,
  queryKey: ['club', clubId, 'ma-collectivite'],
  retry: false,
  staleTime: 60_000,
});

/**
 * Le dirigeant cherche sa collectivité (sans texte : celle de sa commune).
 * @param {string | null | undefined} clubId - documentId du club.
 * @param {string} q - Le texte cherché.
 * @param {{ enabled?: boolean }} [options] - `enabled` : faux quand il n'y a rien à chercher
 *   (club rattaché, demande en cours).
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} La lecture.
 */
export const useCollectivitesForClubSearch = (clubId, q, { enabled = true } = {}) => useQuery({
  enabled: Boolean(clubId) && enabled,
  queryFn: async () => unwrapRows(await searchCollectivitesForClub(String(clubId), q)),
  queryKey: ['club', clubId, 'collectivite-search', q],
  retry: false,
  staleTime: 30_000,
});

/**
 * Un geste du club, puis la relecture de tout ce qui porte sa clef.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste du service.
 * @returns {any} La mutation ; variables avec `clubId`.
 */
const useGesteDuClub = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: async (_data, _erreur, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['club', variables?.clubId] });
    },
  });
};

/**
 * « Demander le rattachement » : variables `{ clubId, collectiviteId }`.
 * @returns {any} La mutation.
 */
export const useRequestClubAttach = () => useGesteDuClub(requestClubAttach);

/**
 * « Prévenir ma mairie » : variables `{ clubId, communeName }`.
 * @returns {any} La mutation.
 */
export const useNotifyMairie = () => useGesteDuClub(notifyMairie);

/**
 * Un dirigeant répond à la demande de la Ville : variables `{ clubId, invitationId, accept }`.
 * Accepter rattache tout de suite : la fiche du club (son offre, son bloc « De la Ville ») suit.
 * @returns {any} La mutation.
 */
export const useAnswerCollectiviteProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: answerCollectiviteProposal,
    onSettled: async (_data, _erreur, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['club', variables?.clubId] });
    },
  });
};
