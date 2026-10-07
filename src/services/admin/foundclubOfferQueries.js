import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getFoundclubClubOffer,
  getFoundclubOffers,
  grantFoundclubClubOffer,
  revokeFoundclubClubOffer,
} from '@/services/admin/foundclubOfferService';

/**
 * OFFRIR-ABONNEMENT (07/10/2026) — les lectures et les gestes de l offre de FoundClub. Un geste
 * reussi relit TOUT ce qui en parle (la fiche du club et la liste des offres) : l etat affiche
 * est celui que le serveur rend, jamais celui qu on suppose.
 */

export const FOUNDCLUB_OFFERS_QUERY_KEY = ['admin', 'foundclub-offers'];

/**
 * @typedef {Record<string, any>} QueryOptions
 */

/**
 * L etat de l offre d un club.
 * @param {string} clubId - documentId du club.
 * @returns {any} La requete.
 */
export const useFoundclubClubOffer = (clubId) => useQuery({
  enabled: Boolean(clubId),
  queryFn: () => getFoundclubClubOffer(clubId),
  queryKey: [...FOUNDCLUB_OFFERS_QUERY_KEY, 'club', clubId],
});

/**
 * La liste des offres en cours.
 * @returns {any} La requete.
 */
export const useFoundclubOffers = () => useQuery({
  queryFn: getFoundclubOffers,
  queryKey: [...FOUNDCLUB_OFFERS_QUERY_KEY, 'list'],
});

/**
 * Un geste qui relit tout ce qui parle des offres, puis appelle `onSuccess`.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste du service.
 * @param {QueryOptions} [options] - Options react-query (`onSuccess` compris).
 * @returns {any} La mutation.
 */
const useGesteOffre = (mutationFn, options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options;
  return useMutation({
    mutationFn,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: FOUNDCLUB_OFFERS_QUERY_KEY });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};

/**
 * Offrir ; variables `{ clubId, duration, reason }`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useGrantFoundclubClubOffer = (options) => useGesteOffre(
  grantFoundclubClubOffer,
  options,
);

/**
 * Retirer ; variables `{ clubId, reason }`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useRevokeFoundclubClubOffer = (options) => useGesteOffre(
  revokeFoundclubClubOffer,
  options,
);
