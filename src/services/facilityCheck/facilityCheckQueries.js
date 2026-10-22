import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createFacilityCheck,
  getCollectiviteFacilityChecksSummary,
  listFacilityChecks,
  markFacilityCheckDone,
} from './facilityCheckService';

/**
 * R17-CONTROLES (20/10, REC17-011 lot 2) — les lectures et les gestes du carnet des controles.
 * Chaque geste relit le carnet et le resume de l accueil (`facility-checks`).
 */

const QUART_DE_MINUTE = 15_000;

/**
 * Le carnet d une installation (la Ville).
 * @param {string | null | undefined} facilityId - documentId.
 * @returns {any} Le resultat react-query ; `data` est la reponse ENTIERE (`{ data, meta }`).
 */
export const useFacilityChecks = (facilityId) => useQuery({
  enabled: Boolean(facilityId),
  queryFn: () => listFacilityChecks(String(facilityId)),
  queryKey: ['facility-checks', 'facility', facilityId],
  staleTime: QUART_DE_MINUTE,
});

/**
 * « Ce qui vous attend » : les controles a refaire (la Ville).
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {any} Le resultat react-query.
 */
export const useCollectiviteFacilityChecksSummary = (collectiviteId) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: () => getCollectiviteFacilityChecksSummary(String(collectiviteId)),
  queryKey: ['facility-checks', 'collectivite', collectiviteId],
  staleTime: QUART_DE_MINUTE,
});

/**
 * Un geste, puis la relecture du carnet et du resume.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste.
 * @returns {any} La mutation.
 */
const useGesteDuCarnet = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facility-checks'] }),
  });
};

/**
 * « Noter un contrôle ».
 * @returns {any} La mutation ; variables `{ facilityId, ...champs }`.
 */
export const useCreateFacilityCheck = () => useGesteDuCarnet(
  ({ facilityId, ...champs }) => createFacilityCheck(facilityId, champs),
);

/**
 * « Noter le contrôle fait ».
 * @returns {any} La mutation ; variables `{ checkId, ...champs }`.
 */
export const useMarkFacilityCheckDone = () => useGesteDuCarnet(
  ({ checkId, ...champs }) => markFacilityCheckDone(checkId, champs),
);
