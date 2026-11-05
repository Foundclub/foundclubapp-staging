import { homeTarget, WIZARD } from '@/domains/tour/guideCommon';
import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';
import t from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide Dirigeant·e, bonus B1 « campagne de cotisation » (pack `05_` ; carte du 05/11 §3 et §5-4 ;
 * décision 8). Le tunnel est le vrai, sur une seule route : c'est `licenseCampaign.step.<clé>` qui
 * dit l'écran, dans les deux sens. Tout le bonus porte `simulatesCampaign` : tant qu'il est à
 * l'écran, rien ne part (`persistCampaign`, témoin « 0 requête »). Un club neuf n'a ni synthèse ni
 * « Nouvelle campagne », mais un écran de mise en route : d'où les variantes.
 *
 * ponytail: les feuilles Tarif, Échéancier et Cadence restent libres, sans bulle par champ : les
 * bulles de c2, c3 et c5 les nomment. Sortie : des `subGuides` si la recette le demande.
 * ponytail: pas de campagne d'exemple (décision 8-A) ; `stopBonusAtRecap` garde la place de la
 * décision.
 */

const FROM = 'b1-card';
const CAMPAIGN_STEPS = [
  ['c1', 'identity'],
  ['c2', 'audience'],
  ['c3', 'payment'],
  ['c4', 'documents'],
  ['c5', 'reminders'],
  ['c6', 'review'],
];

/**
 * Sorties d'une étape du tunnel : chaque écran ouvre sa bulle, en avant comme en arrière.
 * @param {string} id - Étape courante.
 * @returns {any[]} Sorties.
 */
const toOtherScreens = (id) => CAMPAIGN_STEPS
  .filter(([stepId]) => stepId !== id)
  .map(([goto, key]) => ({ goto, key: `licenseCampaign.step.${key}`, type: 'interaction' }));

/**
 * Étape du tunnel de la campagne.
 * @param {string} id - Id de l'étape.
 * @param {() => string} text - Texte.
 * @returns {any} Étape.
 */
const campaignStep = (id, text) => ({
  advanceOn: toOtherScreens(id),
  bubblePlacement: 'top',
  bubbleSlot: true,
  id,
  missionId: 'president_b1',
  resumeFrom: FROM,
  simulatesCampaign: true,
  targets: WIZARD,
  get text() { return text(); },
});

export const B1_MISSION = {
  estimatedSeconds: 40,
  gaugeStep: 0,
  id: 'president_b1',
  locked: false,
  get title() { return t('missions.b1', 'Lancer une campagne de cotisation'); },
};

export const B1_STEPS = [
  {
    advanceOn: { key: RouteNames.ClubLicenses, type: 'route' },
    id: 'b1-card',
    missionId: 'president_b1',
    navigateOnEnter: true,
    navTarget: homeTarget,
    simulatesCampaign: true,
    targets: ['home.card.manage-licenses'],
    get text() { return t('b1-card', 'Les cotisations du club se gèrent ici. Ouvre-les.'); },
  },
  {
    id: 'b1-sum',
    missionId: 'president_b1',
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: FROM,
    simulatesCampaign: true,
    targets: ['cot-summary'],
    get text() {
      return t('b1-sum', 'En un coup d’œil : ce qui est encaissé, ce qui reste, les retards.');
    },
    variants: [{
      targets: ['cot-setup'],
      get text() {
        return t('b1-sum-new', 'Ton club n’a pas encore de campagne : tout part d’ici. Ce résumé '
          + 'se remplira avec la première.');
      },
    }],
  },
  {
    advanceOn: { key: RouteNames.ClubLicenseCampaignSettings, type: 'route' },
    id: 'b1-new',
    missionId: 'president_b1',
    resumeFrom: FROM,
    simulatesCampaign: true,
    targets: ['cot-new'],
    get text() {
      return t('b1-new', 'Lance une campagne. C’est une simulation : rien ne sera envoyé.');
    },
    variants: [{
      targets: ['cot-setup'],
      get text() {
        return t('b1-new-setup', 'Touche « Continuer ». C’est une simulation : rien ne sera '
          + 'envoyé.');
      },
    }],
  },
  campaignStep('c1', () => t(
    'c1',
    'Choisis le type : le nom se remplit tout seul. Puis la période, et Suivant.',
  )),
  campaignStep('c2', () => t(
    'c2',
    'Le montant par membre. Un tarif différent ? Ajoute une règle dans cet écran. Puis Suivant.',
  )),
  campaignStep('c3', () => t(
    'c3',
    'Active les moyens acceptés. HelloAsso encaisse en ligne une fois connecté. Puis Suivant.',
  )),
  campaignStep('c4', () => t(
    'c4',
    'Facultatif : demande un document, un certificat médical par exemple. Tu peux passer.',
  )),
  campaignStep('c5', () => t(
    'c5',
    'Les relances partent seules jusqu’au paiement. Leur cadence se règle ici. Puis Suivant.',
  )),
  Object.defineProperties(campaignStep('c6', () => t(
    'c6',
    'Relis chaque bloc, puis touche le bouton : simulation, rien n’est envoyé.',
  )), Object.getOwnPropertyDescriptors({
    advanceOn: [
      { key: 'licenseCampaign.open.example', type: 'interaction' },
      ...toOtherScreens('c6'),
    ],
    get completesMission() { return !PRESIDENT_GUIDE_SETTINGS.stopBonusAtRecap; },
    listScrolls: true,
  })),
  {
    // Décision 8-A : l'écran ne bouge pas, la bulle dit la suite de la vraie campagne.
    bubblePlacement: 'top',
    completesMission: true,
    id: 'c-stop',
    missionId: 'president_b1',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: FROM,
    simulatesCampaign: true,
    get text() {
      return t('c-stop', 'Rien n’est parti. Une vraie campagne ajoute les membres concernés, et tu '
        + 'suis ensuite qui a payé dans les cotisations.');
    },
    veil: false,
    when: () => PRESIDENT_GUIDE_SETTINGS.stopBonusAtRecap,
  },
];
