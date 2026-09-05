import {
  BOOT_REQUEST_BLOCKED_CODE,
  BOOT_REQUEST_NO_SESSION_CODE,
} from '@/services/bootRequestGuard';

/**
 * A map of ignored API status codes.
 * @type {{ [key: number]: boolean }}
 */
export const ignoredApiStatusCodes = {
  401: true,
};

/**
 * Codes filtrés QUELLE QUE SOIT la requête.
 *
 * ⚠️ N'y mettre qu'un code dont on a vérifié qu'il ne peut JAMAIS signaler un
 * défaut. Les deux seuls qui tiennent cette promesse sont les refus que l'app
 * se prononce à elle-même, sans réseau (`bootRequestGuard.js`) : ce sont des
 * décisions volontaires du client, pas des réponses du serveur.
 *
 * ⛔ `EVENT_FIND_ERROR` n'y est PAS, et ce n'est pas un oubli : c'est le code
 * FOURRE-TOUT du contrôleur d'événements. Il sort aussi du `catch` général de
 * `getMyPlanning` (admin/src/api/event/controllers/event.ts:2137) et de
 * `getTournamentDashboard` (event.ts:3043). Le filtrer par code rendrait
 * invisible un vrai plantage du planning. Son bruit se coupe par requête, plus
 * bas.
 * @type {{ [key: string]: boolean }}
 */
export const ignoredApiErrorCodes = {
  [BOOT_REQUEST_BLOCKED_CODE]: true,
  [BOOT_REQUEST_NO_SESSION_CODE]: true,
};

/**
 * Familles de requêtes dont un refus **400** est un état NORMAL du produit, et
 * non un défaut : demander les statistiques d'un match dans un sport qui n'en
 * gère pas. Le serveur a raison de refuser (`This sport is not supported for
 * match statistics`, admin/src/api/match-stats-report/services/
 * match-stats-report.ts:1735 pour l'événement, :1806 pour la ligue).
 *
 * 🔑 Pourquoi par REQUÊTE et pas par code : les deux moitiés du même refus
 * n'ont pas la même forme. `/events/:id/match-stats` passe par
 * `handleMatchStatsError` (event.ts:622) qui retombe sur le code fourre-tout,
 * tandis que `/teams/:id/performance-stats` (team.ts:1472) n'a AUCUN
 * `try/catch` : sa `ValidationError` remonte au gestionnaire par défaut de
 * Strapi, qui ne pose aucun code. Un filtre par code ne pourrait donc taire
 * que la moitié du bruit.
 *
 * ⛔ Ne vaut QUE pour un 400. Un 5xx sur ces mêmes requêtes reste un défaut et
 * part toujours à Sentry.
 * @type {{ [key: string]: boolean }}
 */
export const businessRefusalQueryKeys = {
  eventMatchStats: true,
  leagueMatchStats: true,
  leagueTeamPerformanceStats: true,
  teamPerformanceStats: true,
};

/**
 * Lit le status quelle que soit la forme de l'erreur.
 *
 * Les intercepteurs de réponse (client.native.js:88, client.web.js:86)
 * rejettent la charge DÉBALLÉE `error.response.data.error`, jamais l'erreur
 * axios : une erreur applicative Strapi arrive donc ici sans `response`, avec
 * son code dans `error.status`. Même lecture à trois branches que
 * `getErrorStatus` dans app/src/app/queryClient.js:23.
 * @param {any} error
 * @returns {number}
 */
const readStatus = (error) => {
  const rawStatus = error?.status
    ?? error?.response?.status
    ?? error?.error?.status;
  const parsed = Number(rawStatus);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Lit le code applicatif quelle que soit la forme de l'erreur.
 * @param {any} error
 * @returns {string|undefined}
 */
const readErrorCode = (error) => {
  const rawCode = error?.details?.code
    ?? error?.response?.data?.code
    ?? error?.response?.data?.error?.code
    ?? error?.code;
  return typeof rawCode === 'string' ? rawCode : undefined;
};

/**
 * Dit si la requête à l'origine de l'erreur est de celles dont un refus est normal.
 * @param {any} query - La query react-query passée par `QueryCache.onError`.
 * @returns {boolean} Vrai si la famille de clés est déclarée à refus métier.
 */
const isBusinessRefusalQuery = (query) => {
  const family = Array.isArray(query?.queryKey) ? query.queryKey[0] : undefined;
  return typeof family === 'string' && businessRefusalQueryKeys[family] === true;
};

/**
 * Dit si une erreur de requête doit être TUE plutôt qu'envoyée à Sentry.
 * @param {unknown} error - L'erreur, déballée par l'intercepteur ou brute.
 * @param {any} [query] - La query react-query à l'origine de l'erreur.
 * @returns {boolean} Vrai si l'erreur ne doit PAS partir à Sentry.
 */
export const isInSentryExceptionsAllowList = (error, query) => {
  const status = readStatus(error);
  if (ignoredApiStatusCodes[status] === true) return true;

  const errorCode = readErrorCode(error);
  if (errorCode !== undefined && ignoredApiErrorCodes[errorCode] === true) return true;

  return status === 400 && isBusinessRefusalQuery(query);
};
