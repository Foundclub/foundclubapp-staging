import { homeTarget } from '@/domains/tour/guideCommon';
import t, { tSite } from '@/domains/tour/presidentText';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide Dirigeant·e, bonus B2 « canal du club » et B3 « créer un groupe » (pack `05_` ; carte du
 * 05/11 §5-1 ; décisions 6 et 7). L'app a raison :
 * - le dirigeant écrit dans ce canal : il n'y a pas de pied « lecture seule » ;
 * - le canal naît à 2 membres, un groupe demande 2 personnes : sans ça, une bulle et une sortie ;
 * - les autorisations sont un `Modal` : pas de cadre dessus, la bulle les raconte avant.
 * GUIDE-D-CORR-3 (M1082, décision du chef) : B2 et B3 se jouent en SIMULATION, comme B1 et B4.
 * Pas de canal : un canal « Exemple » (`simulatesCanal`, Messaging) ; la liste des membres reçoit
 * trois membres « Exemple », et « Créer » ne crée rien (`simulatesGroup`, NewConversation). Les
 * repli b2-none et b3-few restent pour un écran qui ne simulerait pas.
 */

const messagingTarget = {
  params: { screen: RouteNames.Chat },
  pop: true,
  routeName: RouteNames.HomeTab,
};

export const BONUS_MESSAGES_MISSIONS = {
  b2: {
    estimatedSeconds: 10,
    gaugeStep: 0,
    id: 'president_b2',
    locked: false,
    get title() { return t('missionTitles.b2', 'Le canal de ton club'); },
  },
  b3: {
    estimatedSeconds: 25,
    gaugeStep: 0,
    id: 'president_b3',
    locked: false,
    get title() { return t('missionTitles.b3', 'Créer un groupe'); },
  },
};

export const B2_STEPS = [
  {
    advanceOn: { key: RouteNames.Chat, type: 'route' },
    id: 'b2-dock',
    missionId: 'president_b2',
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.messages'],
    get text() { return t('b2-dock', 'Ouvre les Messages.'); },
  },
  {
    advanceOn: [
      { key: RouteNames.Conversation, type: 'route' },
      { goto: 'b2-none', key: 'messaging.canal.absent', type: 'interaction' },
    ],
    // La liste lue, l'écran dit si le canal manque : le guide ne lit pas les conversations.
    checksCanal: true,
    id: 'b2-canal',
    missionId: 'president_b2',
    resumeFrom: 'b2-dock',
    simulatesCanal: true,
    targets: ['msg-canal'],
    get text() { return t('b2-canal', 'Voici le canal de ton club. Ouvre-le.'); },
  },
  {
    id: 'b2-info',
    lookOnly: true,
    missionId: 'president_b2',
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'b2-dock',
    targets: ['ch-info'],
    get text() {
      return t('b2-info', 'Ton canal d’annonce : tous les membres du club le reçoivent.');
    },
  },
  {
    completesMission: true,
    id: 'b2-foot',
    missionId: 'president_b2',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'b2-dock',
    targets: ['ch-input'],
    get text() {
      return t('b2-foot', 'Toi tu écris, eux lisent : idéal pour les annonces officielles.');
    },
  },
  {
    bubblePlacement: 'top',
    id: 'b2-none',
    missionId: 'president_b2',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'b2-dock',
    // GUIDE-D-CORR TG-13 (tournée du 07/11, b13, b28) : rien n'a été vu, le bonus est PASSÉ au
    // bilan, pas fait. Et la règle dite est celle de l'app : le canal se crée la première fois
    // que le dirigeant touche « Contacter les entraîneur·e·s » (ClubDetails, `startClubChat`).
    skipsMission: true,
    get text() {
      return t('b2-none', 'Ton canal n’est pas encore ouvert : il se crée la première fois que tu '
        + 'touches « Contacter les entraîneur·e·s », dans « Staff » sur la fiche du club. Il '
        + 'apparaîtra ici.');
    },
    veil: false,
    // Seulement par l'aiguillage de b2-canal.
    when: () => false,
  },
];

export const B3_STEPS = [
  {
    // Bonus précédent passé, ou canal absent : déjà ailleurs, l'étape passe toute seule.
    advanceOn: { not: RouteNames.Conversation, type: 'route' },
    id: 'b3-back',
    missionId: 'president_b3',
    navigateOnEnter: true,
    navTarget: messagingTarget,
    resumeFrom: 'b3-new',
    targets: ['header.back'],
    get text() {
      return tSite(
        'b3-back',
        'Crée maintenant un groupe. Reviens aux messages : touche la flèche, ou glisse ton doigt '
          + 'depuis le bord gauche.',
        'Crée maintenant un groupe. Reviens aux messages : touche la flèche.',
      );
    },
    // Le geste du bord, seul retour d'un iPhone, doit passer ; le reste sous le voile (TG-16).
    edgeSwipe: true,
  },
  {
    advanceOn: { key: RouteNames.NewConversation, type: 'route' },
    id: 'b3-new',
    missionId: 'president_b3',
    // Recette L11 (l11-b3a) : b3-back passée toute seule depuis l'Accueil n'a emmené nulle part.
    navigateOnEnter: true,
    navTarget: messagingTarget,
    targets: ['msg-new'],
    get text() { return t('b3-new', 'Touche ce bouton pour une nouvelle discussion.'); },
  },
  {
    advanceOn: [
      { goto: 'b3-name', key: 'conversation.step.name', type: 'interaction' },
      { goto: 'b3-few', key: 'conversation.members.few', type: 'interaction' },
      { goto: 'b3-whisper', key: RouteNames.Conversation, type: 'route' },
    ],
    bubblePlacement: 'top',
    checksMembers: true,
    id: 'b3-sel',
    missionId: 'president_b3',
    resumeFrom: 'b3-new',
    simulatesGroup: true,
    targets: ['conv-list', 'conv-next'],
    get text() {
      // GUIDE-D-CORR TG-11 : « Suivant » pour plusieurs (NewConversation, MSG1A). GUIDE-D-CORR-3 :
      // en simulation, un seul membre coché est refusé ; la bulle ne propose plus « Démarrer ».
      return t(
        'b3-sel',
        'Coche au moins 2 membres, ceux marqués « Exemple » suffisent, puis « Suivant ». C’est une '
          + 'simulation : rien n’est créé.',
      );
    },
    veil: false,
  },
  {
    bubblePlacement: 'top',
    id: 'b3-name',
    missionId: 'president_b3',
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'b3-new',
    simulatesGroup: true,
    // GUIDE-D-CORR-4 (M1100, TestFlight 2.6.98) : « l'écran est trop chargé » ; le nom et les
    // autorisations étaient désignés ensemble. Une seule chose à la fois : le nom, puis b3-perms.
    targets: ['grp-name'],
    get text() { return t('b3-name', 'Donne-lui un nom. C’est facultatif.'); },
  },
  {
    bubblePlacement: 'top',
    id: 'b3-perms',
    missionId: 'president_b3',
    get nextLabel() { return t('next', 'Suivant'); },
    resumeFrom: 'b3-new',
    simulatesGroup: true,
    // Clavier ouvert, la bulle passait sur le nom : l'écran ferme le clavier (NewConversation).
    targets: ['grp-perms'],
    get text() {
      return t('b3-perms', 'Dans « Autorisations du groupe », coupe « Envoyer des messages » pour '
        + 'que seuls les admins écrivent.');
    },
  },
  {
    advanceOn: { key: 'conversation.group.created', type: 'action' },
    completesMission: true,
    id: 'b3-create',
    missionId: 'president_b3',
    resumeFrom: 'b3-new',
    simulatesGroup: true,
    targets: ['grp-create'],
    get text() {
      return t('b3-create', 'Crée le groupe. C’est une simulation : rien n’est créé, tes membres ne '
        + 'voient rien.');
    },
  },
  {
    bubblePlacement: 'top',
    id: 'b3-few',
    missionId: 'president_b3',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'b3-new',
    // GUIDE-D-CORR-2 : aucun groupe créé, le bonus est PASSÉ au bilan, pas fait (comme b2-none).
    skipsMission: true,
    get text() {
      return t(
        'b3-few',
        'Un groupe demande au moins 2 autres membres, et ton club n’en a pas encore assez. Reviens '
          + 'ici quand ils auront rejoint le club. On continue.',
      );
    },
    veil: false,
    when: () => false,
  },
  {
    bubblePlacement: 'top',
    completesMission: true,
    id: 'b3-whisper',
    missionId: 'president_b3',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'b3-new',
    get text() {
      return t('b3-whisper', 'C’est une discussion à deux. Pour un groupe, coche au moins 2 '
        + 'personnes depuis le même bouton. On continue.');
    },
    veil: false,
    when: () => false,
  },
];
