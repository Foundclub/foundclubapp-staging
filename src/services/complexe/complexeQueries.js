import {
  useInfiniteQuery, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';

import { complexeChoisi } from '@/domains/complexe/complexeGerant';

import {
  annulerNonHonoree,
  annulerReservationGeree,
  apercuReglages,
  bannir,
  bloquerCreneau,
  creerMonComplexe,
  creerTerrain,
  debannir,
  deciderDemande,
  ecrireAuReserveur,
  enregistrerCreneaux,
  enregistrerPartenaires,
  fermerTerrains,
  lireApercuFermeture,
  lireCanal,
  lireChiffres,
  lireClient,
  lireClients,
  lireComplexeGere,
  lireFermetures,
  lireFidelite,
  lireHistoriqueClient,
  lireMesComplexes,
  lirePartenaires,
  lirePlanning,
  lireReservationGeree,
  lireReservationsDuComplexe,
  lireTerrains,
  marquerNonHonoree,
  modifierComplexeGere,
  modifierExterieur,
  modifierTerrain,
  noterExterieur,
  reglerFidelite,
  retirerTerrain,
  rouvrirFermetures,
  validerRecompense,
} from './complexeService';

/**
 * LES LECTURES ET LES GESTES DU GÉRANT — RESA-L5A1 (13/10/2026), chantier Réservation.
 *
 * Toutes les clefs commencent par `['complexe']` : un geste invalide ce préfixe, donc « Mes
 * complexes » (la bascule), le complexe géré, ses terrains et leurs créneaux suivent ensemble.
 * Chaque geste porte `meta.preventToastError` : l'écran dit lui-même le refus, traduit
 * (`complexeGerant.js`, `messageDeRefus`), sans l'alerte générale « Erreur » par-dessus.
 *
 * ⚠️ Caché par `COMPLEXES_GERANT` : rien ne lit ces routes tant que l'interrupteur est éteint.
 */

const DEMI_MINUTE = 30 * 1000;

/**
 * Les lignes d'un corps `{ data: [...] }`.
 * @param {any} corps - Le corps.
 * @returns {any[]} Les lignes, ou [].
 */
const lignes = (corps) => (Array.isArray(corps?.data) ? corps.data : []);

/** La clef de « Mes complexes ». */
export const MES_COMPLEXES_CLEF = Object.freeze(['complexe', 'mine']);

/**
 * La clef d'un complexe géré.
 * @param {string | null | undefined} complexeId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const complexeGereClef = (complexeId) => ['complexe', complexeId, 'manage'];

/**
 * La clef des terrains d'un complexe.
 * @param {string | null | undefined} complexeId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const terrainsClef = (complexeId) => ['complexe', complexeId, 'terrains'];

/**
 * MES complexes (AT-01) : la bascule s'affiche quand la liste n'est pas vide.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les complexes.
 */
export const useMesComplexes = ({ enabled = true } = {}) => useQuery({
  enabled,
  queryFn: async () => lignes(await lireMesComplexes()),
  queryKey: MES_COMPLEXES_CLEF,
  staleTime: DEMI_MINUTE,
});

/**
 * SON complexe, vu par son gestionnaire (règles comprises).
 * @param {string | null | undefined} complexeId - documentId.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Le complexe.
 */
export const useComplexeGere = (complexeId) => useQuery({
  enabled: Boolean(complexeId),
  queryFn: async () => (await lireComplexeGere(String(complexeId)))?.data ?? null,
  queryKey: complexeGereClef(complexeId),
  staleTime: DEMI_MINUTE,
});

/**
 * Les terrains de SON complexe (E-G02, E-G07, E-G08, E-G09).
 * @param {string | null | undefined} complexeId - documentId.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les terrains.
 */
export const useTerrains = (complexeId) => useQuery({
  enabled: Boolean(complexeId),
  queryFn: async () => lignes(await lireTerrains(String(complexeId))),
  queryKey: terrainsClef(complexeId),
  staleTime: DEMI_MINUTE,
});

/**
 * Un geste du gérant : refus dit par l'écran, et tout le préfixe `['complexe']` relu ensuite.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation.
 */
const useGeste = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { preventToastError: true },
    mutationFn,
    onSuccess: async (/** @type {any} */ reponse) => {
      // Un doublon possible ne crée rien : rien à relire.
      if (reponse?.data?.duplicate) return;
      await queryClient.invalidateQueries({ queryKey: ['complexe'] });
    },
  });
};

/**
 * « Créer mon complexe » (E-G01).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, Record<string, any>>} La
 *   mutation ; `mutateAsync(donnees)`.
 */
export const useCreerMonComplexe = () => useGeste((donnees) => creerMonComplexe(donnees));

/**
 * Modifier SON complexe (E-G16).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, donnees })`.
 */
export const useModifierComplexe = () => useGeste(
  ({ complexeId, donnees }) => modifierComplexeGere(complexeId, donnees),
);

/**
 * Créer ou modifier un terrain (E-G08) : sans `terrainId`, un terrain neuf.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, donnees, terrainId? })`.
 */
export const useEnregistrerTerrain = () => useGeste(({ complexeId, donnees, terrainId }) => (
  terrainId ? modifierTerrain(complexeId, terrainId, donnees) : creerTerrain(complexeId, donnees)
));

/**
 * Enregistrer le modèle de créneaux d'un terrain (E-G09).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, plan, terrainId })`.
 */
export const useEnregistrerCreneaux = () => useGeste(
  ({ complexeId, plan, terrainId }) => enregistrerCreneaux(complexeId, terrainId, plan),
);

// ---------------------------------------------------------------------------------------------
// RESA-L5A2 (14/10/2026) — les réservations, le planning, les fermetures (serveur RESA-L2A).
// ---------------------------------------------------------------------------------------------

/**
 * Le complexe d'un écran du gérant : celui de l'adresse s'il est parmi ceux du compte, sinon le
 * premier (un complexe par compte en V1). Les onglets de l'espace n'ont pas toujours l'adresse.
 * @param {string | null | undefined} complexeId - Le complexe demandé.
 * @returns {{ complexe: any, complexeId: string | null, mes: any }} Le complexe et la lecture.
 */
export const useComplexeChoisi = (complexeId) => {
  const mes = useMesComplexes();
  const complexe = complexeChoisi(mes.data, complexeId);
  return { complexe, complexeId: complexe?.documentId || null, mes };
};

/**
 * La clef d'une liste de réservations.
 * @param {string | null | undefined} complexeId - documentId.
 * @param {Record<string, unknown>} filtres - La vue et les filtres.
 * @returns {unknown[]} La clef.
 */
export const reservationsClef = (complexeId, filtres) => [
  'complexe', complexeId, 'reservations', filtres,
];

/**
 * Les réservations de SON complexe, par pages de 20 (E-G04, E-G06).
 * @param {string | null | undefined} complexeId - documentId.
 * @param {{ source?: string, statut?: string, terrain?: string, vue: string }} filtres - La vue.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<any>} Les pages.
 */
export const useReservationsDuComplexe = (complexeId, filtres, { enabled = true } = {}) => (
  useInfiniteQuery({
    enabled: enabled && Boolean(complexeId),
    getNextPageParam: (/** @type {any} */ derniere) => {
      const pagination = derniere?.pagination;
      if (!pagination) return undefined;
      const encore = pagination.page * pagination.pageSize < pagination.total;
      return encore ? pagination.page + 1 : undefined;
    },
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await lireReservationsDuComplexe(
      String(complexeId),
      /** @type {any} */ ({ ...filtres, page: pageParam }),
    ))?.data ?? null,
    queryKey: reservationsClef(complexeId, filtres),
    staleTime: DEMI_MINUTE,
  })
);

/**
 * La fiche d'une réservation (E-G05).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {string | null | undefined} reservationId - documentId de la réservation.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} La réservation.
 */
export const useReservationGeree = (complexeId, reservationId) => useQuery({
  enabled: Boolean(complexeId && reservationId),
  queryFn: async () => (await lireReservationGeree(
    String(complexeId),
    String(reservationId),
  ))?.data ?? null,
  queryKey: ['complexe', complexeId, 'reservation', reservationId],
  staleTime: DEMI_MINUTE,
});

/**
 * Le planning de SES terrains (E-G03, la frise et les chiffres de E-G02).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {{ from: string, terrain?: string, to: string }} periode - Les jours, un terrain.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} `{ from, to, terrains }`.
 */
export const usePlanning = (complexeId, periode, { enabled = true } = {}) => useQuery({
  enabled: enabled && Boolean(complexeId),
  queryFn: async () => (await lirePlanning(String(complexeId), periode))?.data ?? null,
  queryKey: ['complexe', complexeId, 'planning', periode],
  staleTime: DEMI_MINUTE,
});

/**
 * Les fermetures à venir de SES terrains (E-G10) : une liste par terrain, réunies.
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {string[]} terrainIds - Les terrains.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les fermetures, avec leur
 *   terrain (`terrainId`).
 */
export const useFermetures = (complexeId, terrainIds) => useQuery({
  enabled: Boolean(complexeId) && terrainIds.length > 0,
  queryFn: async () => lireFermetures(terrainIds),
  queryKey: ['complexe', complexeId, 'fermetures', terrainIds],
  staleTime: DEMI_MINUTE,
});

/**
 * L'aperçu d'une fermeture PENDANT la saisie (E-G10, « 4 réservations sont touchées ») : rien
 * n'est écrit.
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {string[]} terrainIds - Les terrains choisis.
 * @param {{ endDate: string, startDate: string } | null} dates - Les dates, ou null.
 * @returns {import('@tanstack/react-query').UseQueryResult<{ count: number, items: any[] }>} Les
 *   réservations touchées.
 */
export const useApercuFermeture = (complexeId, terrainIds, dates) => useQuery({
  enabled: Boolean(complexeId && dates?.startDate && dates?.endDate) && terrainIds.length > 0,
  queryFn: async () => lireApercuFermeture(terrainIds, /** @type {any} */ (dates)),
  queryKey: ['complexe', complexeId, 'apercu-fermeture', terrainIds, dates],
  staleTime: DEMI_MINUTE,
});

/**
 * Accepter ou refuser une demande (E-G06, E-G05).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, decision, reason?, reservationId })`.
 */
export const useDeciderDemande = () => useGeste(({
  complexeId, decision, reason, reservationId,
}) => deciderDemande(complexeId, reservationId, reason ? { decision, reason } : { decision }));

/**
 * Annuler une réservation (motif) ou supprimer une note « extérieur » (E-G05).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, motif, reservationId })`.
 */
export const useAnnulerReservation = () => useGeste(
  ({ complexeId, motif, reservationId }) => annulerReservationGeree(
    complexeId,
    reservationId,
    motif,
  ),
);

/**
 * « Réservé à l'extérieur » (E-G03).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, note })`.
 */
export const useNoterExterieur = () => useGeste(
  ({ complexeId, note }) => noterExterieur(complexeId, note),
);

/**
 * « Modifier le nom » d'une note « extérieur » (E-G05).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, nom, reservationId })`.
 */
export const useModifierExterieur = () => useGeste(
  ({ complexeId, nom, reservationId }) => modifierExterieur(complexeId, reservationId, nom),
);

/**
 * « Retirer » un terrain (E-G07, E-G08), après l'aperçu.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, terrainId })`.
 */
export const useRetirerTerrain = () => useGeste(
  ({ complexeId, terrainId }) => retirerTerrain(complexeId, terrainId),
);

/**
 * L'APERÇU du retrait : combien de réservations à venir seraient annulées. Rien n'est écrit.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, terrainId })` rend `{ data: { reservationsTouchees } }`.
 */
export const useApercuRetrait = () => useMutation({
  meta: { preventToastError: true },
  mutationFn: (/** @type {any} */ { complexeId, terrainId }) => retirerTerrain(
    complexeId,
    terrainId,
    { apercu: true },
  ),
});

/**
 * Fermer des jours (E-G10) : une fermeture PAR terrain (règle d'app du contrat L2A).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ fermeture, terrainIds })` rend `{ annulees, terrains }`.
 */
export const useFermerTerrains = () => useGeste(
  ({ fermeture, terrainIds }) => fermerTerrains(terrainIds, fermeture),
);

/**
 * « Rouvrir » (E-G10) ou « Débloquer » (E-G03) : un ÉTAT, jamais une suppression.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync(fermetureIds)`.
 */
export const useRouvrirFermetures = () => useGeste(
  (fermetureIds) => rouvrirFermetures(fermetureIds),
);

/**
 * « Bloquer ce créneau » (E-G03) : une plage d'un jour, motif facultatif ; une réservation dans la
 * plage est gardée.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ blocage, terrainId })`.
 */
export const useBloquerCreneau = () => useGeste(
  ({ blocage, terrainId }) => bloquerCreneau(terrainId, blocage),
);

// ---------------------------------------------------------------------------------------------
// RESA-L5B-1 (20/10/2026) — « non honorée » (serveur RESA-L2B).
// ---------------------------------------------------------------------------------------------

/**
 * « Non honorée » (E-G04, E-G05) : le serveur juge (`canMarkNoShow`), la liste et la fiche se
 * relisent ensuite (le bannissement automatique a peut-être suivi).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, reservationId })`.
 */
export const useMarquerNonHonoree = () => useGeste(
  ({ complexeId, reservationId }) => marquerNonHonoree(complexeId, reservationId),
);

/**
 * « Annuler le marquage » (E-G04 dans les 5 s, E-G05 dans les 7 jours).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, reservationId })`.
 */
export const useAnnulerNonHonoree = () => useGeste(
  ({ complexeId, reservationId }) => annulerNonHonoree(complexeId, reservationId),
);

/**
 * La fiche d'un client (E-G15) : rien n'est lu tant que le joueur n'est pas connu (depuis N-12,
 * l'écran le lit d'abord dans la fiche de la réservation).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {string | null | undefined} joueurId - documentId du joueur.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Le client.
 */
export const useClientDuComplexe = (complexeId, joueurId) => useQuery({
  enabled: Boolean(complexeId && joueurId),
  queryFn: async () => (await lireClient(String(complexeId), String(joueurId)))?.data ?? null,
  queryKey: ['complexe', complexeId, 'client', joueurId],
  staleTime: DEMI_MINUTE,
});

/**
 * RESA-L5B-1, partie B (serveur RESA-L2C) — l'aperçu d'un âge minimum RELEVÉ (E-G16) : combien de
 * réservations à venir comptent des joueurs plus jeunes. Rien n'est écrit ; lu seulement quand
 * l'écran le demande (`enabled`).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {number} minAge - L'âge essayé.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} `{ dryRun, minAge,
 *   reservationsPlusJeunes }`.
 */
export const useApercuAgeMinimum = (complexeId, minAge, { enabled = true } = {}) => useQuery({
  enabled: enabled && Boolean(complexeId),
  queryFn: async () => (await apercuReglages(String(complexeId), { minAge }))?.data ?? null,
  queryKey: ['complexe', complexeId, 'apercu-age', minAge],
  staleTime: DEMI_MINUTE,
});

/**
 * « Bannir » (E-G15) : la fiche, la liste et l'accueil se relisent ensuite.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ ban, complexeId })`.
 */
export const useBannir = () => useGeste(({ ban, complexeId }) => bannir(complexeId, ban));

/**
 * « Débannir » (E-G15).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, joueurId })`.
 */
export const useDebannir = () => useGeste(
  ({ complexeId, joueurId }) => debannir(complexeId, joueurId),
);

// ── RESA-L5B-2 (20/10/2026) — la communauté du complexe, côté gérant (serveur RESA-L4) ──────
/**
 * La page suivante d'une lecture par pages de 20 (`{ pagination: { page, pageSize, total } }`).
 * @param {any} derniere - La dernière page lue.
 * @returns {number | undefined} Son numéro, ou rien à la fin.
 */
const pageSuivante = (derniere) => {
  const pagination = derniere?.pagination;
  if (!pagination) return undefined;
  return pagination.page * pagination.pageSize < pagination.total ? pagination.page + 1 : undefined;
};

/**
 * Les CLIENTS de SON complexe (E-G15), par pages de 20 ; la fiche s'en sert aussi pour lire la
 * fidélité d'un client (cherché par son nom).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {{ onglet: string, recherche?: string }} filtres - L'onglet et le nom cherché.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<any>} Les pages.
 */
export const useClientsDuComplexe = (complexeId, filtres, { enabled = true } = {}) => (
  useInfiniteQuery({
    enabled: enabled && Boolean(complexeId),
    getNextPageParam: pageSuivante,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await lireClients(
      String(complexeId),
      { ...filtres, page: pageParam },
    ))?.data ?? null,
    queryKey: ['complexe', complexeId, 'clients', filtres],
    staleTime: DEMI_MINUTE,
  })
);

/**
 * L'historique d'un client ICI (E-G15, la fiche).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {string | null | undefined} joueurId - documentId du joueur.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} `{ parties, reservations }`.
 */
export const useHistoriqueClient = (complexeId, joueurId) => useQuery({
  enabled: Boolean(complexeId && joueurId),
  queryFn: async () => (
    await lireHistoriqueClient(String(complexeId), String(joueurId))
  )?.data ?? null,
  queryKey: ['complexe', complexeId, 'client', joueurId, 'historique'],
  staleTime: DEMI_MINUTE,
});

/**
 * Les statistiques de SON complexe (E-G17) pour une période ; aussi les deux tuiles de l'accueil
 * (occupation, nouveaux favoris de la semaine).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {'mois' | 'saison' | 'semaine'} periode - La période.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Les chiffres.
 */
export const useChiffresDuComplexe = (complexeId, periode, { enabled = true } = {}) => useQuery({
  enabled: enabled && Boolean(complexeId),
  queryFn: async () => (await lireChiffres(String(complexeId), periode))?.data ?? null,
  queryKey: ['complexe', complexeId, 'chiffres', periode],
  staleTime: DEMI_MINUTE,
});

/**
 * Le canal de SON complexe (E-G12) : sa conversation et ses membres.
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} `{ chatId, liste, membres }`.
 */
export const useCanalDuComplexe = (complexeId) => useQuery({
  enabled: Boolean(complexeId),
  meta: { preventToastError: true },
  queryFn: async () => (await lireCanal(String(complexeId)))?.data ?? null,
  queryKey: ['complexe', complexeId, 'canal'],
  retry: false,
  staleTime: DEMI_MINUTE,
});

/**
 * Les partenaires de SON complexe (E-G11).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les partenaires.
 */
export const usePartenairesDuComplexe = (complexeId) => useQuery({
  enabled: Boolean(complexeId),
  queryFn: async () => {
    const lu = (await lirePartenaires(String(complexeId)))?.data;
    return Array.isArray(lu?.items) ? lu.items : [];
  },
  queryKey: ['complexe', complexeId, 'partenaires'],
  staleTime: DEMI_MINUTE,
});

/**
 * « Enregistrer » les partenaires (la liste entière) ; la page se relit ensuite.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, partenaires })`.
 */
export const useEnregistrerPartenaires = () => useGeste(
  ({ complexeId, partenaires }) => enregistrerPartenaires(complexeId, partenaires),
);

/**
 * La fidélité de SON complexe (E-G14) : le programme et les trois listes.
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} `{ programme, aValider, bientot,
 *   dernieresValidees }`.
 */
export const useFideliteDuComplexe = (complexeId) => useQuery({
  enabled: Boolean(complexeId),
  queryFn: async () => (await lireFidelite(String(complexeId)))?.data ?? null,
  queryKey: ['complexe', complexeId, 'fidelite'],
  staleTime: DEMI_MINUTE,
});

/**
 * « Enregistrer » le programme de fidélité (E-G14) ; la fidélité, les clients et l'accueil se
 * relisent ensuite.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, programme })`.
 */
export const useReglerFidelite = () => useGeste(
  ({ complexeId, programme }) => reglerFidelite(complexeId, programme),
);

/**
 * « Valider la partie offerte » (E-G14).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, joueurId })`.
 */
export const useValiderRecompense = () => useGeste(
  ({ complexeId, joueurId }) => validerRecompense(complexeId, joueurId),
);

/**
 * « Écrire » au réserveur (E-G15) : ouvre la conversation de sa réservation ; rien à relire.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, reservationId })` rend `{ data: { chat } }`.
 */
export const useEcrireAuReserveur = () => useMutation({
  meta: { preventToastError: true },
  mutationFn: (/** @type {any} */ { complexeId, reservationId }) => (
    ecrireAuReserveur(complexeId, reservationId)
  ),
});

/**
 * L'APERÇU du modèle (`dryRun`) : jugé et résumé par le serveur, rien n'est écrit, rien ne se
 * relit.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, any, any>} La mutation ;
 *   `mutateAsync({ complexeId, plan, terrainId })` rend `{ data: { creneaux, slotPlan } }`.
 */
export const useApercuCreneaux = () => useMutation({
  meta: { preventToastError: true },
  mutationFn: (/** @type {any} */ { complexeId, plan, terrainId }) => enregistrerCreneaux(
    complexeId,
    terrainId,
    plan,
    { apercu: true },
  ),
});
