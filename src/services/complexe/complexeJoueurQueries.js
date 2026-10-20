import {
  useMutation, useQueries, useQuery, useQueryClient,
} from '@tanstack/react-query';

import {
  ajouterAuxFavoris,
  annulerMaReservation,
  apercuDeReservation,
  chercherDesTerrains,
  ecrireAuComplexe,
  fermerUneAnnonce,
  lienDInvitation,
  lireComplexePublic,
  lireCreneauxDuJour,
  lireLeGroupe,
  lireLesPartenaires,
  lireLInvitation,
  lireMaFidelite,
  lireMaRelationAuComplexe,
  lireMaReservation,
  lireMesFavoris,
  lireMesReservations,
  lireTerrainsPublics,
  lireUneAnnonce,
  ouvrirLaDiscussion,
  publierUneAnnonce,
  quitterLeCanal,
  rejoindreUneAnnonce,
  repondreALaPartie,
  repondreALaVeille,
  repondreParLeLien,
  reserverUnCreneau,
  retirerDesFavoris,
  signalerUnComplexe,
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

/**
 * RESA-L6B-1 — E-P10 : SES réservations d'un onglet (la clef commence par celle de ses
 * réservations : un geste du joueur la relit).
 * @param {'a-venir' | 'passees' | 'refusees'} periode - L'onglet.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les réservations.
 */
export const useMesReservations = (periode) => useQuery({
  queryFn: async () => {
    const liste = donnees(await lireMesReservations(periode));
    return Array.isArray(liste) ? liste : [];
  },
  queryKey: [...MES_RESERVATIONS_CLEF, 'mine', periode],
  staleTime: DEMI_MINUTE,
});

/**
 * RESA-L6B-1 — E-P14 : répondre à la question de la veille.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ reservationId, reponse })` rend la réservation après la réponse.
 */
export const useRepondreALaVeille = () => useGesteDuJoueur(
  ({ reponse, reservationId }) => repondreALaVeille(reservationId, reponse),
);

// ---------------------------------------------------------------------------------------------
// RESA-L6B-2 (20/10/2026) — jouer à plusieurs (serveur RESA-L3) et la communauté (RESA-L4).
// Le groupe d'une réservation se range SOUS ses réservations (un geste du joueur le relit) ; la
// communauté sous `['complexe', 'moi']` (favoris, relation, fidélité) ; la page d'un lien et les
// partenaires se lisent sans compte (`LECTURE_PUBLIQUE_CLEF`).
// ---------------------------------------------------------------------------------------------

/** Le préfixe de la communauté du joueur (favoris, relation à un complexe, fidélité). */
export const MA_COMMUNAUTE_CLEF = Object.freeze(['complexe', 'moi']);

/** Le préfixe des annonces « Il me manque des joueurs ». */
export const ANNONCES_CLEF = Object.freeze(['complexe', 'annonces']);

/**
 * La clef du groupe d'une réservation.
 * @param {unknown} reservationId - documentId.
 * @returns {unknown[]} La clef.
 */
export const clefDuGroupe = (reservationId) => [...MES_RESERVATIONS_CLEF, reservationId, 'groupe'];

/**
 * E-P07 — le groupe d'une réservation (participants, lien, collecte, équipe, annonce, fils).
 * @param {string | null | undefined} reservationId - documentId.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Le groupe.
 */
export const useGroupeDeLaReservation = (reservationId, { enabled = true } = {}) => useQuery({
  enabled: enabled && Boolean(reservationId),
  queryFn: async () => donnees(await lireLeGroupe(String(reservationId))),
  queryKey: clefDuGroupe(reservationId),
  staleTime: DEMI_MINUTE,
});

/**
 * Un geste qui rend le GROUPE (répondre, rejoindre) : le groupe se pose, les réservations, les
 * annonces et la page du lien se relisent.
 * @param {(variables: any) => Promise<any>} geste - Le geste.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation.
 */
const useGesteDuGroupe = (geste) => {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { preventToastError: true },
    mutationFn: async (/** @type {any} */ variables) => donnees(await geste(variables)),
    onSuccess: async (/** @type {any} */ groupe) => {
      if (groupe?.reservation) queryClient.setQueryData(clefDuGroupe(groupe.reservation), groupe);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...MES_RESERVATIONS_CLEF] }),
        queryClient.invalidateQueries({ queryKey: [...ANNONCES_CLEF] }),
        queryClient.invalidateQueries({ queryKey: [...LECTURE_PUBLIQUE_CLEF, 'invitation'] }),
      ]);
    },
  });
};

/**
 * E-P07 — un participant répond « Présent » / « Absent ».
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ reservationId, reponse })` rend le groupe.
 */
export const useRepondreALaPartie = () => useGesteDuGroupe(
  ({ reponse, reservationId }) => repondreALaPartie(reservationId, reponse),
);

/**
 * E-P08 — répondre par le lien (avec un compte).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ code, reponse })` rend le groupe.
 */
export const useRepondreParLeLien = () => useGesteDuGroupe(
  ({ code, reponse }) => repondreParLeLien(code, reponse),
);

/**
 * E-P09 B — « Je viens ».
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync(annonceId)` rend le groupe.
 */
export const useRejoindreUneAnnonce = () => useGesteDuGroupe(
  (annonceId) => rejoindreUneAnnonce(annonceId),
);

/**
 * Un geste du réserveur sur SA partie (le lien, l'annonce) : le groupe et les annonces se
 * relisent.
 * @param {(variables: any) => Promise<any>} geste - Le geste.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation.
 */
const useGesteDuReserveur = (geste) => {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { preventToastError: true },
    mutationFn: async (/** @type {any} */ variables) => donnees(await geste(variables)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...MES_RESERVATIONS_CLEF] }),
        queryClient.invalidateQueries({ queryKey: [...ANNONCES_CLEF] }),
      ]);
    },
  });
};

/**
 * E-P05 / E-P07 — le lien d'invitation : l'activer (le lire) ou le désactiver.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ actif, reservationId })` rend `{ actif, code, url }`.
 */
export const useLienDInvitation = () => useGesteDuReserveur(
  ({ actif, reservationId }) => lienDInvitation(reservationId, actif),
);

/**
 * E-P09 A — publier l'annonce.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ annonce, reservationId })` rend l'annonce.
 */
export const usePublierUneAnnonce = () => useGesteDuReserveur(
  ({ annonce, reservationId }) => publierUneAnnonce(reservationId, annonce),
);

/**
 * E-P09 B — « Fermer l'annonce ».
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync(annonceId)` rend l'annonce fermée.
 */
export const useFermerUneAnnonce = () => useGesteDuReserveur(
  (annonceId) => fermerUneAnnonce(annonceId),
);

/**
 * E-P07 — ouvrir un fil : la discussion du groupe, ou la conversation avec le complexe. Rien ne
 * se relit (le fil s'ouvre dans la messagerie).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ fil: 'discussion' | 'complexe', reservationId })` rend `{ chat }`.
 */
export const useOuvrirUnFil = () => useMutation({
  meta: { preventToastError: true },
  mutationFn: async (/** @type {any} */ { fil, reservationId }) => donnees(
    await (fil === 'complexe'
      ? ecrireAuComplexe(reservationId)
      : ouvrirLaDiscussion(reservationId)),
  ),
});

/**
 * E-P08 — la page d'un lien, sans compte.
 * @param {string | null | undefined} code - Le code du lien.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} La partie, vue du lien.
 */
export const useInvitation = (code) => useQuery({
  enabled: Boolean(code),
  queryFn: async () => donnees(await lireLInvitation(String(code))),
  queryKey: [...LECTURE_PUBLIQUE_CLEF, 'invitation', code],
  retry: false,
  staleTime: DEMI_MINUTE,
});

/**
 * E-P09 B — la page d'une annonce.
 * @param {string | null | undefined} annonceId - documentId.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} L'annonce.
 */
export const useAnnonce = (annonceId) => useQuery({
  enabled: Boolean(annonceId),
  queryFn: async () => donnees(await lireUneAnnonce(String(annonceId))),
  queryKey: [...ANNONCES_CLEF, annonceId],
  retry: false,
  staleTime: DEMI_MINUTE,
});

/**
 * E-P11 — mes complexes favoris.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les favoris.
 */
export const useMesFavoris = () => useQuery({
  queryFn: async () => {
    const corps = donnees(await lireMesFavoris());
    return Array.isArray(corps?.items) ? corps.items : [];
  },
  queryKey: [...MA_COMMUNAUTE_CLEF, 'favoris'],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P02 — ce complexe et moi (favori, fidélité, canal).
 * @param {string | null | undefined} slug - L'adresse publique.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux (sans compte) : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} La relation.
 */
export const useMaRelationAuComplexe = (slug, { enabled = true } = {}) => useQuery({
  enabled: enabled && Boolean(slug),
  queryFn: async () => donnees(await lireMaRelationAuComplexe(String(slug))),
  queryKey: [...MA_COMMUNAUTE_CLEF, 'relation', slug],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P10 « MA FIDÉLITÉ ».
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Une carte par complexe.
 */
export const useMaFidelite = () => useQuery({
  queryFn: async () => {
    const corps = donnees(await lireMaFidelite());
    return Array.isArray(corps?.items) ? corps.items : [];
  },
  queryKey: [...MA_COMMUNAUTE_CLEF, 'fidelite'],
  staleTime: DEMI_MINUTE,
});

/**
 * E-P02 — les partenaires du complexe, sans compte.
 * @param {string | null | undefined} slug - L'adresse publique.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les partenaires.
 */
export const usePartenairesPublics = (slug) => useQuery({
  enabled: Boolean(slug),
  queryFn: async () => {
    const corps = donnees(await lireLesPartenaires(String(slug)));
    return Array.isArray(corps?.items) ? corps.items : [];
  },
  queryKey: [...LECTURE_PUBLIQUE_CLEF, 'partenaires', slug],
  staleTime: DEMI_MINUTE,
});

/**
 * Un geste de la communauté (favori, canal) : favoris et relations se relisent.
 * @param {(variables: any) => Promise<any>} geste - Le geste.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation.
 */
const useGesteDeLaCommunaute = (geste) => {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { preventToastError: true },
    mutationFn: async (/** @type {any} */ variables) => donnees(await geste(variables)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...MA_COMMUNAUTE_CLEF] });
    },
  });
};

/**
 * E-P02 — mettre en favori.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ origin, slug })`.
 */
export const useAjouterAuxFavoris = () => useGesteDeLaCommunaute(
  ({ origin, slug }) => ajouterAuxFavoris(slug, origin),
);

/**
 * E-P02 / E-P11 — retirer des favoris (le canal gardé, sauf la case).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ quitterCanal, slug })`.
 */
export const useRetirerDesFavoris = () => useGesteDeLaCommunaute(
  ({ quitterCanal, slug }) => retirerDesFavoris(slug, { quitterCanal }),
);

/**
 * E-P12 — quitter le canal.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync(slug)`.
 */
export const useQuitterLeCanal = () => useGesteDeLaCommunaute((slug) => quitterLeCanal(slug));

/**
 * E-P02 — signaler un complexe (rien ne se relit).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexe, details, motif })`.
 */
export const useSignalerUnComplexe = () => useMutation({
  meta: { preventToastError: true },
  mutationFn: async (/** @type {any} */ signalement) => donnees(
    await signalerUnComplexe(signalement),
  ),
});
