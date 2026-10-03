import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  estEncoreEnAttente,
  raisonDeRelireLaDecision,
  RELECTURES_APRES_DELAI_MS,
} from '@/domains/collectivite/collectiviteDemandes';

import {
  approveFacilityOverrideRequest,
  createBooking,
  getAvailability,
  getBookableFacilities,
  getClubCollectiviteFacilities,
  getClubFacilityContext,
  getCollectiviteRequests,
  getFacilities,
  getFacility,
  getOccupancy,
  getPendingFacilityOverrideRequests,
  getSentFacilityOverrideRequests,
  refuseFacilityOverrideRequest,
} from './facilityService';

/**
 * Hook to get availability for a facility on a specific date
 * @param facilityId
 * @param date
 * @param options
 */
export const useGetFacilityAvailability = (facilityId, date, options = {}) => useQuery({
  enabled: !!facilityId && !!date,
  queryFn: () => getAvailability(facilityId, date),
  queryKey: ['facility-availability', facilityId, date],
  staleTime: 1000 * 60, // 1 minute - slots can change
  ...options,
});

export const useGetFacilityOccupancy = (facilityId, window, options = {}) => {
  const start = window?.start || null;
  const end = window?.end || null;
  const excludeEventId = window?.excludeEventId || null;

  return useQuery({
    enabled: Boolean(facilityId && start && end),
    queryFn: () => getOccupancy(facilityId, { end, excludeEventId, start }),
    queryKey: ['facility-occupancy', facilityId, start, end, excludeEventId || 'none'],
    staleTime: 30_000,
    ...options,
  });
};

/**
 * Hook to get all bookable facilities
 * @param options
 */
export const useGetBookableFacilities = (options = {}) => useQuery({
  queryFn: getBookableFacilities,
  queryKey: ['bookable-facilities'],
  staleTime: 1000 * 60 * 5, // 5 minutes
  ...options,
});

/**
 * Hook to get facilities for a club
 * @param clubId
 * @param options
 */
export const useGetFacilities = (clubId, options = {}) => useQuery({
  enabled: !!clubId,
  queryFn: () => getFacilities(clubId),
  queryKey: ['facilities', clubId],
  staleTime: 1000 * 60 * 5,
  ...options,
});

/**
 * Hook to get local + shared facilities for a club context.
 * COLL1B (29/09) : `includeCollectivite` ajoute les installations de la collectivite du
 * club (onglet Installations d un MEMBRE) ; sans lui, rien ne change (annonce de recrutement).
 * @param {{ clubId?: string | null, cmId?: string | null }} context
 * @param options
 */
export const useClubFacilityContext = (context = {}, options = {}) => {
  const { clubId = null, cmId = null } = context;
  const {
    includeClubSlots = false, includeCollectivite = false, resolveCmId = true, ...queryOptions
  } = options;
  return useQuery({
    enabled: Boolean(clubId || cmId),
    queryFn: () => getClubFacilityContext(clubId, cmId, {
      includeClubSlots,
      includeCollectivite,
      resolveCmId,
    }),
    queryKey: [
      'club-facility-context',
      clubId || 'none',
      cmId || 'auto',
      includeCollectivite ? 'collectivite' : 'club',
      // COLL-C2C : les creneaux du club joints (« Tes installations » en 3 groupes).
      ...(includeClubSlots ? ['creneaux'] : []),
    ],
    staleTime: 1000 * 60 * 5,
    ...queryOptions,
  });
};

/**
 * Hook to get a single facility
 * @param facilityId
 * @param options
 */
export const useGetFacility = (facilityId, options = {}) => useQuery({
  enabled: !!facilityId,
  queryFn: () => getFacility(facilityId),
  queryKey: ['facility', facilityId],
  staleTime: 1000 * 60 * 5,
  ...options,
});

/**
 * Hook to create a booking
 * @param options
 */
export const useCreateBooking = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBooking,
    onSuccess: (data, variables) => {
      // Invalidate availability for this facility
      queryClient.invalidateQueries({
        queryKey: ['facility-availability', variables.facilityId],
      });
      queryClient.invalidateQueries({
        queryKey: ['facility-occupancy', variables.facilityId],
      });
      // Invalidate events/reservations
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    ...options,
  });
};

export const useGetPendingFacilityOverrideRequests = (clubId, options = {}) => useQuery({
  enabled: Boolean(clubId),
  queryFn: () => getPendingFacilityOverrideRequests(clubId),
  queryKey: ['facility-override-requests', clubId],
  staleTime: 15_000,
  ...options,
});

/**
 * COLL-C3B (02/10) — « Tes demandes a la Ville » du club `clubId`.
 * @param {string | null | undefined} clubId - documentId du club.
 * @param {Record<string, any>} [options] - Options react-query.
 * @returns {any} Le resultat react-query ; `data` est un tableau.
 */
export const useSentFacilityOverrideRequests = (clubId, options = {}) => useQuery({
  enabled: Boolean(clubId),
  queryFn: async () => {
    const reponse = await getSentFacilityOverrideRequests(String(clubId));
    return Array.isArray(reponse?.data) ? reponse.data : [];
  },
  queryKey: ['facility-override-requests', 'sent', clubId],
  staleTime: 15_000,
  ...options,
});

/**
 * COLL-C3B (02/10) — les installations des Villes auxquelles le club est rattache (COLL1B),
 * chacune avec `collectivite: { documentId, name }` : « Demander un creneau » y choisit.
 * @param {string | null | undefined} clubId - documentId du club.
 * @returns {any} Le resultat react-query ; `data` est un tableau.
 */
export const useClubCollectiviteFacilities = (clubId) => useQuery({
  enabled: Boolean(clubId),
  queryFn: async () => {
    const reponse = await getClubCollectiviteFacilities(String(clubId));
    return Array.isArray(reponse?.data) ? reponse.data : [];
  },
  queryKey: ['facilities', 'collectivite', clubId],
  staleTime: 5 * 60 * 1000,
});

/**
 * 🧯 FINITIONS12-COLL (03/10) — LA DÉCISION EST-ELLE PASSÉE ? Relit la file de la Ville (celle de
 * l'écran « Demandes ») : si la demande n'y attend plus, le serveur a écrit la décision, même si
 * sa réponse s'est perdue. Après un délai dépassé, plusieurs relectures (le serveur peut finir
 * juste après l'abandon du client) ; sinon, une seule. Une relecture impossible ne conclut rien.
 * @param {string} collectiviteId - La Ville.
 * @param {string} requestId - La demande tranchée.
 * @param {'delai' | 'reseau' | 'dejaTranchee'} raison - Pourquoi relire.
 * @param {number} [essai] - La relecture en cours (0 : la première).
 * @returns {Promise<boolean>} Vrai si la décision est passée.
 */
const laDecisionEstPassee = async (collectiviteId, requestId, raison, essai = 0) => {
  const attentes = raison === 'delai' ? RELECTURES_APRES_DELAI_MS : [0];
  const pause = attentes[essai] - (essai ? attentes[essai - 1] : 0);
  if (pause > 0) await new Promise((resolve) => { setTimeout(resolve, pause); });
  let file;
  try {
    const reponse = await getCollectiviteRequests(String(collectiviteId), 'pending');
    file = Array.isArray(reponse?.data) ? reponse.data : [];
  } catch {
    return false;
  }
  if (!estEncoreEnAttente(file, requestId)) return true;
  return essai + 1 < attentes.length
    && laDecisionEstPassee(collectiviteId, requestId, raison, essai + 1);
};

/**
 * Une décision de la mairie : la route, puis, si sa réponse se perd (délai dépassé, réseau coupé)
 * ou revient « plus en attente », la relecture de la file AVANT de rejeter : une décision passée
 * réussit (les listes se relisent, la fenêtre se ferme) ; sinon, l'erreur d'origine.
 * @param {() => Promise<any>} decider - L'appel de la route.
 * @param {{ collectiviteId?: string | null, requestId?: string }} cible - La Ville et la demande.
 * @returns {Promise<any>} La réponse, ou `{ data: null, relue: true }` pour une décision relue.
 */
const deciderOuRelire = async (decider, { collectiviteId = null, requestId = '' }) => {
  try {
    return await decider();
  } catch (error) {
    const raison = raisonDeRelireLaDecision(error);
    const relue = Boolean(collectiviteId && requestId && raison)
      && await laDecisionEstPassee(collectiviteId, requestId, raison);
    if (relue) return { data: null, relue: true };
    throw error;
  }
};

export const useApproveFacilityOverrideRequest = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    // COLL-C3B-BIS : `dates`, les dates choisies d'une série (planche 33).
    // FINITIONS12-COLL : `collectiviteId`, la file à relire si la réponse se perd.
    mutationFn: (/** @type {any} */ {
      collectiviteId = null, dates = null, decisionReason, requestId, series = false,
    }) => deciderOuRelire(
      () => approveFacilityOverrideRequest(requestId, decisionReason, series, dates),
      { collectiviteId, requestId },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-override-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['requestsHub'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        // COLL-C3B : une série acceptée devient un créneau de saison ; le planning le montre.
        queryClient.invalidateQueries({ queryKey: ['season-slots'] }),
        queryClient.invalidateQueries({ queryKey: ['planning'] }),
      ]);
    },
    ...options,
  });
};

export const useRefuseFacilityOverrideRequest = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (/** @type {any} */ {
      collectiviteId = null, decisionReason, requestId, series = false,
    }) => deciderOuRelire(
      () => refuseFacilityOverrideRequest(requestId, decisionReason, series),
      { collectiviteId, requestId },
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-override-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['requestsHub'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);
    },
    ...options,
  });
};
