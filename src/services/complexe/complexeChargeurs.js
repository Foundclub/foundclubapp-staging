/**
 * LES DEUX DÉPENDANCES DE complexeService.js CHARGÉES À L'APPEL — pour l'app et jest.
 * RESA-L7-1 (20/10/2026), chantier Réservation.
 *
 * Le client HTTP exige l'adresse du serveur dès son chargement : importé en tête, il fait échouer
 * au chargement 10 suites de témoins dans toute copie de travail sans `.env` (mesuré par RESA-L6A,
 * mémoire piege-env-absent-worktree-import-service) ; un `import()` dynamique, jest ne l'exécute
 * pas. D'où ces `require` à l'appel, que Metro et jest savent faire.
 *
 * ⚠️ Le site NE compile PAS ce fichier : Vite prend le jumeau `complexeChargeurs.web.js`
 * (web/vite.config.ts, `resolve.extensions` : `.web.js` d'abord), qui importe les deux en tête —
 * le serveur de dev du site n'a pas `require`. Les deux fichiers ont les mêmes exports (témoin
 * `views/reserverTerrain/__tests__/site.sansRequire.test.js`).
 */

/**
 * Le client HTTP de l'app, chargé à l'appel.
 * @returns {any} Le client axios.
 */
// eslint-disable-next-line global-require
export const client = () => require('../client').default;

/**
 * Le service des fermetures (il importe le client), chargé à l'appel.
 * @returns {any} Le module.
 */
// eslint-disable-next-line global-require
export const fermetures = () => require('../facilityClosure/facilityClosureService');
