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
 * Bulle sur une case de l'accueil.
 * @param {string} id - Id de l'étape.
 * @param {string} card - Clé de la carte (`home.card.<clé>`).
 * @param {() => string} text - Texte.
 * @param {any} [extras] - Propriétés en plus.
 * @returns {any} Étape.
 */
const cardStep = (id, card, text, extras = {}) => Object.defineProperties({
  id,
  missionId: 'president_b5',
  navTarget: homeTarget,
  get nextLabel() { return t('next', 'Suivant'); },
  targets: [`home.card.${card}`],
  get text() { return text(); },
}, Object.getOwnPropertyDescriptors(extras));

export const B5_MISSION = {
  estimatedSeconds: 10,
  gaugeStep: 0,
  id: 'president_b5',
  locked: false,
  get title() { return t('missions.b5', 'Rechercher, en un coup d’œil'); },
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
  cardStep('b5-ev', 'search-events', () => t(
    'b5-ev',
    'Événement : tournois, stages et détections autour de toi.',
  )),
  cardStep('b5-cl', 'search-clubs', () => t(
    'b5-cl',
    'Club : les autres clubs, pour un partenariat ou un amical.',
  )),
  cardStep('b5-re', 'search-reservations', () => t(
    'b5-re',
    'Réservations : les créneaux de terrains à réserver près de toi.',
  ), { when: () => RESERVATIONS_SUR_ACCUEIL }),
  cardStep('b5-pr', 'search-profiles', () => t(
    'b5-pr',
    'Profils : les joueur·se·s et coachs ouverts au recrutement.',
  )),
  cardStep('b5-fr', 'search-amicaux', () => t(
    'b5-fr',
    'Matchs amicaux : trouve un adversaire, ou publie ton annonce.',
  ), {
    completesMission: true,
    get nextLabel() { return t('understood', 'Compris'); },
  }),
];
