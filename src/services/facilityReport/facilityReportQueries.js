import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isOpenReport } from '@/domains/facilityReport/facilityReportDisplay';

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

/**
 * La PASTILLE de l onglet « Sécurité et suivi » (planche P10-securite-ordi A) : le nombre de
 * signalements OUVERTS de l installation, lu dans ce qui est DEJA en cache — la liste de l onglet
 * si elle a ete lue, sinon le resume de la Ville (lu par la liste des installations et l accueil).
 * AUCUNE lecture de plus : les deux requetes sont desactivees (`enabled: false`), elles ne font
 * que suivre le cache, et une invalidation ne les relit pas (elles ne sont pas « actives »).
 * @param {string | null | undefined} facilityId - documentId de l installation.
 * @param {string | null | undefined} collectiviteId - documentId de la Ville.
 * @returns {number | null} Le nombre, ou null si rien n est en cache.
 */
export const useCachedFacilityOpenReportsCount = (facilityId, collectiviteId) => {
  const liste = useQuery({
    enabled: false,
    queryFn: () => listFacilityReports(String(facilityId)),
    queryKey: ['facility-reports', 'facility', facilityId],
  });
  const resume = useQuery({
    enabled: false,
    queryFn: () => getCollectiviteFacilityReportsSummary(String(collectiviteId)),
    queryKey: ['facility-reports', 'collectivite', collectiviteId],
  });
  if (!facilityId) return null;
  const signalements = /** @type {any} */ (liste.data)?.data;
  if (Array.isArray(signalements)) {
    return signalements.filter(isOpenReport).length;
  }
  const lignes = /** @type {any} */ (resume.data)?.data;
  if (!Array.isArray(lignes)) return null;
  const ligne = lignes.find((compte) => compte?.facilityDocumentId === facilityId);
  return ligne ? Number(ligne.openCount) || 0 : 0;
};

/**
 * Un geste, puis la relecture des signalements (et, pour une fermeture, du planning et des
 * seances).
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste.
 * @param {{ fermeture?: boolean }} [options] - `fermeture` : relire aussi les fermetures.
 * @returns {any} La mutation.
 */
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
  (/** @type {any} */ { facilityId, ...input }) => submitFacilityReport(facilityId, input),
);

/**
 * Changer le statut ; variables `{ reportId, status, note? }`.
 * @returns {any} La mutation.
 */
export const useSetFacilityReportStatus = () => useGesteSignalement(
  (/** @type {any} */ { reportId, ...data }) => setFacilityReportStatus(reportId, data),
);

/**
 * Fermer l installation depuis un signalement ; variables `{ reportId, data }`.
 * @returns {any} La mutation.
 */
export const useCloseFacilityFromReport = () => useGesteSignalement(
  (/** @type {any} */ { data, reportId }) => closeFacilityFromReport(reportId, data),
  {
    fermeture: true,
  },
);
