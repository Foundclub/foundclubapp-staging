import { useQuery } from '@tanstack/react-query';

import { corpsDeLAffiche } from '@/domains/complexe/afficheDuComplexe';

// Résolution par suffixe de plateforme (`.native.js` / `.web.js`), comme l'export des
// statistiques : le contrôle de types ne voit pas leurs exports à ce chemin exact.
// @ts-ignore -- cf. ci-dessus
import { downloadAndShareRender, fetchRenderBase64 } from '@/platform/visualRender';

/**
 * L'AFFICHE D'UN COMPLEXE — RESA-L5B-2 (20/10/2026), E-G13, serveur RESA-L4
 * (`POST /complexes/:id/affiche`, gérant de SON complexe). La route rend des OCTETS (PNG en post /
 * story, PDF en A4, image légère en aperçu), comme le moteur d'affiches des clubs : on reprend son
 * transport (`@/platform/visualRender`, aperçu en base64, partage du fichier au téléphone,
 * téléchargement sur le site), avec la route et le corps du complexe (`path`, `body`).
 * Module à part de `complexeService` : il charge le transport natif des fichiers, que les autres
 * lectures du complexe n'ont pas à charger.
 */

/**
 * La route de l'affiche de SON complexe.
 * @param {unknown} complexeId - documentId du complexe.
 * @returns {string} Le chemin.
 */
const cheminDeLAffiche = (complexeId) => (
  `/complexes/${encodeURIComponent(String(complexeId || ''))}/affiche`
);

/**
 * L'aperçu de l'affiche (image légère, format post) en adresse `data:`.
 * @param {string} complexeId - documentId du complexe.
 * @param {Record<string, any>} choix - Le texte, la promotion, le style, la fidélité.
 * @returns {Promise<string>} L'image.
 */
export const creerApercuAffiche = async (complexeId, choix) => {
  const { base64, contentType } = await fetchRenderBase64({
    body: corpsDeLAffiche({ ...choix, apercu: true, format: 'post' }),
    path: cheminDeLAffiche(complexeId),
  });
  return `data:${contentType};base64,${base64}`;
};

/**
 * « Partager l'affiche » (post), « Story 9:16 », « Imprimer en A4 » (PDF) : le fichier complet,
 * confié au téléphone (feuille de partage, enregistrement) ou téléchargé sur le site.
 * @param {string} complexeId - documentId du complexe.
 * @param {Record<string, any>} choix - Le texte, la promotion, le style, la fidélité, le format.
 * @param {{ dialogTitle?: string }} [options] - Le titre du sélecteur d'application (Android).
 * @returns {Promise<any>} Ce que rend le transport (l'issue du partage, ou l'adresse du fichier).
 */
export const partagerAffiche = async (complexeId, choix, { dialogTitle, message } = {}) => (
  downloadAndShareRender({
    body: corpsDeLAffiche({ ...choix, apercu: false }),
    dialogTitle,
    format: choix.format,
    message,
    path: cheminDeLAffiche(complexeId),
    subjectId: complexeId,
    template: 'affiche-complexe',
    variant: choix.style,
  })
);

/**
 * L'aperçu de l'affiche, relu quand un choix change (texte, prix, style, fidélité).
 * @param {string | null | undefined} complexeId - documentId du complexe.
 * @param {Record<string, any>} choix - Les choix de l'écran.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : rien n'est lu (complexe suspendu).
 * @returns {import('@tanstack/react-query').UseQueryResult<string>} L'image de l'aperçu.
 */
export const useApercuAffiche = (complexeId, choix, { enabled = true } = {}) => useQuery({
  enabled: enabled && Boolean(complexeId),
  meta: { preventToastError: true },
  queryFn: () => creerApercuAffiche(String(complexeId), choix),
  queryKey: [
    'complexe', complexeId, 'affiche', corpsDeLAffiche({ ...choix, apercu: true, format: 'post' }),
  ],
  retry: false,
  staleTime: 5 * 60 * 1000,
});
