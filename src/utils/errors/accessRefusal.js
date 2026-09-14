/**
 * « Le serveur m'a-t-il REFUSÉ l'accès ? » — le juge partagé du lot VA1.
 *
 * Un 403 n'est pas une panne : c'est une réponse. Un écran qui le traite comme
 * une liste vide ment (« Aucune statistique disponible ») ; un capteur qui
 * l'envoie à Sentry crie au bug (REACT-NATIVE-2 et -1 : 167 événements du
 * 03/09 au 13/09, 14 utilisateurs). Les deux lisent désormais cette fonction.
 *
 * ⛔ Un 403 portant `INTERNAL_SERVER_ERROR` n'est PAS un refus : c'est le `catch`
 * général d'une politique serveur (admin/src/api/team/policies/is-team-member.ts)
 * qui déguise une panne de lecture. L'écran doit alors proposer de réessayer,
 * et Sentry doit le voir.
 *
 * Module volontairement SANS dépendance : les bancs d'écran doublent
 * `@/utils/errors/displayError`, un import de plus là-bas les casserait.
 */

/**
 * Lit le status quelle que soit la forme de l'erreur : charge Strapi déballée
 * par l'intercepteur (`error.status`) ou erreur axios brute.
 * @param {any} error
 * @returns {number | null}
 */
const readStatus = (error) => {
  const parsed = Number(error?.status ?? error?.response?.status ?? error?.error?.status);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Lit le code applicatif posé par le serveur, quelle que soit la forme de l'erreur.
 * @param {any} error
 * @returns {string}
 */
const readCode = (error) => String(
  error?.details?.code
  ?? error?.response?.data?.error?.details?.code
  ?? error?.response?.data?.code
  ?? error?.code
  ?? '',
);

/**
 * Dit si l'erreur est un refus de droit, et non une panne.
 * @param {unknown} error L'erreur rendue par une requête.
 * @returns {boolean} true si c'est un refus de droit (403), et non une panne déguisée.
 */
export const isAccessRefusalError = (error) => (
  readStatus(error) === 403 && readCode(error) !== 'INTERNAL_SERVER_ERROR'
);

export default isAccessRefusalError;
