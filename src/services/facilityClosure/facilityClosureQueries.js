import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';

import {
  closeFacility,
  listCollectiviteClosures,
  listFacilityClosures,
  modifyFacilityClosure,
  previewFacilityClosure,
  reopenFacilityClosure,
} from './facilityClosureService';

/**
 * COLL-C4B (02/10) — les lectures et les gestes des fermetures.
 *
 * Chaque geste relit, depuis le serveur, les fermetures (`facility-closures`), le planning
 * (`planning` : la plage hachuree, les seances « a deplacer ») et les fiches de seance
 * (`event` : le bandeau de la seance touchee), sans recharger l ecran.
 */

const QUART_DE_MINUTE = 15_000;

/**
 * Les fermetures d une installation. `data` est la reponse ENTIERE (`{ data, meta }`).
 * @param {string | null | undefined} facilityId - documentId.
 * @param {'active' | 'all'} [status] - Defaut : active.
 * @param {Record<string, any>} [options] - Options react-query.
 * @returns {any} Le resultat react-query.
 */
export const useFacilityClosures = (facilityId, status = 'active', options = {}) => useQuery({
  enabled: Boolean(facilityId),
  queryFn: () => listFacilityClosures(String(facilityId), { status }),
  queryKey: ['facility-closures', facilityId, status],
  staleTime: QUART_DE_MINUTE,
  ...options,
});

/**
 * La carte des seances touchees pendant la saisie. Ne part que si les dates (et, pour un
 * blocage, les heures) sont lisibles ; garde la carte precedente pendant la relecture.
 * @param {string | null | undefined} facilityId - documentId.
 * @param {Record<string, any> | null} params - Les parametres de l apercu, ou null.
 * @returns {any} Le resultat react-query ; `data` est `{ data: carte }`.
 */
export const useFacilityClosurePreview = (facilityId, params) => useQuery({
  enabled: Boolean(facilityId && params),
  placeholderData: keepPreviousData,
  queryFn: () => previewFacilityClosure(String(facilityId), params || {}),
  queryKey: ['facility-closures', facilityId, 'preview', params],
  staleTime: 0,
});

/**
 * « Fermeture a venir » sur l accueil de la Ville.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {any} Le resultat react-query ; `data` est `{ data: fermetures }`.
 */
export const useCollectiviteClosures = (collectiviteId) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: () => listCollectiviteClosures(String(collectiviteId)),
  queryKey: ['facility-closures', 'collectivite', collectiviteId],
  staleTime: QUART_DE_MINUTE,
});

/**
 * Un geste sur une fermeture, puis la relecture des fermetures, du planning et des seances.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste.
 * @returns {any} La mutation.
 */
const useGesteFermeture = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    // COLL-FIX-PLANNING (meme defaut que T9_C23_6) — fermer, modifier et rouvrir disent LEUR refus
    // dans l ecran, traduit (closureErrorMessage) : le filet global (app/queryClient.js) ne pose
    // pas, par-dessus, une alerte « Erreur » au texte brut du serveur.
    meta: { preventToastError: true },
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-closures'] }),
        queryClient.invalidateQueries({ queryKey: ['planning'] }),
        queryClient.invalidateQueries({ queryKey: ['event'] }),
      ]);
    },
  });
};

/**
 * Fermer ou bloquer ; variables `{ facilityId, data }`.
 * @returns {any} La mutation.
 */
export const useCloseFacility = () => useGesteFermeture(
  ({ data, facilityId }) => closeFacility(facilityId, data),
);

/**
 * Modifier ; variables `{ closureId, data }`.
 * @returns {any} La mutation.
 */
export const useModifyFacilityClosure = () => useGesteFermeture(
  ({ closureId, data }) => modifyFacilityClosure(closureId, data),
);

/**
 * Rouvrir ; variables `{ closureId }`.
 * @returns {any} La mutation.
 */
export const useReopenFacilityClosure = () => useGesteFermeture(
  ({ closureId }) => reopenFacilityClosure(closureId),
);
