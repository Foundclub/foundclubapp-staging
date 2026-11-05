import { extendStep, homeTarget, wizardStep } from '@/domains/tour/guideCommon';
import t from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide Dirigeant·e, bonus B4 « Recruter » (pack `05_` ; carte du 05/11 §3 et §5-4 ; décision 8).
 * L'app a raison : « Coach » passe par son propre profil, un sport sans postes saute l'étape, et
 * `AdWizardValidation` existe selon l'annonce. Le poste du pack n'existe qu'au foot.
 *
 * Tout le bonus porte `simulatesAd` : tant qu'il est à l'écran, « Publier » ne part pas
 * (`AdWizardRecap`, témoin « 0 requête »). Le tunnel est le vrai.
 *
 * Décision « 80- B » : « Publier » mène à l'annonce d'exemple EN LIGNE. `adExample` la met à la
 * place du récap (`TourAnnonceExemple`).
 */

const FROM = 'b4-card';

/**
 * Étape du tunnel de l'annonce.
 * @param {string} id - Id de l'étape.
 * @param {string} nextRoute - Écran suivant.
 * @param {() => string} text - Texte.
 * @param {any} [extras] - Propriétés en plus.
 * @returns {any} Étape.
 */
const adStep = (id, nextRoute, text, extras = {}) => extendStep(
  wizardStep(id, 'president_b4', nextRoute, FROM, text),
  { simulatesAd: true, ...extras },
);

// Après Location : validation d'abord si l'annonce la demande, sinon la description.
const TO_DESCRIPTION = [
  { goto: 'a5v', key: RouteNames.AdWizardValidation, type: 'route' },
  { goto: 'a6', key: RouteNames.AdWizardDescription, type: 'route' },
];

export const B4_MISSION = {
  estimatedSeconds: 35,
  gaugeStep: 0,
  id: 'president_b4',
  locked: false,
  get title() { return t('missionTitles.b4', 'Recruter'); },
};

export const B4_STEPS = [
  {
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'b4-dock',
    missionId: 'president_b4',
    navigateOnEnter: true,
    navTarget: homeTarget,
    simulatesAd: true,
    targets: ['dock.home'],
    get text() { return t('b4-dock', 'Bonus suivant : recruter. Retourne à l’accueil.'); },
  },
  {
    advanceOn: { key: RouteNames.AdWizardAudienceType, type: 'route' },
    id: 'b4-card',
    missionId: 'president_b4',
    navTarget: homeTarget,
    simulatesAd: true,
    targets: ['home.card.manage-add-ad'],
    get text() {
      return t('b4-card', 'Ouvre « Recruter ». C’est une simulation : rien ne sera publié.');
    },
  },
  adStep('a1', RouteNames.AdWizardTeam, () => t(
    'a1',
    'Tu recrutes des joueur·se·s ou un coach ?',
  )),
  adStep('a2', RouteNames.AdWizardPositions, () => t('a2', 'L’équipe qui recrute.'), {
    advanceOn: [
      { goto: 'a3', key: RouteNames.AdWizardPositions, type: 'route' },
      { goto: 'a3c', key: RouteNames.AdWizardCoachProfile, type: 'route' },
      // Un sport sans postes passe directement aux infos.
      { goto: 'a4', key: RouteNames.AdWizardInfo, type: 'route' },
    ],
  }),
  adStep('a3', RouteNames.AdWizardInfo, () => t(
    'a3',
    'Active le poste qui te manque (au foot, par exemple « Ailier gauche »), puis Suivant.',
  ), { advanceOn: { goto: 'a4', key: RouteNames.AdWizardInfo, type: 'route' } }),
  adStep('a3c', RouteNames.AdWizardInfo, () => t(
    'a3c',
    'Le profil de coach que tu cherches, puis Suivant.',
  ), {
    advanceOn: { goto: 'a4', key: RouteNames.AdWizardInfo, type: 'route' },
    when: () => false,
  }),
  adStep('a4', RouteNames.AdWizardLocation, () => t(
    'a4',
    'Le niveau minimum filtre les candidatures.',
  )),
  adStep('a5', RouteNames.AdWizardDescription, () => t(
    'a5',
    'Le lieu sert à montrer l’annonce aux joueur·se·s proches.',
  ), { advanceOn: TO_DESCRIPTION }),
  adStep('a5v', RouteNames.AdWizardDescription, () => t(
    'a5v',
    'Cette annonce a une validation : choisis comment, puis Suivant.',
  ), {
    advanceOn: { goto: 'a6', key: RouteNames.AdWizardDescription, type: 'route' },
    when: () => false,
  }),
  adStep('a6', RouteNames.AdWizardRecap, () => t(
    'a6',
    'Facultatif : les idées à inclure t’aident. Tu peux passer.',
  )),
  {
    advanceOn: { key: 'ad.publish.example', type: 'interaction' },
    bubblePlacement: 'top',
    bubbleSlot: true,
    id: 'a7',
    listScrolls: true,
    missionId: 'president_b4',
    resumeFrom: FROM,
    simulatesAd: true,
    targets: ['teamWizard.next'],
    get text() {
      return t('a7', 'Relis ton annonce, puis touche le bouton : simulation, rien ne sera publié.');
    },
  },
  {
    adExample: true,
    completesMission: true,
    id: 'b4-cand',
    lookOnly: true,
    missionId: 'president_b4',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: FROM,
    simulatesAd: true,
    targets: ['ad-cand', 'ad-poster'],
    get text() {
      return t('b4-cand', 'Ton annonce d’exemple est en ligne. Les candidatures arrivent ici, et '
        + 'tu peux en faire une affiche à partager.');
    },
  },
];
