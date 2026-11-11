import { homeTarget } from '@/domains/tour/guideCommon';
import t from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

import { RESERVATIONS_SUR_ACCUEIL } from '@/config/fonctionsMasquees';

/**
 * Guide Dirigeant·e, bonus B5 « Rechercher » : une visite, aucun geste. L'accueil a 5 cases depuis
 * le 02/11 (Réservations, absente du pack) ; une bulle par case présente. Un dirigeant qui a son
 * club voit toujours Profils (`hasManageSection`).
 */

/**
 * Bulle sur une case de l'accueil. GUIDE-D-CORR-3 (M1083, TestFlight 2.6.97) : toucher la case
 * ouvrait sa page et la bulle disait « Tu as quitté le guide ici ». La case touchée aiguille
 * vers la bulle de sa page (`<id>-page`) ; « Suivant » garde le parcours d'une bulle par case.
 * La case ouvre un alias (SearchEvents…) qui se remplace par SearchHub : les deux comptent.
 * @param {string} id - Id de l'étape.
 * @param {string} card - Clé de la carte (`home.card.<clé>`).
 * @param {string} route - Écran qu'ouvre la case (HomeHub.js, `searchCards`).
 * @param {() => string} text - Texte.
 * @param {any} [extras] - Propriétés en plus.
 * @returns {any} Étape.
 */
const cardStep = (id, card, route, text, extras = {}) => Object.defineProperties({
  advanceOn: [...new Set([route, RouteNames.SearchHub])]
    .map((key) => ({ goto: `${id}-page`, key, type: 'route' })),
  id,
  missionId: 'president_b5',
  navTarget: homeTarget,
  get nextLabel() { return t('next', 'Suivant'); },
  targets: [`home.card.${card}`],
  get text() { return text(); },
}, Object.getOwnPropertyDescriptors(extras));

/**
 * La page d'une case, dans la pile de l'onglet Accueil (comme `homeTarget`) : « Reprendre » la
 * rouvre là où la case l'avait ouverte, pas à la racine.
 * @param {string} screen - Écran ouvert par la case.
 * @param {any} [params] - Ses paramètres.
 * @returns {any} Cible de navigation.
 */
const pageTarget = (screen, params) => ({
  params: { params: { params, screen }, screen: RouteNames.Search },
  routeName: RouteNames.HomeTab,
});

/**
 * Bulle de la page ouverte depuis une case, hors du parcours par « Suivant » (`when` faux) : on
 * n'y entre que par l'aiguillage de la case. Le retour à l'accueil (flèche ou onglet) mène à la
 * case suivante. Pas de bouton « Suivant » ici : il ramènerait à l'accueil par le guide, et
 * l'arrivée sur l'accueil serait lue comme un retour à la case d'avant (`stepBack`).
 * @param {string} id - Id de l'étape de la case.
 * @param {any} navTarget - La page, pour « Reprendre » (`pageTarget`).
 * @param {() => string} text - Texte.
 * @param {any} [extras] - Propriétés en plus.
 * @returns {any} Étape.
 */
const pageStep = (id, navTarget, text, extras = {}) => Object.defineProperties({
  advanceOn: { key: RouteNames.SearchHome, type: 'route' },
  bubblePlacement: 'top',
  id: `${id}-page`,
  missionId: 'president_b5',
  navTarget,
  targets: ['header.back'],
  get text() { return text(); },
  when: () => false,
}, Object.getOwnPropertyDescriptors(extras));

/**
 * GUIDE-RECHERCHER (M1101, TestFlight 2.6.98 ; « 216- A », liste validée par le chef le 10/11) :
 * la page d'une case s'explique en quelques bulles courtes (les dates, les filtres, les onglets),
 * une seule zone désignée par bulle, montrée sans être touchée (`lookOnly`) : la flèche de
 * l'en-tête reste libre. « Suivant » passe à la bulle suivante de la même page (`nextGoto`, sans
 * navigation) ; de n'importe quelle bulle, la flèche mène à la case suivante (`pageStep`).
 * La première bulle garde l'id `<case>-page`, celui où la case aiguille.
 * @param {string} id - Id de l'étape de la case.
 * @param {any} navTarget - La page, pour « Reprendre » (`pageTarget`).
 * @param {Array<[string, string, () => string]>} bubbles - Suffixe d'id, zone désignée, texte.
 * @param {any} [extras] - Propriétés en plus, sur chaque bulle de la page.
 * @param {any} [lastExtras] - Propriétés de la dernière bulle (« Compris » de la fin du bonus).
 * @returns {any[]} Étapes.
 */
const pageBubbles = (id, navTarget, bubbles, extras = {}, lastExtras = {}) => bubbles.map((
  [suffix, target, text],
  index,
) => {
  const next = bubbles[index + 1];
  const own = next
    ? Object.defineProperties({ nextGoto: `${id}-${next[0]}` }, {
      nextLabel: { enumerable: true, get: () => t('next', 'Suivant') },
    })
    : lastExtras;
  return pageStep(id, navTarget, text, Object.defineProperties({
    id: `${id}-${suffix}`,
    lookOnly: true,
    targets: [target],
  }, {
    ...Object.getOwnPropertyDescriptors(extras),
    ...Object.getOwnPropertyDescriptors(own),
  }));
});

export const B5_MISSION = {
  estimatedSeconds: 10,
  gaugeStep: 0,
  id: 'president_b5',
  locked: false,
  get title() { return t('missionTitles.b5', 'Rechercher, en un coup d’œil'); },
};

export const B5_STEPS = [
  {
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'b5-back',
    missionId: 'president_b5',
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.home'],
    get text() { return t('b5-back', 'Dernier coup d’œil : retourne à l’accueil.'); },
  },
  cardStep('b5-ev', 'search-events', RouteNames.SearchEvents, () => t(
    'b5-ev',
    'Événement : tournois, stages et détections autour de toi.',
  )),
  ...pageBubbles('b5-ev', pageTarget(RouteNames.SearchEvents), [
    ['page', 'search.events.dates', () => t(
      'b5-ev-page',
      'Touche un jour pour voir ses événements, ou le mois pour changer de mois.',
    )],
    ['filters', 'search.filters', () => t(
      'b5-ev-filters',
      'Les filtres : sport, ville et rayon, catégorie, niveau, type d’événement. La flèche te '
        + 'ramène à l’accueil.',
    )],
  ]),
  cardStep('b5-cl', 'search-clubs', RouteNames.SearchClubs, () => t(
    'b5-cl',
    'Club : les autres clubs, pour un partenariat ou un amical.',
  )),
  ...pageBubbles('b5-cl', pageTarget(RouteNames.SearchClubs), [
    ['page', 'search.clubs.chips', () => t(
      'b5-cl-page',
      'Choisis un sport et une ville ici, en un geste.',
    )],
    ['filters', 'search.filters', () => t(
      'b5-cl-filters',
      'D’autres filtres ici : sport, lieu et rayon. La flèche te ramène à l’accueil.',
    )],
  ]),
  cardStep('b5-re', 'search-reservations', RouteNames.SearchReservations, () => t(
    'b5-re',
    'Réservations : les créneaux de terrains à réserver près de toi.',
  ), { when: () => RESERVATIONS_SUR_ACCUEIL }),
  pageStep('b5-re', pageTarget(RouteNames.SearchReservations), () => t(
    'b5-re-page',
    'Voici les créneaux de terrains libres. La flèche te ramène à l’accueil.',
  )),
  cardStep('b5-pr', 'search-profiles', RouteNames.SearchRecruitment, () => t(
    'b5-pr',
    'Profils : les joueur·se·s et coachs ouverts au recrutement.',
  )),
  ...pageBubbles('b5-pr', pageTarget(RouteNames.SearchRecruitment, {
    initialRecruitmentTab: 'profils',
  }), [
    ['page', 'search.recruitment.tabs', () => t(
      'b5-pr-page',
      'Profils : les joueur·se·s à recruter. Opportunités : les annonces. Candidatures : les '
        + 'réponses reçues.',
    )],
    ['filters', 'search.filters', () => t(
      'b5-pr-filters',
      'Filtre par sport, ville et rayon, catégorie, poste. La flèche te ramène à l’accueil.',
    )],
  ]),
  cardStep('b5-fr', 'search-amicaux', RouteNames.SearchHub, () => t(
    'b5-fr',
    'Matchs amicaux : trouve un adversaire, ou publie ton annonce.',
  ), {
    completesMission: true,
    get nextLabel() { return t('understood', 'Compris'); },
  }),
  // Dernière page : la flèche finit le bonus à toute bulle (`completesMission`), « Suivant » non.
  ...pageBubbles('b5-fr', pageTarget(RouteNames.SearchHub, { activeType: 'amicaux' }), [
    ['page', 'friendly.tabs', () => t(
      'b5-fr-page',
      'Annonces : celles des autres équipes. Mes annonces et Mes propositions : les tiennes.',
    )],
    ['filters', 'search.filters', () => t(
      'b5-fr-filters',
      'Filtres : recevoir ou se déplacer, quand, distance, catégorie, niveau, format.',
    )],
    ['create', 'friendly.create', () => t('b5-fr-create', 'Ou publie ton annonce ici.')],
  ], { completesMission: true }, {
    get nextLabel() { return t('understood', 'Compris'); },
  }),
];
