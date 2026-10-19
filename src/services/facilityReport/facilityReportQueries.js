import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  closeFacilityFromReport,
  getCollectiviteFacilityReportsSummary,
  getFacilityReport,
  getMyFacilityReports,
  getOpenFacilityReports,
  listFacilityReports,
  setFacilityReportStatus,
  submitFacilityReport,
} from './facilityReportService';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — les lectures et les gestes des signalements d installation.
 * Chaque geste relit les signalements (`facility-reports`) ; « Fermer l installation… » relit aussi
 * les fermetures, le planning et les seances, comme une fermeture posee depuis son onglet.
 */

const QUART_DE_MINUTE = 15_000;

/**
 * L onglet « Sécurité et suivi » d une installation (la Ville).
 * @param {string | null | undefined} facilityId - documentId.
 * @returns {any} Le resultat react-query ; `data` est la reponse ENTIERE (`{ data, meta }`).
 */
export const useFacilityReports = (facilityId) => useQuery({
  enabled: Boolean(facilityId),
  queryFn: () => listFacilityReports(String(facilityId)),
  queryKey: ['facility-reports', 'facility', facilityId],
  staleTime: QUART_DE_MINUTE,
});

/**
 * « Deja signale » : les signalements ouverts de l installation, sans auteur.
 * @param {string | null | undefined} facilityId - documentId.
 * @returns {any} Le resultat react-query.
 */
export const useOpenFacilityReports = (facilityId) => useQuery({
  enabled: Boolean(facilityId),
  queryFn: () => getOpenFacilityReports(String(facilityId)),
  queryKey: ['facility-reports', 'open', facilityId],
  retry: false,
  staleTime: QUART_DE_MINUTE,
});

/**
 * Un signalement.
 * @param {string | null | undefined} reportId - documentId.
 * @returns {any} Le resultat react-query.
 */
export const useFacilityReport = (reportId) => useQuery({
  enabled: Boolean(reportId),
  queryFn: () => getFacilityReport(String(reportId)),
  queryKey: ['facility-reports', 'one', reportId],
  retry: false,
  staleTime: QUART_DE_MINUTE,
});

/**
 * « Mes signalements ».
 * @param {{ enabled?: boolean }} [options] - Options react-query.
 * @returns {any} Le resultat react-query.
 */
export const useMyFacilityReports = ({ enabled = true } = {}) => useQuery({
  enabled,
  queryFn: getMyFacilityReports,
  queryKey: ['facility-reports', 'mine'],
  staleTime: QUART_DE_MINUTE,
});

/**
 * La carte de chaque installation et « Ce qui vous attend » (la Ville).
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {any} Le resultat react-query.
 */
export const useCollectiviteFacilityReportsSummary = (collectiviteId) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: () => getCollectiviteFacilityReportsSummary(String(collectiviteId)),
  queryKey: ['facility-reports', 'collectivite', collectiviteId],
  staleTime: QUART_DE_MINUTE,
});

const useGesteSignalement = (mutationFn, { fermeture = false } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    // L ecran dit le refus, traduit : le filet global ne pose pas d alerte par-dessus.
    meta: { preventToastError: true },
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-reports'] }),
        ...(fermeture
          ? [
            queryClient.invalidateQueries({ queryKey: ['facility-closures'] }),
            queryClient.invalidateQueries({ queryKey: ['planning'] }),
            queryClient.invalidateQueries({ queryKey: ['event'] }),
          ]
          : []),
      ]);
    },
  });
};

/**
 * Signaler ; variables `{ facilityId, category, description, event?, photo? }`.
 * @returns {any} La mutation.
 */
export const useSubmitFacilityReport = () => useGesteSignalement(
  ({ facilityId, ...input }) => submitFacilityReport(facilityId, input),
);

/**
 * Changer le statut ; variables `{ reportId, status, note? }`.
 * @returns {any} La mutation.
 */
export const useSetFacilityReportStatus = () => useGesteSignalement(
  ({ reportId, ...data }) => setFacilityReportStatus(reportId, data),
);

/**
 * Fermer l installation depuis un signalement ; variables `{ reportId, data }`.
 * @returns {any} La mutation.
 */
export const useCloseFacilityFromReport = () => useGesteSignalement(
  ({ data, reportId }) => closeFacilityFromReport(reportId, data),
  {
    fermeture: true,
  },
);
