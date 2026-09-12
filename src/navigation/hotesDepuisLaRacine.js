import { RouteNames } from '@/navigation/routeNames';

/**
 * NAVMORTE2 (2026-09-11) -- OU VIT UN ECRAN, VU DE LA PILE RACINE.
 *
 * Certains ecrans ne sont montes que dans un navigateur imbrique. Depuis la pile
 * RACINE (la liste des notifications, la bulle, l appui sur un push, la fenetre
 * d invitation), un navigate(ecran) nu remonte vers les parents et n est traite par
 * AUCUN navigateur : l appui ne fait rien. Mesure le 2026-09-11 : 38 couples « type de
 * notification x ecran » morts de cette facon, et le bouton « Voir » de la fenetre
 * d invitation pour un club, un evenement et une equipe.
 *
 * Pour chaque ecran concerne, la table donne la chaine de navigateurs a traverser
 * depuis la racine, du plus haut au plus bas. Elle vit ici, a cote de
 * allerDansLOnglet, parce que c est une question de NAVIGATION.
 *
 * ⚠️ SubscriptionOffers est AUSSI monte a la racine, mais cette copie-la est le SAS de
 * fin d inscription (PrivateNavigator.js:988-1009) : « Continuer gratuitement » y mene a
 * la page cadeau puis a Welcome. Les offres ordinaires sont celles du profil.
 * @type {Readonly<Record<string, string[]>>}
 */
export const HOTES_DEPUIS_LA_RACINE = Object.freeze({
  [RouteNames.AdminDashboard]: [RouteNames.AdminStack],
  [RouteNames.Club]: [RouteNames.ClubStack],
  [RouteNames.EndMatchScreen]: [RouteNames.LeagueHomeTab, RouteNames.LeagueDashboard],
  [RouteNames.EventDetails]: [RouteNames.EventStack],
  [RouteNames.LeagueMatchTab]: [RouteNames.LeagueHomeTab],
  [RouteNames.SubscriptionOffers]: [RouteNames.ProfileStack],
  [RouteNames.SubscriptionOverview]: [RouteNames.ProfileStack],
  [RouteNames.TeamDetails]: [RouteNames.TeamStack],
  [RouteNames.TournamentManagement]: [RouteNames.EventStack],
});

/**
 * Enveloppe une destination { route, params } dans ses hotes depuis la racine.
 * Une destination absente de la table (deja imbriquee, ou portee par la racine) ressort
 * telle quelle.
 *
 * routesDeLaRacine -- les routes de la racine REELLEMENT montee, quand l appelant les
 * connait. Le navigateur public porte Club, EventDetails et TeamDetails nus, sans leurs
 * piles : une racine qui n a pas le premier hote garde donc la destination nue. Sans cet
 * argument (les notifications : on n en recoit qu une fois connecte), on enveloppe.
 * @param {{ route?: string, params?: Record<string, unknown> } | null} destination
 * @param {string[]} [routesDeLaRacine] les routes de la racine montee, si connues
 * @returns {{ route?: string, params?: Record<string, unknown> } | null} la destination
 *   imbriquee, ou celle recue
 */
export const imbriquerDepuisLaRacine = (destination, routesDeLaRacine) => {
  const hotes = destination ? HOTES_DEPUIS_LA_RACINE[String(destination.route || '')] : undefined;
  if (!destination || !hotes) return destination;
  if (Array.isArray(routesDeLaRacine) && !routesDeLaRacine.includes(hotes[0])) return destination;

  return hotes.reduceRight((imbriquee, hote) => ({
    params: { params: imbriquee.params, screen: imbriquee.route },
    route: hote,
  }), destination);
};

export default imbriquerDepuisLaRacine;
