import { RouteNames } from '@/navigation/routeNames';

/**
 * Ce qui est vrai pour tout guide à missions, sorti de `coachGuide.js` sans changer l'entraîneur
 * (guide Dirigeant, lot L1, 05/11) : cibles de navigation, tunnel équipe, fabriques d'étapes.
 */

export const homeTarget = {
  // L'accueil vit dans l'onglet `Search` (allerDansLOnglet.js) : sans l'onglet nommé,
  // l'onglet au premier plan restait (clôture sur le Planning, GUIDE-FINITIONS-2 N7).
  params: { params: { pop: true, screen: RouteNames.SearchHome }, screen: RouteNames.Search },
  // GUIDE-BONUS (L5) : revenir en dépilant ; un accueil empilé en doublon laissait
  // l'onglet visé sans cadre ni voile (b1-dock, audit 39-41).
  pop: true,
  routeName: RouteNames.HomeTab,
};

export const planningTarget = {
  params: { screen: RouteNames.MyEventList },
  pop: true,
  routeName: RouteNames.HomeTab,
};

export const teamHubTarget = {
  params: { screen: RouteNames.MyTeamList },
  routeName: RouteNames.HomeTab,
};

export const teamWizardTarget = {
  params: (/** @type {any} */ context) => ({
    params: { clubId: context?.userData?.club?.documentId },
    screen: RouteNames.TeamWizardName,
  }),
  routeName: RouteNames.TeamStack,
};

// Cibles communes des tunnels (posées une fois dans WizardStepLayout).
export const WIZARD = ['teamWizard.field', 'teamWizard.next', 'teamWizard.skip'];

/**
 * Il entraîne une équipe de son club courant (l'écran Équipes ne montre que
 * celui-là ; tournée : Julien entraîne ailleurs, et « ouvre-la » visait son
 * équipe de JOUEUR).
 * @param {any} userData - Profil.
 * @returns {boolean}
 */
export const trainsTeamInClub = (userData) => (Array.isArray(userData?.trainedTeams)
  ? userData.trainedTeams
  : [])
  .some((/** @type {any} */ team) => !userData?.club?.documentId
    || !team?.club?.documentId
    || team.club.documentId === userData.club.documentId);

/**
 * GUIDE-FINITIONS-3 (réserve du n° 6) : une équipe existe MAINTENANT (créée
 * pendant le guide, ou profil relu) : inviter, programmer et publier restent
 * possibles même si M1 a été passée.
 * @param {any} ctx
 * @returns {boolean}
 */
export const hasTeamNow = (ctx) => Boolean(ctx?.created?.['team.created'])
  || Boolean(ctx?.created?.['team.trained'])
  || trainsTeamInClub(ctx?.userData);

/**
 * Étape de tunnel : bulle fixée en haut (les CTA sont en bas), on reprend au
 * début du tunnel après une fermeture de l'app.
 * @param {string} id - Id de l'étape.
 * @param {string} missionId - Mission.
 * @param {string} nextRoute - Route qui valide l'étape.
 * @param {string} resumeFrom - Étape de reprise.
 * @param {() => string} text - Texte de la bulle.
 * @returns {any} Étape.
 */
export const wizardStep = (id, missionId, nextRoute, resumeFrom, text) => ({
  advanceOn: { key: nextRoute, type: 'route' },
  bubblePlacement: 'top',
  // GUIDE-FINITIONS-3 R2-2 : la bulle se pose sous le titre et la consigne de
  // l'écran (place réservée par WizardStepLayout), plus dessus (A04-A10).
  bubbleSlot: true,
  id,
  missionId,
  resumeFrom,
  targets: WIZARD,
  get text() { return text(); },
});

/**
 * Complète une étape sans figer ses textes. T3-GUIDE-SITE : un `...` lit `get text()` au chargement
 * du module, avant i18n sur le site (« undefined » dans la bulle).
 * @param {any} step - Étape de base.
 * @param {any} extras - Propriétés en plus.
 * @returns {any} L'étape complétée.
 */
export const extendStep = (step, extras) => Object.defineProperties(
  step,
  Object.getOwnPropertyDescriptors(extras),
);

/**
 * Le tunnel équipe, écran par écran. L'alerte « Félicitations » n'a pas de rappel : la mission se
 * valide au succès serveur de la création (`team.created`).
 * @param {object} args - Paramètres.
 * @param {string} args.missionId - Mission qui contient le tunnel.
 * @param {Record<string, () => string>} args.texts - Textes, `sheet` et `tw1` à `tw8`.
 * @param {(ctx: any) => boolean} [args.when] - Le tunnel est-il à jouer ?
 * @returns {any[]} Étapes `tw1` à `tw8`.
 */
export const teamWizardSteps = ({ missionId, texts, when }) => [
  extendStep(wizardStep('tw1', missionId, RouteNames.TeamWizardDescription, 'tw1', texts.tw1), {
    navTarget: teamWizardTarget,
    // Club qui a déjà des équipes : la feuille de choix s'ouvre d'abord.
    variants: [{
      targets: ['teams.sheet.newTeam'],
      get text() { return texts.sheet(); },
    }],
    when,
  }),
  ...(/** @type {Array<[string, string]>} */ ([
    ['tw2', RouteNames.TeamWizardSection],
    ['tw3', RouteNames.TeamWizardActivity],
    ['tw4', RouteNames.TeamWizardCategory],
    ['tw5', RouteNames.TeamWizardLevel],
    ['tw6', RouteNames.TeamWizardTrainers],
    ['tw7', RouteNames.TeamWizardRecap],
  ])).map(([id, nextRoute]) => extendStep(
    wizardStep(id, missionId, nextRoute, 'tw1', texts[id]),
    { when },
  )),
  {
    advanceOn: { key: 'team.created', type: 'action' },
    bubblePlacement: 'top',
    bubbleSlot: true,
    completesMission: true,
    id: 'tw8',
    missionId,
    resumeFrom: 'tw1',
    targets: ['teamWizard.next'],
    get text() { return texts.tw8(); },
    when,
  },
];
