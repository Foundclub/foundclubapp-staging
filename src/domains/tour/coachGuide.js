import i18next from 'i18next';

import { exampleMatch } from '@/domains/tour/tourExamples';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Guide E · Entraîneur·e (TUTOE, pack `design_handoff_tutoriels/02_GUIDE_E_ENTRAINEUR.md`,
 * validé par Adel le 26/10 « 2- ok go »). Les ids d'étape sont ceux du
 * prototype (`ge2-guide.jsx`). Rien n'est prérempli : chaque étape attend le
 * vrai geste (`advanceOn`). Le guide ne navigue qu'au départ, à la reprise et
 * sur une étape `navigateOnEnter` (B2 : le match d'exemple n'a pas de carte).
 *
 * ponytail: B2 entre directement dans « Convoquer » sur le match d'exemple :
 * pas de carte d'exemple dans le planning, pas d'onglet Convocation de la
 * fiche, pas de message local dans le canal. Aucune écriture n'est possible,
 * mais le chemin « planning › match › Convocation » n'est que dit dans la
 * bulle. Sortie : insérer `exampleMatch` dans le cache du planning (pack 01 §6).
 */

/**
 * Texte d'une bulle, par i18n avec repli français.
 * @param {string} id - Id de l'étape ou du texte.
 * @param {string} fallback - Texte français.
 * @param {Record<string, any>} [values] - Interpolation.
 * @returns {string} Texte.
 */
const t = (id, fallback, values) => String(
  i18next.t(`tourCatalog.coach.${id}`, fallback, values),
);

const homeTarget = {
  params: { screen: RouteNames.SearchHome },
  routeName: RouteNames.HomeTab,
};
const teamHubTarget = {
  params: { screen: RouteNames.MyTeamList },
  routeName: RouteNames.HomeTab,
};
const teamWizardTarget = {
  params: (/** @type {any} */ context) => ({
    params: { clubId: context?.userData?.club?.documentId },
    screen: RouteNames.TeamWizardName,
  }),
  routeName: RouteNames.TeamStack,
};
const eventWizardTarget = {
  params: { screen: RouteNames.EventWizardType },
  routeName: RouteNames.EventStack,
};
const friendlySearchTarget = {
  params: { activeType: 'amicaux' },
  routeName: RouteNames.SearchHub,
};

// Cibles communes des tunnels (posées une fois dans WizardStepLayout).
const WIZARD = ['teamWizard.field', 'teamWizard.next', 'teamWizard.skip'];

/**
 * Le coach avait un club au départ du guide.
 * @param {any} ctx
 * @returns {boolean}
 */
const hadClub = (ctx) => Boolean(ctx?.flags?.hadClub);
/**
 * Le coach avait une équipe au départ du guide.
 * @param {any} ctx
 * @returns {boolean}
 */
const hadTeam = (ctx) => Boolean(ctx?.flags?.hadTeam);

const MISSIONS = [
  {
    gaugeStep: 25,
    id: 'coach_m1',
    locked: true,
    get title() { return t('missions.m1', 'Créer ton équipe'); },
  },
  {
    gaugeStep: 25,
    id: 'coach_m2',
    locked: true,
    get title() { return t('missions.m2', 'Inviter tes joueur·se·s'); },
  },
  {
    gaugeStep: 25,
    id: 'coach_m3',
    locked: true,
    get title() { return t('missions.m3', "Programmer l'entraînement de la semaine"); },
  },
  {
    gaugeStep: 25,
    id: 'coach_m4',
    locked: true,
    get title() { return t('missions.m4', 'Rechercher'); },
  },
  {
    estimatedSeconds: 15,
    gaugeStep: 0,
    id: 'coach_b1',
    locked: false,
    get title() { return t('missions.b1', 'Voir qui vient et relancer'); },
  },
  {
    estimatedSeconds: 35,
    gaugeStep: 0,
    id: 'coach_b2',
    locked: false,
    get title() { return t('missions.b2', 'Convoquer pour un match'); },
  },
];

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
const wizardStep = (id, missionId, nextRoute, resumeFrom, text) => ({
  advanceOn: { key: nextRoute, type: 'route' },
  bubblePlacement: 'top',
  id,
  missionId,
  resumeFrom,
  targets: WIZARD,
  get text() { return text(); },
});

const STEPS = [
  {
    id: 'open',
    kind: 'opening',
    navTarget: homeTarget,
  },

  // ── M1 · Créer ton équipe ────────────────────────────────────────────────
  {
    // Coach qui a déjà une équipe : « Retrouve ton équipe ».
    advanceOn: { key: RouteNames.TeamDetails, type: 'route' },
    completesMission: true,
    // Vue de l'accueil (carte pas à l'écran) : on montre l'onglet Équipes.
    fallback: {
      targets: ['dock.teams'],
      get text() { return t('m1-find-dock', 'Ton équipe est déjà là : ouvre l’onglet Équipes.'); },
    },
    id: 'm1-find',
    missionId: 'coach_m1',
    navTarget: teamHubTarget,
    targets: ['teams.trained.0'],
    get text() { return t('m1-find', 'Ton équipe est déjà là : ouvre-la.'); },
    when: hadTeam,
  },
  {
    advanceOn: { key: RouteNames.MyTeamList, type: 'route' },
    id: 'm1-dock',
    missionId: 'coach_m1',
    navTarget: homeTarget,
    targets: ['dock.teams'],
    get text() { return t('m1-dock', 'Commence par ton équipe. Ouvre l’onglet Équipes.'); },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx),
  },
  {
    advanceOn: { key: RouteNames.TeamWizardName, type: 'route' },
    id: 'm1-new',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['teams.fab', 'teams.newTeam'],
    get text() { return t('m1-new', 'Touche « Nouvelle équipe ».'); },
    variants: [{
      targets: ['teams.fab'],
      get text() { return t('m1-new-fab', 'Crée ton équipe avec ce bouton.'); },
    }],
    when: (/** @type {any} */ ctx) => !hadTeam(ctx),
  },
  // Branche sans club : l'écran « Il te faut d'abord un club » du tunnel équipe.
  {
    advanceOn: [
      { key: 'clubGate.search', type: 'interaction' },
      { goto: 'm1-cw', key: 'clubGate.notFound', type: 'interaction' },
    ],
    id: 'm1-gate',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['clubGate.actions'],
    get text() {
      return t(
        'm1-gate',
        'Une équipe appartient toujours à un club. Commence par trouver le tien. Pas de club ? « '
          + 'Je ne trouve pas mon club » te guidera pour le créer.',
      );
    },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !hadClub(ctx),
  },
  {
    advanceOn: { key: RouteNames.Club, type: 'route' },
    bubblePlacement: 'top',
    id: 'm1-csearch',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['search.result.0'],
    get text() { return t('m1-csearch', 'Tape le nom de ton club, puis ouvre sa fiche.'); },
    // Taper le nom puis ouvrir la fiche : le champ doit rester libre (CALIBRAGE-2).
    veil: false,
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !hadClub(ctx),
  },
  {
    advanceOn: { key: 'club.joined', type: 'action' },
    id: 'm1-mine',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    // GUIDE-TEXTES (audit du 28/10, capture 89) : la bulle nomme le bouton
    // affiché ; un club qui a un dirigeant n'a que « Demander à rejoindre ».
    targets: ['club.itsMine'],
    get text() { return t('m1-mine', 'C’est ton club ? Touche « C’est mon club ! ».'); },
    variants: [{
      targets: ['club.askToJoin'],
      get text() {
        return t('m1-mine-ask', 'C’est ton club ? Demande à le rejoindre : un dirigeant validera.');
      },
    }],
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !hadClub(ctx),
  },
  {
    advanceOn: { key: 'club.joined.ack', type: 'interaction' },
    bubblePlacement: 'top',
    id: 'm1-ok',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    get text() { return t('m1-ok', 'Tu fais maintenant partie du club. Touche OK.'); },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !hadClub(ctx),
  },
  {
    advanceOn: { not: RouteNames.Club, type: 'route' },
    id: 'm1-back',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    // Décision d'Adel 4- A (28/10) : cadre sur la flèche, bulle dessous, et le
    // geste du bord (seul retour d'un iPhone). Rien n'est bloqué : le glissement
    // depuis le bord doit passer.
    targets: ['header.back'],
    get text() {
      return t(
        'm1-back',
        'Reviens en arrière : touche la flèche en haut à gauche, ou glisse ton doigt depuis le '
          + 'bord gauche de l’écran.',
      );
    },
    veil: false,
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !hadClub(ctx),
  },
  {
    advanceOn: [
      { key: RouteNames.MyTeamList, type: 'route' },
      { goto: 'tw1', key: RouteNames.TeamWizardName, type: 'route' },
    ],
    id: 'm1-dock2',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['dock.teams'],
    get text() { return t('m1-dock2', 'Retourne dans Équipes pour créer ton équipe.'); },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !hadClub(ctx),
  },
  {
    advanceOn: { goto: 'tw1', key: RouteNames.TeamWizardName, type: 'route' },
    id: 'm1-new2',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: ['teams.fab', 'teams.newTeam'],
    get text() { return t('m1-new2', 'Ton club est rejoint : touche « Nouvelle équipe ».'); },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx) && !hadClub(ctx),
  },
  {
    // Variante « Je ne trouve pas mon club » : tunnel de création de club
    // (écrans non capturés, l'app fait foi) — une bulle commune en haut.
    advanceOn: { goto: 'm1-dock2', key: 'club.created', type: 'action' },
    bubblePlacement: 'top',
    id: 'm1-cw',
    missionId: 'coach_m1',
    resumeFrom: 'm1-dock',
    targets: WIZARD,
    get text() {
      return t('m1-cw', 'Crée ton club : remplis chaque écran, puis Suivant.');
    },
    when: () => false,
  },
  {
    ...wizardStep('tw1', 'coach_m1', RouteNames.TeamWizardDescription, 'tw1', () => t(
      'tw1',
      'Donne un nom à ton équipe : tape-le ou choisis une suggestion, puis Suivant.',
    )),
    navTarget: teamWizardTarget,
    // Club qui a déjà des équipes : la feuille de choix s'ouvre d'abord.
    variants: [{
      targets: ['teams.sheet.newTeam'],
      get text() {
        return t(
          'm1-sheet',
          'Ton club a déjà des équipes : tu pourrais en rejoindre une. Ici, crée la tienne.',
        );
      },
    }],
    when: (/** @type {any} */ ctx) => !hadTeam(ctx),
  },
  ...(/** @type {Array<[string, string, () => string]>} */ ([
    ['tw2', RouteNames.TeamWizardSection, () => t(
      'tw2',
      'Optionnel : décris ton équipe, ou passe cette étape.',
    )],
    ['tw3', RouteNames.TeamWizardActivity, () => t(
      'tw3',
      'Choisis la section, puis Suivant.',
    )],
    ['tw4', RouteNames.TeamWizardCategory, () => t(
      'tw4',
      'Cherche ton sport (tape « foot »), choisis-le, puis Suivant.',
    )],
    ['tw5', RouteNames.TeamWizardLevel, () => t(
      'tw5',
      'La catégorie d’âge de l’équipe, puis Suivant.',
    )],
    ['tw6', RouteNames.TeamWizardTrainers, () => t(
      'tw6',
      'Le niveau de compétition. Tu peux aussi continuer sans.',
    )],
    ['tw7', RouteNames.TeamWizardRecap, () => t(
      'tw7',
      'Coche-toi comme coach de l’équipe, puis Suivant.',
    )],
  ])).map(([id, nextRoute, text]) => ({
    ...wizardStep(id, 'coach_m1', nextRoute, 'tw1', text),
    when: (/** @type {any} */ ctx) => !hadTeam(ctx),
  })),
  {
    // L'alerte « Félicitations » n'a pas de rappel : la mission se valide au
    // succès serveur de la création (`team.created`).
    advanceOn: { key: 'team.created', type: 'action' },
    bubblePlacement: 'top',
    completesMission: true,
    id: 'tw8',
    missionId: 'coach_m1',
    resumeFrom: 'tw1',
    targets: ['teamWizard.next'],
    get text() { return t('tw8', 'Tout est bon ? Crée ton équipe.'); },
    when: (/** @type {any} */ ctx) => !hadTeam(ctx),
  },

  // ── M2 · Inviter tes joueur·se·s ─────────────────────────────────────────
  {
    advanceOn: { key: RouteNames.TeamDetails, type: 'route' },
    id: 'm2-card',
    missionId: 'coach_m2',
    navTarget: teamHubTarget,
    targets: ['teams.trained.0'],
    get text() { return t('m2-card', 'Fais entrer tes joueur·se·s : ouvre ton équipe.'); },
  },
  {
    advanceOn: { key: 'team.actions.open', type: 'interaction' },
    id: 'm2-more',
    missionId: 'coach_m2',
    resumeFrom: 'm2-card',
    targets: ['team.more'],
    get text() { return t('m2-more', 'Les actions de l’équipe sont rangées dans ce menu.'); },
  },
  {
    advanceOn: { key: 'teamActions.shareLink', type: 'interaction' },
    bubblePlacement: 'top',
    // Menu refermé (reprise, retour) : on remontre le bouton ⋮ au lieu d'une
    // bulle « en haut » posée dessus (GUIDE-ENTETE, émulateur 28/10).
    fallback: {
      targets: ['team.more'],
      get text() { return t('m2-more', 'Les actions de l’équipe sont rangées dans ce menu.'); },
    },
    id: 'm2-share',
    missionId: 'coach_m2',
    resumeFrom: 'm2-card',
    targets: ['teamActions.shareLink'],
    get text() { return t('m2-share', 'Le plus simple : un lien d’invitation.'); },
  },
  {
    // Feuille de partage du système : bulle compacte en haut, sans voile.
    advanceOn: [
      { key: 'team.invite.shared', type: 'action' },
      { goto: 'm2-share', key: 'team.invite.dismissed', type: 'interaction' },
    ],
    bubblePlacement: 'top',
    completesMission: true,
    id: 'm2-pick',
    missionId: 'coach_m2',
    resumeFrom: 'm2-card',
    get text() {
      return t(
        'm2-pick',
        'Envoie-le sur le groupe de ton équipe. Chacun·e rejoint en un geste.',
      );
    },
  },

  // ── M3 · Programmer l'entraînement ───────────────────────────────────────
  {
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'm3-dock',
    missionId: 'coach_m3',
    navTarget: homeTarget,
    targets: ['dock.home'],
    get text() { return t('m3-dock', 'Programme maintenant ta séance : ouvre l’accueil.'); },
  },
  {
    advanceOn: { key: RouteNames.EventWizardType, type: 'route' },
    id: 'm3-card',
    missionId: 'coach_m3',
    resumeFrom: 'm3-dock',
    targets: ['home.card.manage-add-event'],
    get text() { return t('m3-card', 'Touche « Ajouter un événement ».'); },
  },
  {
    advanceOn: { key: RouteNames.EventWizardTeam, type: 'route' },
    bubblePlacement: 'top',
    id: 'm3-type',
    missionId: 'coach_m3',
    navTarget: eventWizardTarget,
    resumeFrom: 'm3-type',
    targets: ['eventWizard.type.training'],
    get text() { return t('m3-type', 'Choisis « Entraînement ».'); },
  },
  {
    advanceOn: { key: RouteNames.EventWizardLocation, type: 'route' },
    bubblePlacement: 'top',
    id: 'm3-team',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    targets: ['eventWizard.team.0', 'teamWizard.next'],
    get text() { return t('m3-team', 'Rattache la séance à ton équipe.'); },
  },
  {
    // DATESDABORD (staging, 25/10) : le lieu vient AVANT « Date & horaire ».
    advanceOn: { key: RouteNames.EventWizardLogistics, type: 'route' },
    bubblePlacement: 'top',
    bubbles: [
      () => t(
        'm3-place-1',
        'Club : une installation de ton club. Extérieur : une autre adresse (stade adverse, parc, '
          + 'salle louée…).',
      ),
      () => t('m3-place-2', 'Ici, les installations de ton club. Touche celle de ta séance.'),
      () => t(
        'm3-place-3',
        'Ton terrain n’est pas dans la liste ? Ajoute-le ici : il servira pour toutes tes '
          + 'prochaines séances.',
      ),
      () => t('m3-place-4', 'Choisis ton lieu, puis Suivant.'),
    ],
    id: 'm3-place',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    // Ajout d'une installation (FacilityForm) : une bulle par champ.
    subGuides: [{
      anchor: 'facility.name',
      bubbles: [
        ['facility.name', () => t('m3-fac-1', 'Donne un nom à l’installation et choisis son type '
          + '(obligatoire).')],
        ['facility.address', () => t('m3-fac-2', 'L’adresse exacte : tes joueur·se·s pourront '
          + 'l’ouvrir dans leur GPS.')],
        ['facility.conflict', () => t('m3-fac-3', 'Si deux équipes réservent le même créneau : '
          + '« Demande à valider », un dirigeant tranche ; « Autoriser et notifier », c’est '
          + 'réservé tout de suite et le bureau est prévenu.')],
        ['facility.capacity', () => t('m3-fac-4', 'Capacité : combien d’équipes peuvent '
          + 'l’utiliser en même temps. Ex. 2 pour un terrain coupé en deux.')],
        ['facility.color', () => t('m3-fac-5', 'La couleur de l’installation dans le planning, '
          + 'pour la repérer d’un coup d’œil.')],
        ['facility.create', () => t('m3-fac-6', 'Tout est bon ? Crée-la : elle sera '
          + 'sélectionnée pour ta séance.')],
      ],
    }],
    targets: WIZARD,
    get text() { return t('m3-place-4', 'Choisis ton lieu, puis Suivant.'); },
  },
  {
    // Sélecteurs de date et feuille « Répéter » : rien n'est bloqué (voile coupé).
    advanceOn: { key: RouteNames.EventWizardAccess, type: 'route' },
    bubblePlacement: 'top',
    id: 'm3-when',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    targets: ['eventWizard.when', 'eventWizard.repeat', 'teamWizard.next'],
    get text() {
      return t(
        'm3-when',
        'Touche la date et les heures pour les choisir. Ta séance revient chaque semaine ? Ouvre '
          + '« Répéter » et applique. Puis Suivant.',
      );
    },
    // Feuille « Répéter » ouverte : une bulle par zone (pack 02, M3).
    subGuides: [{
      anchor: 'repeat.frequency',
      bubbles: [
        ['repeat.frequency', () => t('m3-rep-1', 'Fréquence : « Hebdomadaire » pour une séance '
          + 'chaque semaine, « Mensuel » pour une fois par mois.')],
        ['repeat.interval', () => t('m3-rep-2', 'Intervalle : 1 = toutes les semaines. Touche + '
          + 'pour passer à toutes les 2 semaines, et ainsi de suite.')],
        ['repeat.days', () => t('m3-rep-3', 'Jours : le jour de ta séance est déjà coché. Touche '
          + 'un autre jour si tu t’entraînes 2 fois par semaine.')],
        ['repeat.end', () => t('m3-rep-4', 'Date de fin : jusqu’à quand la séance se répète. '
          + 'Touche pour la changer.')],
        ['repeat.apply', () => t('m3-rep-5', 'Tout est bon ? Appuie sur Appliquer.')],
      ],
    }],
    veil: false,
  },
  wizardStep('m3-access', 'coach_m3', RouteNames.EventWizardDescription, 'm3-type', () => t(
    'm3-access',
    'Public : tout le monde le trouve dans Rechercher et peut demander à venir. Privé : seulement '
      + 'ton équipe et tes invités. Pour un entraînement, garde Privé.',
  )),
  wizardStep('m3-desc', 'coach_m3', RouteNames.EventWizardRecap, 'm3-type', () => t(
    'm3-desc',
    'Écris une consigne pour ton équipe (ex. : rendez-vous 15 min avant). Sinon, passe.',
  )),
  {
    advanceOn: { key: 'event.created', type: 'action' },
    bubblePlacement: 'top',
    id: 'm3-create',
    missionId: 'coach_m3',
    resumeFrom: 'm3-type',
    targets: ['eventWizard.occurrences', 'teamWizard.next'],
    get text() {
      return t(
        'm3-create',
        'Vérifie le récap : si ta séance se répète, elle s’arrête à la date de fin choisie dans '
          + '« Répéter ». Crée !',
      );
    },
  },
  {
    bubblePlacement: 'top',
    completesMission: true,
    id: 'm3-page',
    missionId: 'coach_m3',
    get nextLabel() { return t('understood', 'Compris'); },
    get text() { return t('m3-page', 'Ta séance est en ligne.'); },
  },

  // ── M4 · Rechercher ──────────────────────────────────────────────────────
  {
    advanceOn: { key: RouteNames.SearchHome, type: 'route' },
    id: 'm4-back',
    missionId: 'coach_m4',
    navTarget: homeTarget,
    targets: ['dock.home'],
    get text() {
      return t('m4-back', 'Ta séance est en ligne. Dernière mission : retourne à l’accueil.');
    },
  },
  {
    // `SearchRecruitment` est une redirection vers le hub : c'est la route du
    // hub qui arrive au guide (TUTOE-CALIBRAGE, émulateur).
    advanceOn: [
      { key: RouteNames.SearchRecruitment, type: 'route' },
      { key: RouteNames.SearchHub, type: 'route' },
    ],
    id: 'm4-card',
    missionId: 'coach_m4',
    resumeFrom: 'm4-back',
    targets: ['home.card.search-profiles'],
    get text() {
      return t(
        'm4-card',
        'Il te manque un·e joueur·se ? Les profils ouverts au recrutement sont ici.',
      );
    },
  },
  {
    bubblePlacement: 'top',
    id: 'm4-read',
    missionId: 'coach_m4',
    get nextLabel() { return t('understood', 'Compris'); },
    resumeFrom: 'm4-back',
    targets: ['search.filters', 'search.result.0'],
    get text() {
      return t(
        'm4-read',
        'Fais défiler pour voir les profils. Pour trouver le bon, utilise les filtres, puis ouvre '
          + 'une carte.',
      );
    },
    veil: false,
  },
  {
    advanceOn: { key: 'search.tab.events', type: 'interaction' },
    bubblePlacement: 'top',
    id: 'm4-tab-ev',
    missionId: 'coach_m4',
    resumeFrom: 'm4-back',
    targets: ['search.tab.events'],
    get text() {
      return t(
        'm4-tab-ev',
        'Ouvre l’onglet Événement (le calendrier) : tu y trouves les tournois et détections près '
          + 'de chez toi.',
      );
    },
  },
  {
    advanceOn: { key: 'search.tab.clubs', type: 'interaction' },
    bubblePlacement: 'top',
    id: 'm4-tab-club',
    missionId: 'coach_m4',
    resumeFrom: 'm4-back',
    targets: ['search.tab.clubs'],
    get text() { return t('m4-tab-club', 'Les événements. Ouvre maintenant « Club ».'); },
  },
  {
    advanceOn: { key: 'search.tab.amicaux', type: 'interaction' },
    bubblePlacement: 'top',
    id: 'm4-tab-fr',
    missionId: 'coach_m4',
    resumeFrom: 'm4-back',
    targets: ['search.tab.amicaux'],
    get text() { return t('m4-tab-fr', 'Les clubs. Dernier onglet : « Matchs amicaux ».'); },
  },
  {
    advanceOn: { key: RouteNames.FriendlyMatchWizardTeam, type: 'route' },
    id: 'm4-frc',
    missionId: 'coach_m4',
    navTarget: friendlySearchTarget,
    resumeFrom: 'm4-frc',
    targets: ['friendly.create'],
    get text() { return t('m4-frc', 'À toi : crée ton annonce de match amical.'); },
  },
  ...(/** @type {Array<[string, string, () => string]>} */ ([
    ['m4-am1', RouteNames.FriendlyMatchWizardHosting, () => t(
      'm4-am1',
      'Touche l’équipe qui cherche un adversaire.',
    )],
    ['m4-am2', RouteNames.FriendlyMatchWizardDates, () => t(
      'm4-am2',
      'Tu reçois sur ton terrain, tu te déplaces, ou les deux. « Les deux » touche le '
        + 'plus d’équipes.',
    )],
    ['m4-am3', RouteNames.FriendlyMatchWizardLocation, () => t(
      'm4-am3',
      'Choisis un jour (l’heure est facultative), puis « Ajouter cette date ». '
        + 'Propose-en plusieurs : tu auras plus de réponses.',
    )],
    ['m4-am4', RouteNames.FriendlyMatchWizardOpponent, () => t(
      'm4-am4',
      'Touche ton terrain, ou tape ta ville. Puis choisis jusqu’où tu acceptes de te déplacer.',
    )],
    ['m4-am5', RouteNames.FriendlyMatchWizardDescription, () => t(
      'm4-am5',
      'On a coché la catégorie et le niveau de ton équipe. Ajoute-en d’autres, ou touche « Peu '
        + 'importe, je prends tout ».',
    )],
    ['m4-am6', RouteNames.FriendlyMatchWizardRecap, () => t(
      'm4-am6',
      'Un mot pour les autres coachs et qui arbitre : c’est facultatif. Sinon, « Passer cette '
        + 'étape ».',
    )],
  ])).map(([id, nextRoute, text]) => ({
    ...wizardStep(id, 'coach_m4', nextRoute, 'm4-frc', text),
    // Les dates passent par des sélecteurs : rien n'est bloqué à cette étape.
    ...(id === 'm4-am3' ? { veil: false } : {}),
  })),
  {
    advanceOn: { key: 'friendlyMatch.ad.published', type: 'action' },
    bubblePlacement: 'top',
    completesMission: true,
    id: 'm4-am7',
    missionId: 'coach_m4',
    resumeFrom: 'm4-frc',
    targets: ['teamWizard.next'],
    get text() {
      return t(
        'm4-am7',
        'Tout est bon ? Publie : les équipes de ta zone pourront te proposer un match.',
      );
    },
  },

  { id: 'palier', kind: 'milestone' },

  // ── B1 · Voir qui vient et relancer (bonus, sur la vraie séance de M3) ──
  {
    advanceOn: { key: RouteNames.MyEventList, type: 'route' },
    id: 'b1-dock',
    missionId: 'coach_b1',
    // Après le palier ou B1, on est loin du dock : le guide ramène à l'accueil.
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.planning'],
    get text() { return t('b1-dock', 'Pour savoir qui vient : ouvre le planning.'); },
  },
  {
    advanceOn: { key: RouteNames.EventDetails, type: 'route' },
    bubblePlacement: 'top',
    id: 'b1-card',
    missionId: 'coach_b1',
    resumeFrom: 'b1-dock',
    // La carte de LA séance créée en M3 (pack 02, B1) ; inconnue : bulle seule.
    targetsFor: (/** @type {any} */ context) => {
      const eventId = context?.created?.['event.created']?.documentId;
      return eventId ? [`planning.event.${eventId}`] : [];
    },
    get text() { return t('b1-card', 'Ouvre ta séance.'); },
  },
  {
    // Équipe encore vide : rien à relancer, « Passer ce bonus » reste là.
    advanceOn: { key: 'event.relance.sent', type: 'action' },
    completesMission: true,
    id: 'b1-relance',
    missionId: 'coach_b1',
    resumeFrom: 'b1-dock',
    targets: ['event.relance'],
    get text() {
      return t(
        'b1-relance',
        'Plus bas : les participants. Personne n’a encore répondu : relance-les en un clic. Pas '
          + 'encore de joueur·se ? C’est ici que tu les relanceras.',
      );
    },
  },

  // ── B2 · Convoquer pour un match (bonus SIMULÉ : rien n'est envoyé) ──────
  {
    advanceOn: { key: RouteNames.MyEventList, type: 'route' },
    id: 'b2-dock',
    missionId: 'coach_b2',
    // Après le palier ou B1, on est loin du dock : le guide ramène à l'accueil.
    navigateOnEnter: true,
    navTarget: homeTarget,
    targets: ['dock.planning'],
    get text() { return t('b2-dock', 'Tes matchs sont dans le planning : ouvre-le.'); },
  },
  {
    bubblePlacement: 'top',
    id: 'b2-where',
    missionId: 'coach_b2',
    get nextLabel() { return t('b2-where-next', 'Essayer'); },
    resumeFrom: 'b2-dock',
    get text() {
      return t(
        'b2-where',
        'Pour un vrai match : ouvre-le ici, onglet « Convocation », puis « Préparer la '
          + 'convocation ». On s’entraîne sur un match d’exemple contre US Monpeyroux : rien '
          + 'ne sera envoyé.',
      );
    },
  },
  {
    advanceOn: [
      { key: RouteNames.MatchCompositionStart, type: 'route' },
      { goto: 'b2-pub', key: RouteNames.MatchCompositionBoard, type: 'route' },
    ],
    bubblePlacement: 'top',
    id: 'b2-list',
    missionId: 'coach_b2',
    navigateOnEnter: true,
    navTarget: {
      params: (/** @type {any} */ context) => ({
        params: exampleMatch(context),
        screen: RouteNames.MatchCallUpSelection,
      }),
      routeName: RouteNames.EventStack,
    },
    resumeFrom: 'b2-dock',
    get text() { return t('b2-list', 'Coche les joueur·se·s que tu convoques, puis Suivant.'); },
    veil: false,
  },
  {
    advanceOn: { key: RouteNames.MatchCompositionBoard, type: 'route' },
    bubblePlacement: 'top',
    id: 'b2-start',
    missionId: 'coach_b2',
    resumeFrom: 'b2-dock',
    get text() { return t('b2-start', 'Pars d’une formation ou d’un terrain vide.'); },
    veil: false,
  },
  {
    advanceOn: { key: 'composition.simulated.published', type: 'action' },
    bubblePlacement: 'top',
    completesMission: true,
    id: 'b2-pub',
    missionId: 'coach_b2',
    resumeFrom: 'b2-dock',
    get text() {
      return t(
        'b2-pub',
        'Glisse tes joueur·se·s sur les postes, puis publie : la compo part dans le canal de '
          + 'l’équipe, avec une demande de réponse.',
      );
    },
    veil: false,
  },

  { id: 'close', kind: 'closing' },
];

export const COACH_GUIDE = Object.freeze({
  /**
   * Situation au départ, figée pour tout le guide (un club rejoint en route ne
   * doit pas faire sauter la suite de la branche « sans club »).
   * @param {{ userData: any }} context - Personne connectée.
   * @returns {{ firstName: string; hadClub: boolean; hadTeam: boolean }} Drapeaux.
   */
  buildFlags: ({ userData }) => ({
    firstName: String(userData?.firstname || userData?.firstName || ''),
    hadClub: Boolean(userData?.club?.documentId),
    // Seules les équipes qu'il entraîne (décision du chef, 27/10), et dans son
    // club courant : l'écran Équipes ne montre que celui-là (tournée : Julien
    // entraîne ailleurs, et « ouvre-la » visait son équipe de JOUEUR).
    hadTeam: (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : [])
      .some((/** @type {any} */ team) => !userData?.club?.documentId
        || !team?.club?.documentId
        || team.club.documentId === userData.club.documentId),
  }),
  get kicker() { return t('kicker', 'Guide entraîneur·e'); },
  missions: MISSIONS,
  steps: STEPS,
  version: 3,
});
