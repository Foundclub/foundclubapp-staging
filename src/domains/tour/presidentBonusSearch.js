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
 * Bulle de la page ouverte depuis une case, hors du parcours par « Suivant » (`when` faux) : on
 * n'y entre que par l'aiguillage de la case. Le retour à l'accueil (flèche ou onglet) mène à la
 * case suivante. Pas de bouton « Suivant » ici : il ramènerait à l'accueil par le guide, et
 * l'arrivée sur l'accueil serait lue comme un retour à la case d'avant (`stepBack`).
 * @param {string} id - Id de l'étape de la case.
 * @param {{ params?: any; routeName: string }} navTarget - La page, pour « Reprendre ».
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
  pageStep('b5-ev', { routeName: RouteNames.SearchEvents }, () => t(
    'b5-ev-page',
    'Voici les événements près de toi, jour par jour. La flèche te ramène à l’accueil.',
  )),
  cardStep('b5-cl', 'search-clubs', RouteNames.SearchClubs, () => t(
    'b5-cl',
    'Club : les autres clubs, pour un partenariat ou un amical.',
  )),
  pageStep('b5-cl', { routeName: RouteNames.SearchClubs }, () => t(
    'b5-cl-page',
    'Voici les clubs : ouvre une fiche pour les contacter. La flèche te ramène à l’accueil.',
  )),
  cardStep('b5-re', 'search-reservations', RouteNames.SearchReservations, () => t(
    'b5-re',
    'Réservations : les créneaux de terrains à réserver près de toi.',
  ), { when: () => RESERVATIONS_SUR_ACCUEIL }),
  pageStep('b5-re', { routeName: RouteNames.SearchReservations }, () => t(
    'b5-re-page',
    'Voici les créneaux de terrains libres. La flèche te ramène à l’accueil.',
  )),
  cardStep('b5-pr', 'search-profiles', RouteNames.SearchRecruitment, () => t(
    'b5-pr',
    'Profils : les joueur·se·s et coachs ouverts au recrutement.',
  )),
  pageStep('b5-pr', {
    params: { initialRecruitmentTab: 'profils' },
    routeName: RouteNames.SearchRecruitment,
  }, () => t(
    'b5-pr-page',
    'Voici les profils ouverts au recrutement. La flèche te ramène à l’accueil.',
  )),
  cardStep('b5-fr', 'search-amicaux', RouteNames.SearchHub, () => t(
    'b5-fr',
    'Matchs amicaux : trouve un adversaire, ou publie ton annonce.',
  ), {
    completesMission: true,
    get nextLabel() { return t('understood', 'Compris'); },
  }),
  pageStep('b5-fr', { params: { activeType: 'amicaux' }, routeName: RouteNames.SearchHub }, () => t(
    'b5-fr-page',
    'Voici les équipes qui cherchent un adversaire. Tu peux aussi publier ton annonce.',
  ), {
    completesMission: true,
    get nextLabel() { return t('understood', 'Compris'); },
  }),
];
