import { formatDateWithDayPrefix } from '@/utils/date';

/**
 * COLLECTIVITES 1c (2026-09-29) — ce que les ecrans « Ma collectivite » affichent, en
 * fonctions PURES : aucun appel reseau, aucun client HTTP importe. N importe quel ecran
 * (ou le site) les importe sans doublure de test (memoire
 * piege-env-absent-worktree-import-service : les hooks restent dans services/).
 */

/**
 * La collectivite `collectiviteId` parmi celles que je gere, ou `null`.
 * @param {unknown} collectivites - La reponse de `/collectivites/mine`.
 * @param {string | null | undefined} collectiviteId - documentId recherche.
 * @returns {{ documentId?: string, name?: string, type?: string } | null} La collectivite, ou
 *   null si je ne la gere pas.
 */
export const findManagedCollectivite = (collectivites, collectiviteId) => {
  if (!Array.isArray(collectivites) || !collectiviteId) return null;
  return collectivites.find((collectivite) => collectivite?.documentId === collectiviteId) || null;
};

/**
 * « 18:00 » depuis une date ISO, a l heure du telephone ; '' si illisible.
 * @param {string | null | undefined} value - Date ISO.
 * @returns {string} L heure.
 */
const formatHour = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const deux = (/** @type {number} */ valeur) => String(valeur).padStart(2, '0');
  return `${deux(date.getHours())}:${deux(date.getMinutes())}`;
};

/**
 * Le moment d une demande ou d un occupant : « jeu 01/10/2026 · 18:00 – 19:30 ».
 * @param {string | null | undefined} start - Debut (ISO).
 * @param {string | null | undefined} end - Fin (ISO).
 * @returns {string} Le libelle, ou '' si le debut est illisible.
 */
export const formatSlot = (start, end) => {
  const day = formatDateWithDayPrefix(start, { fallback: '' });
  if (!day) return '';
  const from = formatHour(start);
  const to = formatHour(end);
  return to ? `${day} · ${from} – ${to}` : `${day} · ${from}`;
};

/**
 * Les horaires d ouverture d une installation : « 08:00 – 22:00 » ; '' s il en manque un.
 * @param {string | null | undefined} openingTime - « HH:MM[:SS[.mmm]] ».
 * @param {string | null | undefined} closingTime - « HH:MM[:SS[.mmm]] ».
 * @returns {string} Le libelle.
 */
export const formatOpeningHours = (openingTime, closingTime) => {
  const open = String(openingTime || '').slice(0, 5);
  const close = String(closingTime || '').slice(0, 5);
  return open && close ? `${open} – ${close}` : '';
};

/**
 * « HH:MM » depuis la valeur du serveur (« 08:00:00.000 »), pour un champ de saisie.
 * @param {string | null | undefined} value - L horaire.
 * @returns {string} « HH:MM » ou ''.
 */
export const toTimeInput = (value) => String(value || '').slice(0, 5);

/**
 * Un nombre de la collectivite pour l accueil : le nombre, « … » pendant la lecture,
 * « — » si la lecture a echoue (jamais un 0 invente).
 * @param {{ data?: unknown, error?: unknown, isLoading?: boolean }} query - Resultat react-query.
 * @returns {string} Le libelle.
 */
export const countLabel = (query) => {
  if (query?.isLoading) return '…';
  if (query?.error || !Array.isArray(query?.data)) return '—';
  return String(query.data.length);
};
