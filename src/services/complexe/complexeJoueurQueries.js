import {
  useMutation, useQueries, useQuery, useQueryClient,
} from '@tanstack/react-query';

import {
  annulerMaReservation,
  apercuDeReservation,
  chercherDesTerrains,
  lireComplexePublic,
  lireCreneauxDuJour,
  lireMaReservation,
  lireTerrainsPublics,
  reserverUnCreneau,
} from './complexeJoueurService';

/**
 * LES LECTURES ET LES GESTES DU JOUEUR — RESA-L6A (14/10/2026), chantier Réservation.
 *
 * Toutes les clefs commencent par `['complexe']`, comme celles du gérant (RESA-L5A1) : un geste du
 * gérant relit aussi ce que voit le joueur. Après « Réserver » ou « Annuler », la lecture publique
 * (`['complexe', 'public']` : les créneaux pris ne sont plus libres) et la réservation se relisent.
 * Chaque geste porte `meta.preventToastError` : l'écran dit lui-même le refus, nommé par son code
 * (`domains/complexe/reserverTerrain.js`, `varianteDEchec`), sans l'alerte générale par-dessus.
 *
 * ⚠️ Caché par `COMPLEXES_JOUEUR` : rien ne lit ces routes tant que l'interrupteur est éteint.
 */

const DEMI_MINUTE = 30 * 1000;

/**
 * Le contenu d'un corps `{ data }`.
 * @param {any} reponse - Le corps.
 * @returns {any} `data`, ou null.
 */
const donnees = (reponse) => reponse?.data ?? null;

/** Le préfixe de tout ce qui se lit sans compte (page, terrains, créneaux, recherche). */
export const LECTURE_PUBLIQUE_CLEF = Object.freeze(['complexe', 'public']);

/** Le préfixe des réservations du joueur. */
export const MES_RESERVATIONS_CLEF = Object.freeze(['complexe', 'reservations-terrain']);

/**
 * E-P01 — la recherche (les filtres SONT la clef : un filtre changé relance la lecture).
 * @param {Record<string, unknown>} filtres - Les filtres de `GET /public-complexes`.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} `{ complexes, date }`.
 */
export const useRechercheDeTerrains = (filtres, { enabled = true } = {}) => useQuery({
  enabled,
  queryFn: async () => donnees(await chercherDesTerrains(filtres)),
  queryKey: [...LECTURE_PUBLIQUE_CLEF, 'recherche', filtres],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P02 — la page publique d'un complexe.
 * @param {string | null | undefined} slug - L'adresse publique.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Le complexe.
 */
export const useComplexePublic = (slug) => useQuery({
  enabled: Boolean(slug),
  queryFn: async () => donnees(await lireComplexePublic(String(slug))),
  queryKey: [...LECTURE_PUBLIQUE_CLEF, 'page', slug],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P01, vue Carte (RESA-CARTE, 20/10/2026) — les pages publiques des complexes proposés, pour
 * leur POSITION : la recherche (`GET /public-complexes`, liste fermée) ne la rend pas. Même clef
 * et même lecture que `useComplexePublic` : la page d'un complexe déjà ouvert (E-P02) n'est pas
 * relue, et celle lue ici sert à E-P02.
 * ponytail: une lecture par complexe placé (30 au plus, `RESULTS_MAX` de la recherche du serveur),
 * et seulement en vue Carte (`enabled`). Voie de sortie : la position dans la carte de la
 * recherche (serveur) ; `epinglesDesComplexes` la lit alors d'office, et l'écran ne demande plus
 * de page pour ce complexe.
 * @param {string[]} slugs - Les complexes à placer.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {{ enCours: boolean, pages: Record<string, any> }} Les pages lues, par slug.
 */
export const usePagesDesComplexes = (slugs, { enabled = true } = {}) => useQueries({
  combine: (resultats) => ({
    enCours: resultats.some((resultat) => resultat.isLoading),
    pages: Object.fromEntries(resultats.flatMap((resultat, rang) => (
      resultat.data ? [[slugs[rang], resultat.data]] : []
    ))),
  }),
  queries: slugs.map((slug) => ({
    enabled: enabled && Boolean(slug),
    queryFn: async () => donnees(await lireComplexePublic(String(slug))),
    queryKey: [...LECTURE_PUBLIQUE_CLEF, 'page', slug],
    staleTime: DEMI_MINUTE,
  })),
});

/**
 * E-P02 — les terrains réservables du complexe.
 * @param {string | null | undefined} slug - L'adresse publique.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les terrains.
 */
export const useTerrainsPublics = (slug) => useQuery({
  enabled: Boolean(slug),
  queryFn: async () => {
    const liste = donnees(await lireTerrainsPublics(String(slug)));
    return Array.isArray(liste) ? liste : [];
  },
  queryKey: [...LECTURE_PUBLIQUE_CLEF, 'terrains', slug],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P02 / E-P03 — les créneaux d'un jour d'un terrain.
 * @param {string | null | undefined} slug - L'adresse publique.
 * @param {string | null | undefined} terrainId - documentId du terrain.
 * @param {string | null | undefined} date - « AAAA-MM-JJ ».
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} `{ date, slots, terrain }`.
 */
export const useCreneauxDuJour = (slug, terrainId, date) => useQuery({
  enabled: Boolean(slug && terrainId && date),
  queryFn: async () => donnees(
    await lireCreneauxDuJour(String(slug), String(terrainId), String(date)),
  ),
  queryKey: [...LECTURE_PUBLIQUE_CLEF, 'creneaux', slug, terrainId, date],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P07 — SA réservation.
 * @param {string | null | undefined} reservationId - documentId.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} La réservation.
 */
export const useMaReservation = (reservationId) => useQuery({
  enabled: Boolean(reservationId),
  queryFn: async () => donnees(await lireMaReservation(String(reservationId))),
  queryKey: [...MES_RESERVATIONS_CLEF, reservationId],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P04 — le récapitulatif (`dryRun`) : rien n'est écrit, rien ne se relit.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync(demande)` rend la réservation telle qu'elle SERAIT.
 */
export const useApercuDeReservation = () => useMutation({
  meta: { preventToastError: true },
  mutationFn: async (/** @type {any} */ demande) => donnees(await apercuDeReservation(demande)),
});

/**
 * Un geste du joueur : refus dit par l'écran ; ensuite, les créneaux et ses réservations se
 * relisent (un créneau réservé ou libéré change d'état pour tout le monde).
 * @param {(variables: any) => Promise<any>} geste - Le geste.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation.
 */
const useGesteDuJoueur = (geste) => {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { preventToastError: true },
    mutationFn: async (/** @type {any} */ variables) => donnees(await geste(variables)),
    onSuccess: async (/** @type {any} */ reservation) => {
      if (reservation?.documentId) {
        queryClient.setQueryData([...MES_RESERVATIONS_CLEF, reservation.documentId], reservation);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...LECTURE_PUBLIQUE_CLEF] }),
        queryClient.invalidateQueries({ queryKey: [...MES_RESERVATIONS_CLEF] }),
      ]);
    },
  });
};

/**
 * E-P04 → E-P05 — réserver.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync(demande)` rend la réservation créée.
 */
export const useReserverUnCreneau = () => useGesteDuJoueur(
  (demande) => reserverUnCreneau(demande),
);

/**
 * E-P07 — annuler SA réservation.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync(reservationId)` rend la réservation annulée.
 */
export const useAnnulerMaReservation = () => useGesteDuJoueur(
  (reservationId) => annulerMaReservation(reservationId),
);
