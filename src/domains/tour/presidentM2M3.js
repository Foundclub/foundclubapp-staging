import { extendStep, teamWizardSteps } from '@/domains/tour/guideCommon';
import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';
import t from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide Dirigeant·e, M2 « Inviter tes coachs » et M3 « Créer tes équipes » (pack `05_`, §M2 et
 * §M3 ; carte du 05/11 §3 et §5). Là où le pack et l'app diffèrent, l'app a raison :
 * - « Envoyer l'invitation » crée un vrai compte sur le numéro saisi, sans acceptation ; rien ne
 *   part tout seul, c'est « Inviter » qui ouvre la messagerie du dirigeant (`useAuth`) ;
 * - on revient de la messagerie sur Staff, pas sur la fiche : `m2-back`, absente du pack ;
 * - le toucher sur « Super » n'a pas de rappel : M3 se valide à `team.created`.
 * La fiche et ses sous-pages ont la même route `Club` : d'où `club.section.<nom>` et `.closed`.
 */

const clubHubTarget = {
  params: (/** @type {any} */ context) => ({
    params: { clubId: context?.userData?.club?.documentId },
    screen: RouteNames.Club,
  }),
  routeName: RouteNames.ClubStack,
};

/**
 * L'offre Club (ou le cadeau de bienvenue) ouvre ce club : M2 se joue pour de vrai.
 * @param {any} ctx - Contexte du guide.
 * @returns {boolean} Vrai si le droit est ouvert.
 */
const hasPlan = (ctx) => Boolean(ctx?.flags?.hasClubPlan);
/**
 * Le compte du coach existe déjà : on ne le recrée pas à la reprise.
 * @param {any} ctx - Contexte du guide.
 * @returns {boolean} Vrai si M2 a déjà créé ou rattaché quelqu'un.
 */
const coachAdded = (ctx) => Boolean(
  ctx?.created?.['staff.invited'] || ctx?.created?.['staff.linked'],
);
/**
 * Le formulaire reste à remplir.
 * @param {any} ctx - Contexte du guide.
 * @returns {boolean} Vrai avant la création du compte.
 */
const toInvite = (ctx) => hasPlan(ctx) && !coachAdded(ctx);

const COACH_PART = {
  get passable() { return PRESIDENT_GUIDE_SETTINGS.coachPassable; },
  subMission: 'coach',
};

// Depuis le formulaire : compte créé hors de son étape, ou retour Android qui le quitte (Club).
const FORM_EXITS = [
  { goto: 'm2-invite', key: 'staff.invited', type: 'action' },
  {
    completes: true, goto: 'm2-back', key: 'staff.linked', type: 'action',
  },
  { goto: 'm2-add', key: RouteNames.Club, type: 'route' },
];

// Raison dite par le guide si l'offre tombe en route (cadeau de 7 jours fini).
const coachRefused = () => t(
  'refusal.coach',
  'Ajouter un coach demande l’offre Club. Rien n’a été créé.',
);
const teamRefused = () => t(
  'refusal.team',
  'Ton offre compte déjà toutes ses équipes : une nouvelle équipe demande une offre au-dessus. '
    + 'Rien n’a été créé.',
);

export const M2M3_MISSIONS = [
  {
    gaugeStep: 25,
    id: 'president_m2',
    locked: true,
    refusals: {
      get 'paywall.club-licensee-limit'() { return coachRefused(); },
      get 'paywall.club-roles-manage-required'() { return coachRefused(); },
    },
    get title() { return t('missions.m2', 'Inviter tes coachs'); },
  },
  {
    gaugeStep: 25,
    id: 'president_m3',
    locked: true,
    refusals: {
      get 'paywall.club-tier-team-limit'() { return teamRefused(); },
      get 'paywall.team-limit'() { return teamRefused(); },
    },
    get title() { return t('missions.m3', 'Créer tes équipes'); },
  },
];

const M2_STEPS = [
  extendStep({
    advanceOn: [
      { key: 'club.section.staff', type: 'interaction' },
      { goto: 'm2-role', key: RouteNames.AddCoach, type: 'route' },
    ],
    id: 'm2-staff',
    missionId: 'president_m2',
    // M1 finit sur la fiche ; passée ou reprise, elle n'y est pas : le guide y ramène.
    navigateOnEnter: true,
    navTarget: clubHubTarget,
    targets: ['club.m.staff'],
    get text() { return t('m2-staff', 'Invite maintenant tes coachs. Ouvre « Staff ».'); },
    when: toInvite,
  }, COACH_PART),
  extendStep({
    advanceOn: { key: RouteNames.AddCoach, type: 'route' },
    fallback: {
      targets: ['club.m.staff'],
      get text() { return t('m2-staff', 'Invite maintenant tes coachs. Ouvre « Staff ».'); },
    },
    id: 'm2-add',
    missionId: 'president_m2',
    resumeFrom: 'm2-staff',
    targets: ['staff-add-coach'],
    get text() { return t('m2-add', 'Touche « + » à côté de « Nos coachs / profs ».'); },
    when: toInvite,
  }, COACH_PART),
  extendStep({
    advanceOn: FORM_EXITS,
    id: 'm2-role',
    missionId: 'president_m2',
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'm2-staff',
    targets: ['cf-role'],
    // « Coach / Prof » est déjà actif : le toucher ne changerait rien, on avance au bouton.
    get text() { return t('m2-role', 'Le rôle « Coach / Prof » est déjà choisi. Garde-le.'); },
    when: toInvite,
  }, COACH_PART),
  extendStep({
    advanceOn: FORM_EXITS,
    bubblePlacement: 'top',
    id: 'm2-fields',
    missionId: 'president_m2',
    get nextLabel() { return t('next', 'Suivant'); },
    nextRequires: {
      field: 'cf.phone',
      message: () => t('m2-fields-required', 'Donne d’abord son numéro.'),
    },
    resumeFrom: 'm2-staff',
    targets: ['cf-fields'],
    // Décision 5 : l'écran dit « Une invitation SMS lui sera envoyée » ; rien ne part tout seul.
    get text() {
      return t(
        'm2-fields',
        'Son numéro (requis) et son prénom. Un compte est créé à ce numéro, et le SMS, c’est toi '
          + 'qui l’envoies juste après.',
      );
    },
    veil: false,
    when: toInvite,
  }, COACH_PART),
  extendStep({
    advanceOn: [
      { key: 'staff.invited', type: 'action' },
      {
        completes: true, goto: 'm2-back', key: 'staff.linked', type: 'action',
      },
      { goto: 'm2-add', key: RouteNames.Club, type: 'route' },
    ],
    id: 'm2-send',
    missionId: 'president_m2',
    resumeFrom: 'm2-staff',
    targets: ['cf-send'],
    get text() { return t('m2-send', 'Touche « Envoyer l’invitation » : son compte est créé.'); },
    when: toInvite,
  }, COACH_PART),
  {
    advanceOn: [
      { key: 'staff.sms.opened', type: 'interaction' },
      {
        completes: true, goto: 'm2-back', key: 'staff.invite.later', type: 'interaction',
      },
    ],
    bubblePlacement: 'top',
    id: 'm2-invite',
    missionId: 'president_m2',
    // Après une fermeture de l'app, la feuille n'existe plus : on demande si c'est parti.
    resumeFrom: 'm2-sms',
    subMission: 'coach',
    targets: ['ok-sheet'],
    get text() {
      return t(
        'm2-invite',
        'Ajouté·e au club ! Touche « Inviter » : ta messagerie s’ouvre avec le message prêt. '
          + 'Envoie-le, puis reviens ici.',
      );
    },
    when: hasPlan,
  },
  {
    // La bulle ne s'affiche pas dans la messagerie. Android peut l'ouvrir sans quitter l'app, et
    // l'app ne sait pas si le SMS est parti : le bouton laisse toujours une issue.
    advanceOn: { key: 'app.returned', type: 'interaction' },
    bubblePlacement: 'top',
    completesMission: true,
    id: 'm2-sms',
    missionId: 'president_m2',
    navTarget: clubHubTarget,
    get nextLabel() { return t('m2-sms-next', 'C’est envoyé'); },
    subMission: 'coach',
    get text() {
      return t(
        'm2-sms',
        'Envoie le SMS depuis ta messagerie, puis reviens ici. C’est à toi de l’envoyer : l’app ne '
          + 'le fait pas.',
      );
    },
    veil: false,
    when: hasPlan,
  },
  // Décision 1 : sans droit ouvert, on montre où ; l'achat est proposé en fin de guide.
  {
    advanceOn: { key: 'club.section.staff', type: 'interaction' },
    id: 'm2-visit',
    missionId: 'president_m2',
    navigateOnEnter: true,
    navTarget: clubHubTarget,
    targets: ['club.m.staff'],
    get text() { return t('m2-visit', 'Tes coachs s’ajoutent depuis « Staff ». Ouvre-le.'); },
    when: (/** @type {any} */ ctx) => !hasPlan(ctx),
  },
  {
    completesMission: true,
    fallback: {
      targets: ['club.m.staff'],
      get text() { return t('m2-visit', 'Tes coachs s’ajoutent depuis « Staff ». Ouvre-le.'); },
    },
    id: 'm2-visit-add',
    missionId: 'president_m2',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'm2-visit',
    targets: ['staff-add-coach'],
    get text() {
      return t(
        'm2-visit-add',
        'Ce « + » ajoute un coach à ton club. Il demande l’offre Club : on te la présente à la fin '
          + 'du guide. On continue.',
      );
    },
    when: (/** @type {any} */ ctx) => !hasPlan(ctx),
  },
];

const M3_TUNNEL = teamWizardSteps({
  missionId: 'president_m3',
  texts: {
    sheet: () => t('m3-sheet', 'Ton club a déjà des équipes. Ici, crée-en une nouvelle.'),
    tw1: () => t('tw1', 'Donne un nom à l’équipe, puis Suivant.'),
    tw2: () => t('tw2', 'Facultatif : décris l’équipe, ou passe.'),
    tw3: () => t('tw3', 'La section de l’équipe, puis Suivant.'),
    tw4: () => t(
      'tw4',
      'Cherche le sport et touche-le : tu passes directement à l’étape suivante.',
    ),
    tw5: () => t('tw5', 'Touche la catégorie d’âge.'),
    tw6: () => t('tw6', 'Touche le niveau de compétition, ou Suivant pour continuer sans.'),
    // Vrai aussi si M2 a été passée : il n'y a alors que toi dans la liste.
    tw7: () => t('tw7', 'Coche qui gérera l’équipe : toi, ou le coach que tu viens d’ajouter.'),
    tw8: () => t('tw8', 'Tout est bon ? Crée l’équipe pour de vrai.'),
  },
}).map((step) => (step.id === 'tw8' ? extendStep(step, { listScrolls: true }) : step));

const M3_STEPS = [
  {
    // Le retour de la messagerie, ou « Plus tard », laisse sur Staff. Autre route : M3 y ramène.
    advanceOn: [
      { key: 'club.section.closed', type: 'interaction' },
      { not: RouteNames.Club, type: 'route' },
    ],
    id: 'm2-back',
    missionId: 'president_m3',
    resumeFrom: 'm3-teams',
    targets: ['header.back'],
    get text() {
      return t(
        'm2-back',
        'De retour dans l’app, sur Staff. Reviens sur la fiche de ton club : touche la flèche, ou '
          + 'glisse ton doigt depuis le bord gauche.',
      );
    },
    // Le geste du bord, seul retour d'un iPhone, doit passer.
    veil: false,
    when: coachAdded,
  },
  {
    advanceOn: [
      { key: 'club.section.teams', type: 'interaction' },
      { goto: 'tw1', key: RouteNames.TeamWizardName, type: 'route' },
    ],
    // M2 passée depuis Staff : la rangée n'est pas à l'écran, on montre le retour.
    fallback: {
      targets: ['header.back'],
      get text() {
        return t('m3-teams-back', 'Reviens sur la fiche de ton club : touche la flèche.');
      },
    },
    id: 'm3-teams',
    missionId: 'president_m3',
    navigateOnEnter: true,
    navTarget: clubHubTarget,
    targets: ['club.m.teams'],
    get text() { return t('m3-teams', 'Crée maintenant une équipe : ouvre « Nos équipes ».'); },
  },
  {
    advanceOn: { key: RouteNames.TeamWizardName, type: 'route' },
    fallback: {
      targets: ['club.m.teams'],
      get text() { return t('m3-teams', 'Crée maintenant une équipe : ouvre « Nos équipes ».'); },
    },
    id: 'm3-create',
    missionId: 'president_m3',
    resumeFrom: 'm3-teams',
    targets: ['teams-create'],
    get text() { return t('m3-create', 'Touche « Créer une équipe ».'); },
  },
  ...M3_TUNNEL,
];

export const M2M3_STEPS = [...M2_STEPS, ...M3_STEPS];
