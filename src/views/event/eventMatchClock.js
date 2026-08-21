/**
 * AC10 — QUELLE HORLOGE DIT QU'UN MATCH EST FINI.
 *
 * `EventDetails` lisait l'horloge du TELEPHONE (`Date.now()`) pour decider qu'un
 * match etait termine, donc pour ouvrir les statistiques d'apres-match. Un
 * telephone en avance — ou simplement dans un autre fuseau — les ouvrait avant
 * le coup d'envoi ; un telephone en retard les cachait a quelqu'un dont le match
 * etait fini depuis une heure. La seule horloge qui fait foi est celle du
 * SERVEUR (`serverNow`, rendu par la reponse de presence).
 *
 * ⚠️ Ce module ne concerne QUE les decisions de droit/etat. Les affichages de
 * temps relatif (« il y a 2 heures ») doivent continuer a lire l'horloge locale :
 * c'est le temps du lecteur qu'ils racontent, pas celui du serveur.
 */

/**
 * Duree retenue quand l'evenement n'a pas d'heure de fin.
 *
 * Ce n'est pas un chiffre choisi ici : c'est la RECOPIE de la valeur que le
 * serveur applique pour la meme question, dans
 * `admin/src/api/match-stats-report/services/match-stats-report.ts`
 * (`DEFAULT_MATCH_DURATION_MINUTES = 120`, utilise par son `getEventEndedAt`).
 * C'est ce service qui accepte ou refuse les statistiques ; une autre valeur ici
 * ferait dire a l'app « c'est fini » alors que la machine qui produit les stats
 * pense l'inverse.
 */
export const DEFAULT_MATCH_DURATION_MINUTES = 120;

/**
 * Lit une date sans jamais rendre une date invalide.
 * @param {unknown} value
 * @returns {Date | null}
 */
const parseDateSafe = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(/** @type {any} */ (value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * L'heure de fin de l'evenement : celle qu'il declare, sinon son debut plus la
 * duree par defaut du serveur.
 * @param {unknown} eventEndDate
 * @param {unknown} eventStartAt
 * @returns {Date | null}
 */
export const resolveEventEndedAt = (eventEndDate, eventStartAt) => {
  const explicitEnd = parseDateSafe(eventEndDate);
  if (explicitEnd) return explicitEnd;

  const start = parseDateSafe(eventStartAt);
  if (!start) return null;

  return new Date(start.getTime() + (DEFAULT_MATCH_DURATION_MINUTES * 60 * 1000));
};

/**
 * Le match est-il fini ? Repond avec l'horloge du SERVEUR, jamais celle du
 * telephone. ⛔ Sans horloge serveur, la reponse est NON : ouvrir des
 * statistiques d'apres-match trop tot est pire que les ouvrir trop tard, car on
 * demande alors son ressenti a quelqu'un dont le match n'a pas commence.
 * @param {{ eventEndedAt: Date | null | undefined; serverNowMs: number | null | undefined; }} input
 * @returns {boolean}
 */
export const resolveIsMatchFinished = ({ eventEndedAt, serverNowMs }) => {
  const endedAt = parseDateSafe(eventEndedAt);
  if (!endedAt) return false;
  if (!Number.isFinite(serverNowMs)) return false;

  return endedAt.getTime() <= Number(serverNowMs);
};

export default resolveIsMatchFinished;
