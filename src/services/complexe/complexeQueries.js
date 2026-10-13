import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  creerMonComplexe,
  creerTerrain,
  enregistrerCreneaux,
  lireComplexeGere,
  lireMesComplexes,
  lireTerrains,
  modifierComplexeGere,
  modifierTerrain,
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
