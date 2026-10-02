import {
  keepPreviousData, useMutation, useQueries, useQuery, useQueryClient,
} from '@tanstack/react-query';

import { summarizeInstallationWeek } from '@/domains/seasonSlot/seasonSlotDisplay';

import { getFacilityPlanning } from '@/services/facility/facilityService';

import { getPlanningDefaultDate, getPlanningRange } from '@/utils/planning/planningSlots';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  getSeasonSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
  restoreSeasonSlot,
  withdrawSeasonSlot,
} from './seasonSlotService';

/**
 * COLL-C2B (02/10) — les lectures et les gestes du creneau de saison.
 *
 * Chaque geste relit, depuis le serveur, les creneaux de l installation (`season-slots`)
 * ET son planning (`planning`, prefixe des plannings plein ecran) : un creneau attribue
 * apparait dans la grille, un creneau retire en sort, sans recharger l ecran.
 */

/** @typedef {Record<string, any>} QueryOptions */

const QUART_DE_MINUTE = 15_000;

/**
 * La clef des creneaux d une installation.
 * @param {string | null | undefined} facilityId - documentId.
 * @param {string} [status] - active, withdrawn ou all.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const seasonSlotsQueryKey = (facilityId, status) => (
  status ? ['season-slots', facilityId, status] : ['season-slots', facilityId]
);

/**
 * Les creneaux d une installation (§4.1). `data` est la reponse ENTIERE
 * (`{ data, meta }`) : l ecran lit `meta.canManage`, la saison et les plateaux.
 * @param {string | null | undefined} facilityId - documentId.
 * @param {'active' | 'withdrawn' | 'all'} [status] - Defaut : active.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} Le resultat react-query.
 */
export const useFacilitySeasonSlots = (facilityId, status = 'active', options = {}) => useQuery({
  enabled: Boolean(facilityId),
  queryFn: () => listFacilitySeasonSlots(String(facilityId), { status }),
  queryKey: seasonSlotsQueryKey(facilityId, status),
  staleTime: QUART_DE_MINUTE,
  ...options,
});

/**
 * La place libre pendant la saisie (§4.2). Ne part que si le jour et les deux heures
 * sont lisibles ; garde la carte precedente pendant la relecture (pas de clignotement).
 * @param {string | null | undefined} facilityId - documentId.
 * @param {Record<string, any> | null} params - Les parametres de l apercu, ou null.
 * @returns {any} Le resultat react-query ; `data` est `{ data: apercu }`.
 */
export const useSeasonSlotPreview = (facilityId, params) => useQuery({
  enabled: Boolean(facilityId && params),
  placeholderData: keepPreviousData,
  queryFn: () => previewFacilitySeasonSlot(String(facilityId), params || {}),
  queryKey: [...seasonSlotsQueryKey(facilityId), 'preview', params],
  staleTime: 0,
});

/**
 * Un creneau, avec ses entrainements poses (§4.4).
 * @param {string | null | undefined} slotId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} Le resultat react-query.
 */
export const useSeasonSlot = (slotId, options = {}) => useQuery({
  enabled: Boolean(slotId),
  queryFn: () => getSeasonSlot(String(slotId)),
  queryKey: ['season-slot', slotId],
  staleTime: 0,
  ...options,
});

/**
 * Les equipes d un club, pour le champ « Equipe ».
 * @param {string | null | undefined} clubId - documentId.
 * @returns {any} Le resultat react-query ; `data` est un tableau.
 */
export const useClubTeamsForSlot = (clubId) => useQuery({
  enabled: Boolean(clubId),
  queryFn: () => getClubTeamsForSlot(String(clubId)),
  queryKey: ['season-slots', 'club-teams', clubId],
  staleTime: 5 * 60 * 1000,
});

/**
 * Un geste sur un creneau, puis la relecture des creneaux et du planning.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste.
 * @returns {any} La mutation.
 */
const useGesteCreneau = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    // COLL-FIX-PLANNING (T9_C23_6) — les 4 gestes disent LEUR refus dans l ecran, traduit : un 409
    // de capacite y ouvre la confirmation « Attribuer quand même » / « Changer l’heure ». Le filet
    // global (app/queryClient.js) posait en plus, par-dessus, une alerte « Erreur » au texte brut
    // du serveur avec un seul « OK » : la mairie ne voyait plus comment confirmer.
    meta: { preventToastError: true },
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['season-slots'] }),
        queryClient.invalidateQueries({ queryKey: ['season-slot'] }),
        queryClient.invalidateQueries({ queryKey: ['planning'] }),
      ]);
    },
  });
};

/**
 * Attribuer ; variables `{ facilityId, data }`.
 * @returns {any} La mutation.
 */
export const useAttributeSeasonSlot = () => useGesteCreneau(
  ({ data, facilityId }) => attributeSeasonSlot(facilityId, data),
);

/**
 * Modifier a partir d une date ; variables `{ slotId, data }`.
 * @returns {any} La mutation.
 */
export const useModifySeasonSlot = () => useGesteCreneau(
  ({ data, slotId }) => modifySeasonSlot(slotId, data),
);

/**
 * Retirer ; variables `{ slotId, data? }`.
 * @returns {any} La mutation.
 */
export const useWithdrawSeasonSlot = () => useGesteCreneau(
  ({ data, slotId }) => withdrawSeasonSlot(slotId, data),
);

/**
 * Retablir ; variables `{ slotId, data? }`.
 * @returns {any} La mutation.
 */
export const useRestoreSeasonSlot = () => useGesteCreneau(
  ({ data, slotId }) => restoreSeasonSlot(slotId, data),
);

/**
 * La semaine de chaque installation de la Ville, pour sa carte (design P4, « Cette semaine :
 * 9 seances · complet jeu. 18:00 – 19:30 ») : UNE lecture du planning par installation, sous
 * la meme clef que le planning plein ecran (le cache est partage). Le taux reste au lot C5.
 * @param {any[]} installations - Les installations (documentId, maxSlots).
 * @returns {Record<string, { count: number, full: { start: Date, end: Date } | null }>} Par
 *   documentId ; une installation encore en lecture n y figure pas.
 */
export const useInstallationsWeekSummary = (installations) => {
  const lignes = (Array.isArray(installations) ? installations : [])
    .filter((installation) => installation?.documentId);
  const semaine = getPlanningRange(getPlanningDefaultDate(), 'week');
  const lectures = useQueries({
    queries: lignes.map((installation) => ({
      queryFn: () => getFacilityPlanning(installation.documentId, semaine),
      queryKey: [
        'planning', 'fullscreen', 'facility', installation.documentId, semaine.from, semaine.to,
      ],
      staleTime: 60_000,
    })),
  });
  /** @type {Record<string, { count: number, full: { start: Date, end: Date } | null }>} */
  const resumes = {};
  lignes.forEach((installation, index) => {
    const reponse = lectures[index]?.data;
    if (reponse) {
      resumes[installation.documentId] = summarizeInstallationWeek(reponse, installation.maxSlots);
    }
  });
  return resumes;
};
