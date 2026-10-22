import {
  useMutation, useQueries, useQuery, useQueryClient,
} from '@tanstack/react-query';

import { occupationDesLieux } from '@/domains/collectivite/evenementDeLaVille';

import {
  annulerEvenement,
  getApercuEvenement,
  getEvenementDeLaVille,
  getEvenementsDeLaVille,
  getEvenementsPublicsDeLaVille,
  modifierEvenement,
  publierEvenement,
} from './collectiviteEvenementService';

/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — les lectures et les gestes de l'ÉVÉNEMENT DE LA VILLE.
 * Après un geste de la Ville, ce qui le montre est relu : la liste de la Ville, la fiche, le
 * planning des installations (le blocage lié et l'événement), ses actualités, « Mon planning ».
 */

const unwrapRows = (/** @type {any} */ response) => (
  Array.isArray(response?.data) ? response.data : []
);

/**
 * La clé des événements d'une Ville.
 * @param {string|null|undefined} collectiviteId - La Ville.
 * @returns {any[]} La clé.
 */
export const evenementsDeLaVilleQueryKey = (collectiviteId) => [
  'collectivite',
  collectiviteId,
  'evenements',
];

/**
 * La clé de la fiche d'un événement.
 * @param {string|null|undefined} evenementId - L'événement.
 * @returns {any[]} La clé.
 */
export const evenementDeLaVilleQueryKey = (evenementId) => ['evenement-de-la-ville', evenementId];

/**
 * Les événements de la Ville (vue de la Ville).
 * @param {string|null|undefined} collectiviteId - La Ville.
 * @param {{ from?: string, to?: string }} [fenetre] - Les jours.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} La requête.
 */
export const useEvenementsDeLaVille = (collectiviteId, fenetre = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getEvenementsDeLaVille(String(collectiviteId), fenetre)),
  queryKey: [
    ...evenementsDeLaVilleQueryKey(collectiviteId),
    fenetre?.from || null,
    fenetre?.to || null,
  ],
  staleTime: 30_000,
});

/**
 * « 1 séance touchée », pendant la saisie : seulement quand une installation, un jour et deux
 * heures sont choisis et que l'événement prend toute la place.
 * @param {string|null|undefined} collectiviteId - La Ville.
 * @param {any} params - `{ facilityId, startDate, endDate, startTime, endTime, takesPlace }`.
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} La requête.
 */
export const useApercuEvenement = (collectiviteId, params) => {
  const pret = Boolean(
    collectiviteId
      && params?.takesPlace
      && params?.facilityId
      && params?.startDate
      && params?.startTime
      && params?.endTime,
  );
  const cle = {
    endDate: params?.endDate || null,
    endTime: params?.endTime,
    facilityId: params?.facilityId,
    startDate: params?.startDate,
    startTime: params?.startTime,
  };
  return useQuery({
    enabled: pret,
    queryFn: async () => (await getApercuEvenement(String(collectiviteId), cle))?.data ?? null,
    queryKey: ['collectivite', collectiviteId, 'evenement-apercu', cle],
    staleTime: 15_000,
  });
};

/**
 * La fiche d'un événement de la Ville (selon « Qui le voit ? »).
 * @param {string|null|undefined} evenementId - L'événement.
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} La requête.
 */
export const useEvenementDeLaVille = (evenementId) => useQuery({
  enabled: Boolean(evenementId),
  queryFn: async () => (await getEvenementDeLaVille(String(evenementId)))?.data ?? null,
  queryKey: evenementDeLaVilleQueryKey(evenementId),
  staleTime: 30_000,
});

/**
 * La recherche publique (niveau 3).
 * @param {string} [mot] - Le mot cherché.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[], Error>} La requête.
 */
export const useEvenementsPublicsDeLaVille = (mot = '') => useQuery({
  queryFn: async () => unwrapRows(await getEvenementsPublicsDeLaVille(mot ? { q: mot } : {})),
  queryKey: ['evenements-de-la-ville', 'publics', mot || ''],
  staleTime: 60_000,
});

/**
 * Publier, modifier, annuler : puis relire ce qui les montre.
 * @param {string|null|undefined} collectiviteId - La Ville.
 * @returns {{ annuler: any, modifier: any, publier: any }} Les trois gestes.
 */
export const useGestesEvenementDeLaVille = (collectiviteId) => {
  const queryClient = useQueryClient();
  const relire = async (/** @type {any} */ reponse) => {
    const evenementId = reponse?.data?.documentId;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: evenementsDeLaVilleQueryKey(collectiviteId) }),
      evenementId
        ? queryClient.invalidateQueries({ queryKey: evenementDeLaVilleQueryKey(evenementId) })
        : null,
      // Le blocage lié et l'événement sur les plannings ; l'actualité datée ; « Mon planning ».
      queryClient.invalidateQueries({ queryKey: ['planning'] }),
      queryClient.invalidateQueries({ queryKey: ['collectivite', collectiviteId, 'actualites'] }),
      queryClient.invalidateQueries({ queryKey: ['evenements-de-la-ville'] }),
    ]);
  };
  return {
    annuler: useMutation({
      mutationFn: (/** @type {string} */ evenementId) => annulerEvenement({
        collectiviteId: String(collectiviteId),
        evenementId,
      }),
      onSuccess: relire,
    }),
    modifier: useMutation({
      mutationFn: (/** @type {{ data: any, evenementId: string }} */ variables) => {
        const { data, evenementId } = variables;
        return modifierEvenement({ collectiviteId: String(collectiviteId), data, evenementId });
      },
      onSuccess: relire,
    }),
    publier: useMutation({
      mutationFn: (/** @type {any} */ data) => {
        const ville = String(collectiviteId);
        return publierEvenement({ collectiviteId: ville, data });
      },
      onSuccess: relire,
    }),
  };
};

const HEURE = /^\d{2}:\d{2}$/;

/**
 * 🏟️ R17-EVT-1-BIS (d) (20/10) — « Où ? » : l'occupation de chaque installation de la Ville aux
 * jours et heures choisis. Une lecture du planning par installation (la MÊME clé que le planning
 * plein écran et celui de toutes les installations : le cache sert les trois) et les fermetures
 * de la Ville (la même clé que l'accueil de la Ville). Rien tant que le jour et les heures ne
 * sont pas choisis. Les deux services sont chargés à la demande, comme le client de ce module :
 * les témoins qui doublent ce module ne chargent pas le vrai client HTTP.
 * @param {string|null|undefined} collectiviteId - La Ville.
 * @param {any[]} installations - Ses installations.
 * @param {{ date: string, dateFin?: string, heureDebut: string, heureFin: string }} fenetre
 *   - Les jours et heures de l'événement.
 * @returns {Record<string, any>} Par installation (`occupationDesLieux`), ou `{}`.
 */
export const useOccupationDesLieux = (collectiviteId, installations, fenetre) => {
  const prete = Boolean(
    collectiviteId
      && /^\d{4}-\d{2}-\d{2}$/.test(String(fenetre?.date || ''))
      && HEURE.test(String(fenetre?.heureDebut || ''))
      && HEURE.test(String(fenetre?.heureFin || ''))
      && fenetre.heureDebut < fenetre.heureFin,
  );
  const plage = {
    from: fenetre?.date,
    to: fenetre?.dateFin && fenetre.dateFin > fenetre.date ? fenetre.dateFin : fenetre?.date,
  };
  const liste = Array.isArray(installations) ? installations : [];
  const lectures = useQueries({
    queries: liste.map((/** @type {any} */ installation) => ({
      enabled: prete,
      queryFn: async () => (await import('@/services/facility/facilityService'))
        .getFacilityPlanning(installation.documentId, plage),
      queryKey: [
        'planning', 'fullscreen', 'facility', installation.documentId, plage.from, plage.to,
      ],
      staleTime: 60 * 1000,
    })),
  });
  const fermetures = useQuery({
    enabled: prete,
    queryFn: async () => (await import('@/services/facilityClosure/facilityClosureService'))
      .listCollectiviteClosures(String(collectiviteId)),
    queryKey: ['facility-closures', 'collectivite', collectiviteId],
    staleTime: 15 * 1000,
  });
  if (!prete) return {};
  return occupationDesLieux({
    fenetre,
    fermetures: fermetures.data?.data,
    installations: liste,
    lectures: lectures.map((lecture) => lecture.data),
  });
};
