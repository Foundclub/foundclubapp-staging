export const keepPreviousPageData = (/** @type {any} */ previousData) => previousData;

/**
 * @param {{ placeholderData?: any }} [options]
 * @returns {any}
 */
export const getPlaceholderDataOption = (options = {}) => (
  Object.prototype.hasOwnProperty.call(options || {}, 'placeholderData')
    ? options.placeholderData
    : keepPreviousPageData
);

/**
 * PERF-2 (D70, 12/11/2026) — LES TABLES DE REFERENCE (sports, categories, niveaux, sections).
 *
 * Elles ne changent que dans l'administration du serveur, jamais depuis l'app. Sans duree de
 * fraicheur, chaque ecran qui les monte les relisait : « Modifier l'equipe » faisait 7 appels a
 * l'ouverture, dont 4 pour ces quatre listes deja en cache.
 *
 * ponytail: limite assumee — une categorie ajoutee cote serveur apparait dans l'app au plus
 * 30 min plus tard (ou au redemarrage). Sortie : `invalidateQueries({ queryKey: ['categories'] })`
 * la ou une telle ecriture viendrait a exister dans l'app, ou une duree plus courte ici.
 * Temoin : views/team/__tests__/TeamEdit.PERF2.test.js.
 * @type {number}
 */
export const REFERENCE_TABLE_STALE_MS = 30 * 60 * 1000;
