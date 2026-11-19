/* eslint-disable max-len -- titres de témoins en phrases, et relevés figés ligne à ligne */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// T-PAGES-4 (17/11) — LA FICHE DU TOURNOI AU TÉLÉPHONE, lecteur par lecteur.
//
// Point 0 (E6, R2) : ce que la branche tournoi d'`EventDetails.js` montre à chaque lecteur
// (visiteur, joueur sans équipe, trop jeune, capitaine, membre, invité, organisateur), bouton du
// bas compris. Les points 1 à 7 suivent la maquette validée design/DESIGN-TOURNOI-PAGES/ (a) et
// (b), version téléphone.
//
// ⚠️ Jest n'a pas de moteur de mise en page : ce filet lit ce qui est MONTÉ. L'ordre réel et la
// place se voient à la recette.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };
// La page d'équipe, lue par la carte « Mon équipe » (useGetTournamentTeam).
const mockTeamQuery = { data: /** @type {any} */ (null) };

// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    candidateId: '',
    canInvite: false,
    reason: 'missing-team',
  }),
}));

// Les textes de fr.js (jetons, pluriel français) : la doublure partagée.
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }),
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: {} } },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: jest.fn() }),
}));

const emptyQuery = () => ({
  data: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEventQuery.data,
    dataUpdatedAt: 1,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetEventAttendance: () => emptyQuery(),
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

// 🏆 N7 item 5 (vague P, 23/08) — le fil du tournoi lit `useGetTournamentDashboard`,
// qui tire `@/services/client`. Sans cette doublure MUETTE, la suite entiere
// tombe a 0 test (piege connu : un import de service de plus). `data: undefined`
// = le calcul de repli de la page, identique a ce que ces temoins decrivaient.
// L'itinéraire de la case Lieu (T-PAGES-4, chef 17/11).
const mockOpenExternalMap = jest.fn();
jest.mock('@/platform/maps/externalMap', () => ({
  openExternalMap: (/** @type {any} */ cible) => mockOpenExternalMap(cible),
}));

// Sans ce double, l'import tire `@/services/client`, qui jette sans `.env`.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({
  useGetTournamentTeam: (/** @type {string} */ documentId) => ({
    data: documentId ? mockTeamQuery.data : null,
    isLoading: false,
  }),
}));

jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  exportEventParticipants: jest.fn(),
  rejectFeatured: jest.fn(),
}));

jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  requestJoinTournamentTeam: jest.fn(),
  respondToTournamentTeam: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: jest.fn() },
}));

jest.mock('@/utils/performance/eventDetailsPerformance', () => ({
  markEventDetailsPerf: jest.fn(),
}));

jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: idleMutation(),
      bookFullMutation: idleMutation(),
      cancelEventMutation: idleMutation(),
      coachArrivalMutation: idleMutation(),
      createEventParticipationMutation: idleMutation(),
      declineParticipationMutation: idleMutation(),
      deleteParticipationMutation: idleMutation(),
      joinReservationMutation: idleMutation(),
      missingEventMutation: idleMutation(),
      openForPlayersMutation: idleMutation(),
      remindEventMutation: idleMutation(),
      reportEventMutation: idleMutation(),
      requestFeaturedMutation: idleMutation(),
      resetAttendanceMutation: idleMutation(),
      respondToEventRsvpMutation: idleMutation(),
      selfArrivalMutation: idleMutation(),
      selfLateMutation: idleMutation(),
      sosAlertMutation: idleMutation(),
      updateEventMutation: idleMutation(),
      updateEventNoNavMutation: idleMutation(),
      updateLateMinutesMutation: idleMutation(),
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function WithDataWrapperDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible && !props.visible) return null;
    return react.createElement(rn.View, null, props.children);
  };
});

// 🎛️ LA DOUBLURE DES ONGLETS. `SegmentedControl` est deja sous test chez lui
// (201 lignes) : ce n'est pas son dessin qu'on verifie ici, c'est CE QU'ON LUI
// DONNE et CE QU'IL COMMANDE. La doublure rend donc un pressable par option,
// portant son libelle — exactement ce qu'un doigt peut atteindre.
// ⛔ Elle est aussi ce qui evite de monter `react-native-reanimated` et
// `react-native-gesture-handler` pour rien dans une suite qui monte deja
// 6 800 lignes d'ecran.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      // 🔎 R6 (vague R) — LA DOUBLURE RELAIE AUSSI LA CONSIGNE D'AFFICHAGE.
      // Le libelle a toujours ete complet DANS L'ARBRE : c'est `numberOfLines`
      // qui le coupait A L'ECRAN. Un temoin qui lirait le texte rendu serait
      // donc vert avant comme apres le correctif — seule la prop tranche.
      // 🔠 S5 (vague S) : la doublure relaie AUSSI `fitLabels`. Elle ne captait
      // que `fullLabels` — un temoin qui ne regarde pas la prop qui commande
      // reste vert quand l ecran change de mode.
      {
        fitLabels: Boolean(props.fitLabels),
        fullLabels: Boolean(props.fullLabels),
        testID: 'doublure-onglets',
      },
      (props.options || []).map((/** @type {any} */ option) => react.createElement(
        rn.TouchableOpacity,
        {
          key: option.value,
          onPress: () => props.onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        react.createElement(rn.Text, null, option.label),
      )),
    );
  };
});

// 🪢 La doublure d'`EventParticipants` rend le MEME bouton que le vrai et le
// branche sur la MEME propriete — motif repris d'`AD10ExportFeuilleBranchee`,
// ou le temoin 0 compare cette doublure au vrai composant monte pour de bon.
// C'est ce qui rend le temoin 6 credible sans monter 784 lignes de liste.
jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { onPress: props.handleExportParticipants, testID: 'bouton-export' },
      react.createElement(rn.Text, null, 'Exporter la liste (Excel/CSV)'),
    );
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/components/molecules/eventAnswerButtons/EventAnswerButtons',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventAnswerButtons'),
);
jest.mock(
  '@/components/organisms/joinEventModal/JoinEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_JoinEventModal'),
);
jest.mock(
  '@/components/organisms/refuseParticipationModal/RefuseParticipationModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_RefuseParticipationModal'),
);
jest.mock(
  '@/components/organisms/reportEventModal/ReportEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ReportEventModal'),
);
jest.mock(
  '@/components/organisms/shareEventModal/ShareEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ShareEventModal'),
);
jest.mock(
  '../components/EventHeader',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventHeader'),
);
jest.mock(
  '../components/EventDetectionSlots',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventDetectionSlots'),
);
jest.mock(
  '../components/EventTasksSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksSection'),
);
jest.mock(
  '../components/EventTeamAudiencesSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesSection'),
);
jest.mock(
  '../components/EventReservationActions',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventReservationActions'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(60000);

// --- Le tournoi, sous la forme que le serveur envoie VRAIMENT à la fiche --------------------
// `members` est vide (personne n'a `tournament-team-member.find`) : le capitaine se reconnaît
// par `captainUser`, le membre et l'invité par la marque `viewerMembership` (T-PARCOURS-2).
const AIGLES = {
  captainUser: { documentId: 'cap-1', firstname: 'Karim', lastname: 'Sylla' },
  documentId: 'eq-aigles',
  isOpenToJoinRequests: true,
  members: [],
  name: 'Les Aigles',
  sourceType: 'custom_team',
  status: 'accepted',
};
const LIONS = {
  captainUser: { documentId: 'cap-2', firstname: 'Leo', lastname: 'Diarra' },
  documentId: 'eq-lions',
  members: [],
  name: 'Les Lions',
  sourceType: 'custom_team',
  status: 'pending',
};

const TOURNOI = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: 'club-orga' },
  date: '2099-12-19T18:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'FoundClub x AR Soccer',
  participations: [],
  startTime: '19:00',
  tournamentConfig: {
    allowCustomTeams: true,
    competitionState: 'draft',
    entryFeeCents: 2000,
    formatMode: 'groups_to_knockout',
    maxRosterSize: 5,
    maxTeams: 24,
    minAge: 16,
    minRosterSize: 5,
    registrationMode: 'manual',
  },
  tournamentScopeMode: 'autonomous',
  tournamentTeams: [AIGLES, LIONS],
  type: { name: 'Tournoi' },
  ...overrides,
});

/**
 * Un compte de joueur, né à la date donnée (29 ans au jour du tournoi, par défaut).
 * @param {string} documentId - L'identifiant du compte.
 * @param {{ peutGerer?: boolean, birthdate?: string }} [options] - Gestionnaire, naissance.
 * @returns {any} Ce que rend `useAuth`.
 */
const compte = (documentId, { birthdate = '2070-03-01', peutGerer = false } = {}) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    birthdate,
    documentId,
    role: { name: peutGerer ? 'Dirigeant' : 'Joueur' },
  },
});

const LECTEURS = {
  capitaine: () => ({ auth: compte('cap-1'), event: TOURNOI() }),
  invite: () => ({
    auth: compte('invite-1'),
    event: TOURNOI({
      tournamentTeams: [AIGLES, { ...LIONS, viewerMembership: { responseStatus: 'invited' } }],
    }),
  }),
  membre: () => ({
    auth: compte('membre-1'),
    event: TOURNOI({
      tournamentTeams: [{ ...AIGLES, viewerMembership: { responseStatus: 'present' } }, LIONS],
    }),
  }),
  // Récolte du train 12 (chef, 17/11) : l organisateur est celui de CE tournoi (`event.organizer`,
  // règle isTournamentOrganizer de T-PAGES-6).
  organisateur: () => ({
    auth: compte('orga-1', { peutGerer: true }),
    event: TOURNOI({ organizer: { documentId: 'orga-1' } }),
  }),
  sansEquipe: () => ({ auth: compte('joueur-seul'), event: TOURNOI() }),
  // 14 ans au jour du tournoi (19/12/2099).
  tropJeune: () => ({ auth: compte('ado-1', { birthdate: '2085-06-01' }), event: TOURNOI() }),
  visiteur: () => ({
    auth: { ...compte(''), userData: null },
    event: TOURNOI({
      tournamentTeams: undefined,
      tournamentTeamsSummary: { expectedCount: 24, registeredCount: 2 },
    }),
  }),
};

/** @type {any} */
let mounted = null;

const demonter = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

const monter = (/** @type {any} */ { auth, event }) => {
  mockEventQuery.data = event;
  mockConvocationQuery.data = null;
  mockUseAuth.mockReturnValue(auth);
  demonter();
  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          getParent: () => undefined,
          getState: () => ({ routeNames: ['EventDetails', 'EventEdit'] }),
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });
  return mounted.root;
};

afterEach(() => {
  demonter();
});

const textOf = (/** @type {any} */ node) => {
  /** @type {string[]} */
  const parts = [];
  const walk = (/** @type {any} */ child) => {
    if (child === null || child === undefined || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
      return;
    }
    const children = child?.props?.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  };
  walk(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const textes = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false });

const compter = (/** @type {string[]} */ liste, /** @type {string} */ extrait) => liste
  .filter((ligne) => ligne.includes(extrait)).length;

const ongletsDe = (/** @type {any} */ root) => parTestID(root, 'doublure-onglets')
  .flatMap((/** @type {any} */ node) => node
    .findAllByType(TouchableOpacity)
    .map((/** @type {any} */ item) => textOf(item)));

const allerSurLOnglet = (/** @type {any} */ root, /** @type {string} */ valeur) => {
  const [onglet] = parTestID(root, `onglet-${valeur}`);
  if (!onglet) throw new Error(`Aucun onglet « ${valeur} »`);
  act(() => {
    onglet.props.onPress();
  });
};

/**
 * Ce qu'un lecteur voit de la fiche, onglet Aperçu, puis onglet Équipes.
 * @param {any} lecteur - `{ auth, event }`.
 * @returns {Record<string, any>} Le relevé.
 */
const releve = (lecteur) => {
  const root = monter(lecteur);
  const apercu = textes(root);
  const barre = parTestID(root, 'tournament-bottom-bar');
  const resultat = {
    barreDuBas: barre.length ? textes(barre[0]).join(' | ') : null,
    brouillon: compter(apercu, 'Compétition en brouillon'),
    carteMonEquipe: parTestID(root, 'tournament-fiche-my-team-progress').length,
    // IMPL-1-FICHE (6b) : la pastille TOURNOI est dans le bandeau (EventHeader), plus au-dessus ;
    // il reste celle de la carte de pilotage de l'organisateur.
    carteTournoi: apercu.filter((ligne) => ligne === 'TOURNOI').length,
    conditions: parTestID(root, 'event-tournament-terms-link').length,
    creerUneEquipe: compter(apercu, 'Créer une équipe pour ce tournoi'),
    essentiel: parTestID(root, 'tournament-essentials').length,
    inscrireEquipeDuClub: compter(apercu, 'Inscrire une équipe du club'),
    messageAge: compter(apercu, 'Ce tournoi est ouvert à partir de 16 ans'),
    onglets: ongletsDe(root),
    participer: compter(apercu, 'Participer'),
    rail: compter(apercu, 'OÙ EN EST LE TOURNOI'),
    rejoindre: parTestID(root, 'tournament-join-team-panel').length,
    reponseAuTournoi: compter(apercu, 'Ma réponse au tournoi'),
    validationManuelle: compter(apercu, 'Validation manuelle'),
  };
  allerSurLOnglet(root, 'tournamentTeams');
  const equipes = textes(root);
  return {
    ...resultat,
    ongletEquipes: {
      aucuneEquipe: compter(equipes, 'Aucune équipe n est encore inscrite'),
      conditions: parTestID(root, 'event-tournament-terms-link').length,
      creerUneEquipe: compter(equipes, 'Créer une équipe pour ce tournoi'),
      resume: parTestID(root, 'event-tournament-teams-summary').map(textOf),
    },
  };
};

const RELEVE_DU_LECTEUR = {
  capitaine: {
    barreDuBas: 'Voir mon équipe',
    brouillon: 0,
    carteMonEquipe: 1,
    carteTournoi: 0,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 1,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      // FICHE-TOURNOI (19/11, 6b) : les conditions vivent dans Aperçu, plus sous l'onglet Équipes.
      conditions: 0,
      creerUneEquipe: 0,
      resume: [
        '24 équipes attendues',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes',
      'Personnes',
    ],
    participer: 0,
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  invite: {
    barreDuBas: 'Répondre à mon invitation',
    brouillon: 0,
    carteMonEquipe: 1,
    carteTournoi: 0,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 1,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      // FICHE-TOURNOI (19/11, 6b) : les conditions vivent dans Aperçu, plus sous l'onglet Équipes.
      conditions: 0,
      creerUneEquipe: 0,
      resume: [
        '24 équipes attendues',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes',
      'Personnes',
    ],
    participer: 0,
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  membre: {
    barreDuBas: 'Voir mon équipe',
    brouillon: 0,
    carteMonEquipe: 1,
    carteTournoi: 0,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 1,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      // FICHE-TOURNOI (19/11, 6b) : les conditions vivent dans Aperçu, plus sous l'onglet Équipes.
      conditions: 0,
      creerUneEquipe: 0,
      resume: [
        '24 équipes attendues',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes',
      'Personnes',
    ],
    participer: 0,
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  organisateur: {
    barreDuBas: 'Gérer le tournoi',
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 1,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 1,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      // FICHE-TOURNOI (19/11, 6b) : les conditions vivent dans Aperçu, plus sous l'onglet Équipes.
      conditions: 0,
      creerUneEquipe: 0,
      resume: [
        '1 validée · 1 en attente',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes · 2',
      'Personnes · 0',
    ],
    participer: 0,
    rail: 1,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  sansEquipe: {
    barreDuBas: '20 € par joueur | Créer mon équipe',
    brouillon: 0,
    carteMonEquipe: 0,
    carteTournoi: 0,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 1,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      // FICHE-TOURNOI (19/11, 6b) : les conditions vivent dans Aperçu, plus sous l'onglet Équipes.
      conditions: 0,
      creerUneEquipe: 0,
      resume: [
        '24 équipes attendues',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes',
      'Personnes',
    ],
    participer: 0,
    rail: 0,
    rejoindre: 1,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  tropJeune: {
    barreDuBas: null,
    brouillon: 0,
    carteMonEquipe: 0,
    carteTournoi: 0,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 1,
    inscrireEquipeDuClub: 0,
    messageAge: 1,
    ongletEquipes: {
      aucuneEquipe: 0,
      // FICHE-TOURNOI (19/11, 6b) : les conditions vivent dans Aperçu, plus sous l'onglet Équipes.
      conditions: 0,
      creerUneEquipe: 0,
      resume: [
        '24 équipes attendues',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes',
      'Personnes',
    ],
    participer: 0,
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  visiteur: {
    // T-PAGES-4b (18/11, chef, R7) : « Créer mon équipe », comme le site.
    barreDuBas: '20 € par joueur | Créer mon équipe',
    brouillon: 0,
    carteMonEquipe: 0,
    carteTournoi: 0,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 1,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      // FICHE-TOURNOI (19/11, 6b) : les conditions vivent dans Aperçu, plus sous l'onglet Équipes.
      conditions: 0,
      creerUneEquipe: 0,
      resume: [
        '24 équipes attendues',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes',
      'Personnes',
    ],
    participer: 0,
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
};

describe('T-PAGES-4 · point 0 — ce que chaque lecteur voit (filet ; l avant est dans 7c26ec2bf)', () => {
  Object.keys(RELEVE_DU_LECTEUR).forEach((lecteur) => {
    test(`${lecteur}`, () => {
      // @ts-ignore: clé du relevé
      expect(releve(LECTEURS[lecteur]())).toEqual(RELEVE_DU_LECTEUR[lecteur]);
    });
  });
});
// ============================================================================================
// POINTS 1 À 7 — ce que la maquette validée (a) et (b), version téléphone, demande.
// ============================================================================================

/** Les blocs suivis, pour lire leur ordre dans l'arbre (de haut en bas de l'écran). */
const ORDRE = [
  'tournament-fiche-my-team',
  'tournament-essentials',
  'tournament-registration-card',
  'tournament-join-team-panel',
  'tournament-how-it-works',
  'tournament-before-sign-up',
  'event-tournament-terms-link',
  'doublure-onglets',
];
const ordreDe = (/** @type {any} */ root) => [...new Set(root
  .findAll((/** @type {any} */ node) => ORDRE.includes(node.props?.testID), { deep: true })
  .map((/** @type {any} */ node) => node.props.testID))];

const barreDe = (/** @type {any} */ root) => {
  const [barre] = parTestID(root, 'tournament-bottom-bar');
  return barre ? textes(barre) : null;
};

/** L'équipe telle que `GET /tournament-teams/:id` la rend (la page d'équipe). */
const EQUIPE_DETAILLEE = {
  ...AIGLES,
  members: [
    {
      documentId: 'm-cap', responseStatus: 'present', user: { documentId: 'cap-1', firstname: 'Karim' },
    },
    {
      documentId: 'm-2', responseStatus: 'present', user: { documentId: 'membre-1', firstname: 'Ado' },
    },
    {
      documentId: 'm-3', responseStatus: 'present', user: { documentId: 'j-3', firstname: 'Michel' },
    },
  ],
  payment: {
    entryFeeCents: 2000,
    members: [
      { isSelf: true, memberDocumentId: 'm-cap', status: 'paid' },
      { memberDocumentId: 'm-2', status: 'due' },
      { memberDocumentId: 'm-3', status: 'due' },
    ],
    paidCount: 1,
    paidMembersToValidate: 5,
  },
};

beforeEach(() => {
  mockTeamQuery.data = EQUIPE_DETAILLEE;
});

describe('T-PAGES-4 · point 1 — écrans (a) et (b) au téléphone', () => {
  test('🔴 (a) sans équipe : essentiel, inscription, rejoindre, conditions, onglets', () => {
    const root = monter(LECTEURS.sansEquipe());
    // FICHE-TOURNOI (19/11, 6b) : les onglets passent juste sous le bandeau ; les blocs suivent,
    // dans Aperçu.
    expect(ordreDe(root)).toEqual([
      'doublure-onglets',
      'tournament-essentials',
      'tournament-registration-card',
      'tournament-join-team-panel',
      'tournament-how-it-works',
      'tournament-before-sign-up',
      'event-tournament-terms-link',
    ]);
    const [carte] = parTestID(root, 'tournament-registration-card');
    expect(textes(carte)).toEqual(expect.arrayContaining([
      'Ton inscription', 'Inscris ton équipe', '20 € par joueur', 'Créer mon équipe',
    ]));
  });

  test('🔴 (a) sans équipe : le bas dit le prix et « Créer mon équipe », qui ouvre la feuille', () => {
    const root = monter(LECTEURS.sansEquipe());
    expect(barreDe(root)).toEqual(['20 € par joueur', 'Créer mon équipe']);
    const [barre] = parTestID(root, 'tournament-bottom-bar');
    const [bouton] = barre.findAllByType(TouchableOpacity);
    act(() => {
      bouton.props.onPress();
    });
    expect(textes(root)).toContain('Créer une équipe');
  });

  test('(a) compétition publiée, garde-fou : le bas reste « Voir le tournoi » (déroulé, résultats)', () => {
    const lecteur = LECTEURS.sansEquipe();
    lecteur.event.tournamentConfig = {
      ...lecteur.event.tournamentConfig, competitionState: 'published',
    };
    expect(barreDe(monter(lecteur))).toEqual(['Voir le tournoi']);
  });

  test('🔴 (b) capitaine : « Mon équipe » d abord, puis l essentiel ; en bas « Voir mon équipe »', () => {
    const root = monter(LECTEURS.capitaine());
    // FICHE-TOURNOI (19/11, 9f) : « Mon équipe », puis les onglets, puis Aperçu.
    expect(ordreDe(root)).toEqual([
      'tournament-fiche-my-team',
      'doublure-onglets',
      'tournament-essentials',
      'tournament-before-sign-up',
      'event-tournament-terms-link',
    ]);
    expect(textes(parTestID(root, 'tournament-before-sign-up')[0])[0]).toBe('Avant le match');
    const [carte] = parTestID(root, 'tournament-fiche-my-team');
    // IMPL-1-FICHE (9f) : la carte compacte dit « 1 place payée sur 5 ».
    expect(textes(carte)).toEqual(expect.arrayContaining(['Les Aigles', 'Voir mon équipe', '1 place payée sur 5']));
    // « Il te reste à faire » reste sur la page d'équipe (IMPL-1, 9f), où « Voir mon équipe » mène.
    expect(parTestID(root, 'tournament-team-progress-todo')).toHaveLength(0);
    expect(barreDe(root)).toEqual(['Voir mon équipe']);
  });

  test('🔴 (b) membre (R4) : la même carte, en bas « Voir mon équipe »', () => {
    const root = monter(LECTEURS.membre());
    expect(parTestID(root, 'tournament-fiche-my-team')).toHaveLength(1);
    expect(barreDe(root)).toEqual(['Voir mon équipe']);
  });

  test('🔴 (b) invité (R4) : la carte de son équipe et son seul geste', () => {
    mockTeamQuery.data = { ...LIONS, members: [] };
    const root = monter(LECTEURS.invite());
    const [carte] = parTestID(root, 'tournament-fiche-my-team');
    expect(textes(carte)).toEqual(expect.arrayContaining([
      'Les Lions', 'Répondre à mon invitation',
    ]));
    expect(barreDe(root)).toEqual(['Répondre à mon invitation']);
  });

  test('🔴 (b) sans la page d équipe (chargement, refus) : le nom et le geste, jamais « 0 / 5 »', () => {
    mockTeamQuery.data = null;
    const root = monter(LECTEURS.capitaine());
    const [carte] = parTestID(root, 'tournament-fiche-my-team');
    expect(textes(carte)).toEqual(['Mon équipe · Capitaine', 'Les Aigles', 'Voir mon équipe']);
  });

  test('🔴 trop jeune : le message dans la carte, aucun bouton, rien en bas', () => {
    const root = monter(LECTEURS.tropJeune());
    const [carte] = parTestID(root, 'tournament-registration-card');
    expect(textes(carte)).toEqual([
      'Ton inscription',
      'Ce tournoi est ouvert à partir de 16 ans',
      'Tu pourras t’inscrire à un prochain tournoi ouvert à ton âge.',
    ]);
    expect(carte.findAllByType(TouchableOpacity)).toHaveLength(0);
    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(0);
  });

  // FICHE-TOURNOI (19/11, 6b) : l'inscription et les conditions vivent dans Aperçu ; l'onglet
  // Équipes ne les monte plus (ni une, ni deux fois).
  test('🔴 inscription et conditions montées une seule fois, dans Aperçu (plus dans l onglet Équipes)', () => {
    const root = monter(LECTEURS.sansEquipe());
    expect(parTestID(root, 'tournament-registration-card')).toHaveLength(1);
    expect(parTestID(root, 'event-tournament-terms-link')).toHaveLength(1);
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'tournament-registration-card')).toHaveLength(0);
    expect(parTestID(root, 'event-tournament-terms-link')).toHaveLength(0);
  });

  test('🔴 l essentiel en cases pour tous les lecteurs', () => {
    Object.values(LECTEURS).forEach((fabrique) => {
      expect(parTestID(monter(fabrique()), 'tournament-essentials')).toHaveLength(1);
    });
  });
});

describe('T-PAGES-4 · point 2 — réservés à l organisateur (A2, R11)', () => {
  test('🔴 carte « TOURNOI », « Compétition en brouillon / Brouillon » et rail : l organisateur seul', () => {
    Object.entries(LECTEURS).forEach(([nom, fabrique]) => {
      const vus = textes(monter(fabrique()));
      const attendu = nom === 'organisateur' ? 1 : 0;
      expect([nom, compter(vus, 'Compétition en brouillon')]).toEqual([nom, attendu]);
      expect([nom, vus.filter((ligne) => ligne === 'Brouillon').length]).toEqual([nom, attendu]);
      expect([nom, compter(vus, 'OÙ EN EST LE TOURNOI')]).toEqual([nom, attendu]);
    });
  });

  test('🔴 le format et le règlement écrit restent aux joueurs (une carte courte)', () => {
    const lecteur = LECTEURS.sansEquipe();
    lecteur.event.tournamentConfig = {
      ...lecteur.event.tournamentConfig, rulesText: 'Matchs de 10 minutes.',
    };
    const root = monter(lecteur);
    const [carte] = parTestID(root, 'tournament-player-rules');
    expect(textes(carte)).toEqual(['Poules + finale', 'À partir de 16 ans', 'Matchs de 10 minutes.']);
  });
});

describe('T-PAGES-4 · point 3 — nombre d équipes, seuil des 30 %, pour tous (« 4- A »)', () => {
  const huitEquipes = () => Array.from({ length: 8 }, (_, index) => ({
    ...LIONS, documentId: `eq-${index}`, name: `Équipe ${index}`,
  }));
  const essentielDe = (/** @type {any} */ root) => textes(
    parTestID(root, 'tournament-essentials')[0],
  ).join(' ');

  test('🔴 connecté sous le seuil (2 sur 24) : « 24 équipes attendues », sans compteur', () => {
    const root = monter(LECTEURS.sansEquipe());
    expect(essentielDe(root)).toContain('24 équipes attendues');
    expect(textes(root).join(' ')).not.toContain('équipes au plus');
    expect(ongletsDe(root)).toEqual(['Aperçu', 'Équipes', 'Personnes']);
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'event-tournament-teams-summary').map(textOf))
      .toEqual(['24 équipes attendues']);
  });

  test('🔴 connecté au seuil (8 sur 24) : « 8 équipes inscrites sur 24 »', () => {
    const lecteur = LECTEURS.sansEquipe();
    lecteur.event.tournamentTeams = huitEquipes();
    expect(essentielDe(monter(lecteur))).toContain('8 équipes inscrites sur 24');
  });

  test('🔴 visiteur : « 24 équipes attendues » dans l essentiel, plus de « Personnes · 0 »', () => {
    const root = monter(LECTEURS.visiteur());
    expect(essentielDe(root)).toContain('24 équipes attendues');
    expect(ongletsDe(root)).toEqual(['Aperçu', 'Équipes', 'Personnes']);
  });

  test('l organisateur garde ses vrais nombres', () => {
    const root = monter(LECTEURS.organisateur());
    expect(ongletsDe(root)).toEqual(['Aperçu', 'Équipes · 2', 'Personnes · 0']);
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'event-tournament-teams-summary').map(textOf))
      .toEqual(['1 validée · 1 en attente']);
  });

  test('le panneau « Rejoindre une équipe » liste toujours les équipes qui cherchent un joueur', () => {
    const root = monter(LECTEURS.sansEquipe());
    const [panneau] = parTestID(root, 'tournament-join-team-panel');
    const [ouvrir] = panneau.findAllByType(TouchableOpacity);
    act(() => {
      ouvrir.props.onPress();
    });
    expect(textes(parTestID(root, 'tournament-join-team-panel')[0])).toContain('Les Aigles');
    expect(textes(root).join(' ')).not.toContain('équipes inscrites sur');
  });
});

describe('T-PAGES-4 · point 4 — retirés pour qui n est pas l organisateur', () => {
  test('🔴 membre : plus de « Ma réponse au tournoi » ; ni « Participer » ni « Validation manuelle »', () => {
    const lecteur = LECTEURS.membre();
    lecteur.event.tournamentTeams = [{
      ...AIGLES,
      members: [{ responseStatus: 'present', user: { documentId: 'membre-1' } }],
    }, LIONS];
    const vus = textes(monter(lecteur));
    expect(compter(vus, 'Ma réponse au tournoi')).toBe(0);
    expect(compter(vus, 'Je suis présent')).toBe(0);
    expect(compter(vus, 'Participer')).toBe(0);
    expect(compter(vus, 'Validation manuelle')).toBe(0);
  });
});

describe('T-PAGES-4 · point 5 — « Rejoindre une équipe » caché à l organisateur', () => {
  test('🔴 organisateur : pas de panneau', () => {
    expect(parTestID(monter(LECTEURS.organisateur()), 'tournament-join-team-panel')).toHaveLength(0);
  });

  test('récolte du train 12 (chef, 17/11) : un gérant qui n organise pas CE tournoi peut rejoindre', () => {
    const gerant = { auth: compte('gerant-1', { peutGerer: true }), event: TOURNOI() };
    expect(parTestID(monter(gerant), 'tournament-join-team-panel')).toHaveLength(1);
  });
});

describe('T-PAGES-4 · point 7 — R11', () => {
  test('🔴 « Créer une équipe » jamais à qui a une équipe (capitaine par captainUser, membre, invité)', () => {
    ['capitaine', 'membre', 'invite'].forEach((nom) => {
      // @ts-ignore: clé du relevé
      const root = monter(LECTEURS[nom]());
      allerSurLOnglet(root, 'tournamentTeams');
      const vus = textes(root);
      expect([nom, parTestID(root, 'tournament-registration-card').length]).toEqual([nom, 0]);
      expect([nom, compter(vus, 'Créer mon équipe')]).toEqual([nom, 0]);
      expect([nom, compter(vus, 'Créer une équipe')]).toEqual([nom, 0]);
    });
  });
});

describe('T-PAGES-4 · point 6 — R10, la feuille « Créer une équipe » du téléphone', () => {
  test('🔴 la feuille dit la suite : « Ensuite : invite 4 joueurs, chacun paie 20 €. »', () => {
    const root = monter(LECTEURS.sansEquipe());
    // Le premier bouton « Créer … » de l'écran (avant : « Créer une équipe pour ce tournoi »).
    const creer = root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ node) => textOf(node).startsWith('Créer'));
    act(() => {
      creer.props.onPress();
    });
    expect(textes(root)).toContain('Ensuite : invite 4 joueurs, chacun paie 20 €.');
  });
});

// ============================================================================================
// SUITE DU CHEF (17/11, réponses 1 et 4) — textes de T-PAGES-3 (« Comment ça marche », « Avant de
// t'inscrire », rôle), itinéraire, paiement et discussion dans « Mon équipe », nombre caché.
// ============================================================================================

describe('T-PAGES-4 · chef 1 — « Comment ça marche », « Avant de t inscrire », rôle, itinéraire', () => {
  test('🔴 sans équipe : les 3 étapes et « Avant de t’inscrire » avec le lien des conditions', () => {
    const root = monter(LECTEURS.sansEquipe());
    expect(textes(parTestID(root, 'tournament-how-it-works')[0])).toEqual([
      'Comment ça marche',
      '1. Tu crées ton équipe',
      'Tu en deviens le capitaine. Elle n’existe que pour ce tournoi.',
      '2. Tu invites 4 joueurs',
      'Par un lien à partager, ou en cherchant leur profil FoundClub.',
      '3. Chacun paie sa place, 20 € par joueur',
      'L’équipe est validée dès la 5ᵉ place payée.',
    ]);
    const [avant] = parTestID(root, 'tournament-before-sign-up');
    expect(textes(avant)).toEqual(expect.arrayContaining([
      'Avant de t’inscrire', 'Lire les conditions d’inscription',
    ]));
  });

  test('🔴 avec une équipe : pas de « Comment ça marche » ; l organisateur garde le lien seul', () => {
    expect(parTestID(monter(LECTEURS.capitaine()), 'tournament-how-it-works')).toHaveLength(0);
    const orga = monter(LECTEURS.organisateur());
    expect(parTestID(orga, 'tournament-before-sign-up')).toHaveLength(0);
    expect(parTestID(orga, 'event-tournament-terms-link')).toHaveLength(1);
  });

  test('🔴 la carte « Ton inscription » dit la règle des places payées', () => {
    const [carte] = parTestID(monter(LECTEURS.sansEquipe()), 'tournament-registration-card');
    expect(textes(carte)).toContain('Ton équipe est validée dès la 5ᵉ place payée.');
  });

  test('🔴 le rôle en surtitre de « Mon équipe » : capitaine, membre, invité', () => {
    const surtitre = (/** @type {any} */ lecteur) => textes(
      parTestID(monter(lecteur), 'tournament-fiche-my-team')[0],
    )[0];
    expect(surtitre(LECTEURS.capitaine())).toBe('Mon équipe · Capitaine');
    expect(surtitre(LECTEURS.membre())).toBe('Mon équipe');
    mockTeamQuery.data = { ...LIONS, members: [] };
    expect(surtitre(LECTEURS.invite())).toBe('Mon équipe · Invitation');
  });

  test('🔴 « Itinéraire » sous le lieu de l essentiel ouvre la carte du téléphone', () => {
    const lecteur = LECTEURS.sansEquipe();
    lecteur.event.location = 'AR Soccer, 119 rue de la Rauze basse, Montpellier';
    const root = monter(lecteur);
    const [lien] = parTestID(root, 'tournament-essentials-itinerary');
    expect(lien).toBeTruthy();
    mockOpenExternalMap.mockClear();
    act(() => {
      lien.props.onPress();
    });
    expect(mockOpenExternalMap).toHaveBeenCalledTimes(1);
  });
});

describe('T-PAGES-4 · chef 1 — « Mon équipe » : payer sa place, discussion de l équipe', () => {
  test('🔴 membre dont la place est due : « Payer ma place » ouvre la page de paiement', () => {
    // eslint-disable-next-line global-require
    const liens = require('@/platform/links').default;
    const ouvrir = jest.spyOn(liens, 'openUrlHere').mockImplementation(() => Promise.resolve());
    mockTeamQuery.data = {
      ...EQUIPE_DETAILLEE,
      payment: {
        ...EQUIPE_DETAILLEE.payment,
        members: [
          { memberDocumentId: 'm-cap', status: 'paid' },
          {
            isSelf: true, memberDocumentId: 'm-2', paymentUrl: 'https://pay.example/m-2', status: 'due',
          },
        ],
      },
    };
    const root = monter(LECTEURS.membre());
    const [payer] = parTestID(root, 'tournament-fiche-my-team-pay')[0].findAllByType(TouchableOpacity);
    act(() => {
      payer.props.onPress();
    });
    expect(ouvrir).toHaveBeenCalledWith('https://pay.example/m-2');
    ouvrir.mockRestore();
  });

  test('🔴 la discussion de l équipe, si le serveur la rend, s ouvre depuis la carte', () => {
    mockTeamQuery.data = { ...EQUIPE_DETAILLEE, discussion: { chat: 'chat-aigles' } };
    const root = monter(LECTEURS.capitaine());
    const [carte] = parTestID(root, 'tournament-fiche-my-team');
    const bouton = carte.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ node) => textOf(node) === 'Discussion de l\'équipe');
    mockNavigate.mockClear();
    act(() => {
      bouton.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', { chatId: 'chat-aigles' });
  });
});

describe('T-PAGES-4 · chef 4 — sous le seuil, le nombre ne se lit nulle part', () => {
  const nomsDesEquipes = (/** @type {any} */ root) => {
    allerSurLOnglet(root, 'tournamentTeams');
    // Les noms rendus hors de la carte « Mon équipe » (qui dit toujours le nom de la sienne).
    const carte = parTestID(root, 'tournament-fiche-my-team')[0];
    const dansLaCarte = carte ? textes(carte) : [];
    return textes(root)
      .filter((ligne) => ['Les Aigles', 'Les Lions'].includes(ligne) || /^Équipe \d+$/.test(ligne))
      .filter((ligne) => {
        // Retire une seule fois chaque nom lu dans la carte.
        const index = dansLaCarte.indexOf(ligne);
        if (index === -1) return true;
        dansLaCarte.splice(index, 1);
        return false;
      });
  };

  // IMPL-1-FICHE (8a) : sous le seuil, la phrase et les deux boutons ; les équipes qui cherchent
  // paraissent après « Rejoindre une équipe ».
  test('🔴 sans équipe, sous le seuil : les équipes qui cherchent, après « Rejoindre une équipe »', () => {
    const root = monter(LECTEURS.sansEquipe());
    expect(nomsDesEquipes(root)).toEqual([]);
    const [seuil] = parTestID(root, 'tournament-teams-threshold');
    const rejoindre = seuil.findAll((/** @type {any} */ n) => n.props?.title === 'Rejoindre une équipe' && typeof n.props?.onPress === 'function')[0];
    act(() => { rejoindre.props.onPress(); });
    expect(nomsDesEquipes(root)).toEqual(['Les Aigles']);
  });

  // IMPL-1-FICHE (8a) : un membre ne demande pas à rejoindre une autre équipe : il lit la sienne.
  test('🔴 membre d une équipe fermée, sous le seuil : la sienne', () => {
    mockTeamQuery.data = null;
    const lecteur = {
      auth: compte('lion-1'),
      event: TOURNOI({
        tournamentTeams: [AIGLES, { ...LIONS, viewerMembership: { responseStatus: 'present' } }],
      }),
    };
    expect(nomsDesEquipes(monter(lecteur))).toEqual(['Les Lions']);
  });

  test('au seuil (8 sur 24) : la liste complète', () => {
    const lecteur = LECTEURS.sansEquipe();
    lecteur.event.tournamentTeams = Array.from({ length: 8 }, (_, index) => ({
      ...LIONS, documentId: `eq-${index}`, name: `Équipe ${index}`,
    }));
    expect(nomsDesEquipes(monter(lecteur))).toHaveLength(8);
  });

  test('l organisateur voit toutes les équipes', () => {
    expect(nomsDesEquipes(monter(LECTEURS.organisateur()))).toEqual(['Les Aigles', 'Les Lions']);
  });
});

// ============================================================================================
// T-PAGES-4b (18/11, nuit automatique, chef) — la finition du téléphone : « Mon équipe » juste
// sous le bandeau, les étiquettes du bandeau, un seul bouton en bas, l'id du tournoi aux
// conditions.
// ============================================================================================

// La discussion de l'événement, posée entre l'en-tête et « Mon équipe » avant ce lot.
jest.mock('../components/EventChatRow', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventChatRowDouble() {
    return react.createElement(rn.View, { testID: 'event-chat-row' });
  };
});

const ORDRE_4B = ['tournament-fiche-my-team', 'event-chat-row', 'tournament-essentials'];
const ordreDuHaut = (/** @type {any} */ root) => [...new Set(root
  .findAll((/** @type {any} */ node) => ORDRE_4B.includes(node.props?.testID)
    || (node.type === Text && textOf(node) === 'DOUBLURE_EventHeader'), { deep: true })
  .map((/** @type {any} */ node) => node.props?.testID || 'en-tete'))];

const proprietesDeLEnTete = (/** @type {any} */ root) => root
  .findAll((/** @type {any} */ node) => node.type?.name === 'TextDouble'
    && node.findAllByType(Text).some((texte) => textOf(texte) === 'DOUBLURE_EventHeader'))
  .pop()?.props;

describe('T-PAGES-4b · 1 — « Mon équipe » vient juste sous le bandeau (maquette b)', () => {
  test('🔴 capitaine, membre, invité : en-tête, « Mon équipe », la discussion, puis l essentiel', () => {
    mockTeamQuery.data = null;
    ['capitaine', 'membre', 'invite'].forEach((qui) => {
      expect(ordreDuHaut(monter(LECTEURS[qui]()))).toEqual([
        'en-tete', 'tournament-fiche-my-team', 'event-chat-row', 'tournament-essentials',
      ]);
    });
  });

  test('sans équipe : pas de « Mon équipe », l essentiel après la discussion (inchangé)', () => {
    expect(ordreDuHaut(monter(LECTEURS.sansEquipe()))).toEqual([
      'en-tete', 'event-chat-row', 'tournament-essentials',
    ]);
  });
});

describe('T-PAGES-4b · 2 — l en-tête passe en bandeau, avec l étiquette du lecteur', () => {
  test('🔴 capitaine et membre : « Ton équipe est inscrite »', () => {
    mockTeamQuery.data = null;
    ['capitaine', 'membre'].forEach((qui) => {
      expect(proprietesDeLEnTete(monter(LECTEURS[qui]())).tournamentHero)
        .toEqual({ statusLabel: 'Ton équipe est inscrite' });
    });
  });

  test('🔴 sans équipe, invité, visiteur : « Inscriptions ouvertes » avant la publication', () => {
    mockTeamQuery.data = null;
    ['sansEquipe', 'invite', 'visiteur', 'tropJeune'].forEach((qui) => {
      expect(proprietesDeLEnTete(monter(LECTEURS[qui]())).tournamentHero)
        .toEqual({ statusLabel: 'Inscriptions ouvertes' });
    });
  });

  // T-SUITES-TOURNOI (18/11, point 9) : l'organisateur seul garde la pastille du terrain.
  test('🔴 organisateur : « Inscriptions ouvertes », et la pastille du terrain (showFacility)', () => {
    mockTeamQuery.data = null;
    expect(proprietesDeLEnTete(monter(LECTEURS.organisateur())).tournamentHero)
      .toEqual({ showFacility: true, statusLabel: 'Inscriptions ouvertes' });
  });

  test('🔴 compétition publiée : plus d étiquette de statut', () => {
    const lecteur = LECTEURS.sansEquipe();
    lecteur.event.tournamentConfig = { ...lecteur.event.tournamentConfig, competitionState: 'published' };
    expect(proprietesDeLEnTete(monter(lecteur)).tournamentHero).toEqual({ statusLabel: null });
  });
});

describe('T-PAGES-4b · 3 — en bas, un seul bouton, celui du lecteur', () => {
  test('chaque lecteur : un bouton et un seul dans la barre collée', () => {
    mockTeamQuery.data = null;
    const attendus = {
      capitaine: 'Voir mon équipe',
      invite: 'Répondre à mon invitation',
      membre: 'Voir mon équipe',
      organisateur: 'Gérer le tournoi',
      sansEquipe: 'Créer mon équipe',
      visiteur: 'Créer mon équipe',
    };
    Object.entries(attendus).forEach(([qui, titre]) => {
      const [barre] = parTestID(monter(LECTEURS[qui]()), 'tournament-bottom-bar');
      const boutons = barre.findAllByType(TouchableOpacity);
      expect([qui, boutons.length, textOf(boutons[0])]).toEqual([qui, 1, titre]);
    });
  });
});

describe('T-PAGES-4b · 4 — « Lire les conditions » passe l id du tournoi', () => {
  test('🔴 joueur (« Avant de t inscrire ») et organisateur : openTournamentTerms(« event-1 »)', () => {
    // eslint-disable-next-line global-require
    const conditions = require('../components/tournamentTerms');
    const ouvrir = jest.spyOn(conditions, 'openTournamentTerms').mockImplementation(() => undefined);
    const appuyer = (/** @type {any} */ root, /** @type {string} */ id) => {
      const [bloc] = parTestID(root, id);
      const bouton = bloc.findAllByType(TouchableOpacity)
        .find((/** @type {any} */ node) => /conditions/i.test(textOf(node)));
      act(() => {
        bouton.props.onPress({ nativeEvent: {} });
      });
    };
    appuyer(monter(LECTEURS.sansEquipe()), 'tournament-before-sign-up');
    appuyer(monter(LECTEURS.organisateur()), 'event-tournament-terms-link');
    expect(ouvrir.mock.calls).toEqual([['event-1'], ['event-1']]);
    ouvrir.mockRestore();
  });
});

describe('T-PAGES-4b · 5 — le visiteur sans compte : « Créer mon équipe », comme le site (R7)', () => {
  const ATTENDU_CONNEXION = {
    params: { origin: 'EventDetails', source: 'event-details-tournament-register' },
    screen: 'Login',
  };

  test('🔴 la carte « Ton inscription » : « Créer mon équipe », puis « J’ai déjà un compte »', () => {
    const [carte] = parTestID(monter(LECTEURS.visiteur()), 'tournament-registration-card');
    expect(carte).toBeTruthy();
    expect(textes(carte)).toEqual([
      'Ton inscription',
      'Inscris ton équipe',
      '20 € par joueur',
      'Ton équipe est validée dès la 5ᵉ place payée.',
      'Créer mon équipe',
      'J’ai déjà un compte',
    ]);
  });

  test('🔴 chacun des deux range le tournoi et ouvre la connexion', () => {
    // eslint-disable-next-line global-require
    const { prendreLeRetourAuTournoi } = require('@/navigation/retourAuTournoi');
    ['Créer mon équipe', 'J’ai déjà un compte'].forEach((titre) => {
      prendreLeRetourAuTournoi();
      mockNavigate.mockClear();
      const [carte] = parTestID(monter(LECTEURS.visiteur()), 'tournament-registration-card');
      const bouton = carte.findAllByType(TouchableOpacity)
        .find((/** @type {any} */ node) => textOf(node) === titre);
      act(() => {
        bouton.props.onPress();
      });
      expect([titre, mockNavigate.mock.calls]).toEqual([titre, [['PublicAuthStack', ATTENDU_CONNEXION]]]);
      expect(prendreLeRetourAuTournoi()).toBe('event-1');
    });
  });

  // Récolte du train 13 (chef « A », 18/11) : les deux boutons retiennent aussi l inscription
  // (T-PAGES-6b), que l écran du numéro et celui du rôle rappellent.
  test('🔴 chacun des deux retient l inscription au tournoi pour l écran du rôle', () => {
    // eslint-disable-next-line global-require
    const { lireLInscriptionAuTournoi, oublierLInscriptionAuTournoi } = require('@/domains/tournoi/inscriptionEnCours');
    ['Créer mon équipe', 'J’ai déjà un compte'].forEach((titre) => {
      oublierLInscriptionAuTournoi();
      const [carte] = parTestID(monter(LECTEURS.visiteur()), 'tournament-registration-card');
      const bouton = carte.findAllByType(TouchableOpacity)
        .find((/** @type {any} */ node) => textOf(node) === titre);
      act(() => {
        bouton.props.onPress();
      });
      expect([titre, lireLInscriptionAuTournoi()?.eventId]).toEqual([titre, 'event-1']);
    });
    oublierLInscriptionAuTournoi();
  });

  test('🔴 la barre du bas : « 20 € par joueur », « Créer mon équipe »', () => {
    expect(barreDe(monter(LECTEURS.visiteur()))).toEqual(['20 € par joueur', 'Créer mon équipe']);
  });

  test('tournoi publié ou clos : le visiteur garde « Se connecter pour s inscrire » / « Voir le tournoi »', () => {
    const publie = LECTEURS.visiteur();
    publie.event.tournamentConfig = { ...publie.event.tournamentConfig, competitionState: 'published' };
    const root = monter(publie);
    expect(barreDe(root)).toEqual(["Se connecter pour s'inscrire"]);
    expect(parTestID(root, 'tournament-registration-card')).toHaveLength(0);
  });
});

// T-SUITES-TOURNOI (18/11, point 11 ; recapture Android, recette 46, organisateur 222) : l'onglet
// disait « Équipes · 7 » quand la liste montrait 1 validée et 5 en attente, et le pilotage 6 : la fiche
// comptait l'équipe REFUSÉE. Même règle que le pilotage (getTournamentRegisteredTeamsCount) : en
// attente + validées, sans les archivées ni les refusées.
describe('T-SUITES (11) — le compteur d équipes de la fiche suit la règle du pilotage', () => {
  test('🔴 organisateur : 1 validée, 5 en attente, 1 refusée, 1 archivée => « Équipes · 6 »', () => {
    const equipe = (/** @type {number} */ n, /** @type {string} */ status, extra = {}) => ({
      documentId: `eq-${n}`, members: [], name: `Équipe ${n}`, status, ...extra,
    });
    const root = monter({
      auth: compte('orga-1', { peutGerer: true }),
      event: TOURNOI({
        organizer: { documentId: 'orga-1' },
        tournamentTeams: [
          equipe(1, 'accepted'), equipe(2, 'pending'), equipe(3, 'pending'), equipe(4, 'pending'),
          equipe(5, 'pending'), equipe(6, 'pending'), equipe(7, 'declined'),
          equipe(8, 'pending', { archivedAt: '2026-11-10T10:00:00.000Z' }),
        ],
      }),
    });
    const onglet = ongletsDe(root).find((libelle) => libelle.startsWith('Équipes'));
    expect(onglet).toMatch(/^Équipes\D*6$/);
  });
});

// IMPL-1-FICHE (18/11, pack T-DESIGN-TOURNOI, écran 11a) — L'ORGANISATEUR QUI JOUE AUSSI : sous
// le bandeau, deux boutons côte à côte, « Gérer le tournoi » et « Mon équipe », puis la carte « Mon
// équipe · capitaine ». Avant, « Gérer le tournoi » (bas) cachait son équipe : il devait la
// retrouver dans l'onglet. Le bas ne redit pas les deux boutons.
describe('IMPL-1 · 11a — l organisateur qui joue : « Gérer le tournoi » et « Mon équipe »', () => {
  const organisateurQuiJoue = () => ({
    auth: compte('orga-1', { peutGerer: true }),
    event: TOURNOI({
      organizer: { documentId: 'orga-1' },
      tournamentTeams: [{ ...AIGLES, captainUser: { documentId: 'orga-1', firstname: 'Adel', lastname: 'F' } }, LIONS],
    }),
  });

  test('🔴 les deux boutons côte à côte, puis la carte de son équipe ; plus de barre du bas', () => {
    mockTeamQuery.data = null;
    const root = monter(organisateurQuiJoue());
    const [rangee] = parTestID(root, 'tournament-organizer-player-actions');
    expect(rangee).toBeDefined();
    expect(textes(rangee)).toEqual(['Gérer le tournoi', 'Mon équipe']);
    expect(parTestID(root, 'tournament-fiche-my-team')).toHaveLength(1);
    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(0);
  });

  test('🔴 « Mon équipe » ouvre sa page d équipe, « Gérer le tournoi » le pilotage', () => {
    mockTeamQuery.data = null;
    mockNavigate.mockClear();
    const root = monter(organisateurQuiJoue());
    const [rangee] = parTestID(root, 'tournament-organizer-player-actions');
    const boutons = rangee.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function' && n.props?.title);
    const [gerer, equipe] = boutons;
    act(() => { equipe.props.onPress(); });
    expect(JSON.stringify(mockNavigate.mock.calls)).toContain('eq-aigles');
    act(() => { gerer.props.onPress(); });
    expect(mockNavigate.mock.calls.length).toBe(2);
  });

  test('l organisateur sans équipe garde son bas « Gérer le tournoi », sans les deux boutons', () => {
    const root = monter(LECTEURS.organisateur());
    expect(parTestID(root, 'tournament-organizer-player-actions')).toHaveLength(0);
    expect(textes(parTestID(root, 'tournament-bottom-bar')[0]).join(' | ')).toBe('Gérer le tournoi');
  });
});

// IMPL-1-FICHE (18/11, pack T-DESIGN-TOURNOI, page 8) — l'onglet Équipes de la maquette pour qui
// n'organise pas le tournoi ; l'organisateur garde ses cartes de pilotage.
describe('IMPL-1 · 8 — l onglet Équipes de la maquette', () => {
  test('🔴 sans équipe, sous le seuil : « Les équipes s’affichent dès 8 inscrites »', () => {
    const root = monter(LECTEURS.sansEquipe());
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'tournament-teams-public')).toHaveLength(1);
    expect(textes(parTestID(root, 'tournament-teams-threshold')[0])[0]).toBe('Les équipes s’affichent dès 8 inscrites');
  });

  test('🔴 plus de « Équipe éphémère » pour le joueur', () => {
    const root = monter(LECTEURS.membre());
    allerSurLOnglet(root, 'tournamentTeams');
    expect(textes(root).join(' | ')).not.toContain('Équipe éphémère');
  });

  test('l organisateur garde ses cartes de pilotage, sans l onglet de la maquette', () => {
    const root = monter(LECTEURS.organisateur());
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'tournament-teams-public')).toHaveLength(0);
  });
});

// IMPL-1-FICHE × IMPL-3 (chef, 18/11) — INSCRIPTIONS FERMÉES (`tournamentConfig.registrationsClosed`
// === true ; absent = ouvertes) : la pastille « Inscriptions fermées » en jaune ; plus de « Créer
// mon équipe » ni de « Rejoindre une équipe » pour un joueur sans équipe ; qui a une équipe garde
// « Voir mon équipe » et ses gestes.
describe('IMPL-1 × IMPL-3 — inscriptions fermées', () => {
  const fermer = (/** @type {any} */ lecteur) => ({
    ...lecteur,
    event: { ...lecteur.event, tournamentConfig: { ...lecteur.event.tournamentConfig, registrationsClosed: true } },
  });

  test('🔴 sans équipe : « Inscriptions fermées » (jaune), ni inscription ni « Rejoindre », pas de « Créer mon équipe » en bas', () => {
    mockTeamQuery.data = null;
    const root = monter(fermer(LECTEURS.sansEquipe()));
    expect(proprietesDeLEnTete(root).tournamentHero).toEqual({ statusLabel: 'Inscriptions fermées', statusTone: 'warning' });
    expect(parTestID(root, 'tournament-registration-card')).toHaveLength(0);
    expect(parTestID(root, 'tournament-join-team-panel')).toHaveLength(0);
    expect((barreDe(root) || []).join(' | ')).not.toContain('Créer mon équipe');
  });

  test('🔴 visiteur : plus de « Créer mon équipe » ni de « Se connecter pour s inscrire »', () => {
    const root = monter(fermer(LECTEURS.visiteur()));
    const bas = (barreDe(root) || []).join(' | ');
    expect(bas).not.toContain('Créer mon équipe');
    expect(bas).not.toContain('Se connecter pour s');
  });

  test('🔴 capitaine : « Ton équipe est inscrite », sa carte et « Voir mon équipe » restent', () => {
    mockTeamQuery.data = null;
    const root = monter(fermer(LECTEURS.capitaine()));
    expect(proprietesDeLEnTete(root).tournamentHero).toEqual({ statusLabel: 'Ton équipe est inscrite' });
    expect(parTestID(root, 'tournament-fiche-my-team')).toHaveLength(1);
    expect(barreDe(root)).toEqual(['Voir mon équipe']);
  });

  test('absent : ouvertes, comme avant', () => {
    mockTeamQuery.data = null;
    expect(proprietesDeLEnTete(monter(LECTEURS.sansEquipe())).tournamentHero).toEqual({ statusLabel: 'Inscriptions ouvertes' });
  });
});

// ============================================================================================
// FICHE-TOURNOI (19/11/2026, liste de travail d'Adel, écrans 6b, 9f, 8a, 8b) — la fiche au
// téléphone : « Partager » en haut à droite et « Signaler » dans un menu ; les onglets juste sous
// le bandeau (et « Mon équipe ») ; les blocs d'inscription dans Aperçu ; les compteurs d'équipes.
// ============================================================================================
const chercherElement = (/** @type {any} */ element, /** @type {(n: any) => boolean} */ predicat) => {
  if (!element || typeof element !== 'object') return null;
  if (Array.isArray(element)) {
    return element.reduce((/** @type {any} */ trouve, /** @type {any} */ enfant) => trouve || chercherElement(enfant, predicat), null);
  }
  if (element.props && predicat(element)) return element;
  return chercherElement(element.props?.children, predicat);
};
const enteteDroite = () => {
  const appels = mockSetOptions.mock.calls.filter((/** @type {any} */ appel) => appel[0]?.headerRight);
  return appels[appels.length - 1][0].headerRight();
};
const doublureDe = (/** @type {any} */ root, /** @type {string} */ nom) => root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'function' && n.type.name === 'TextDouble'
    && n.findAllByType(Text).some((/** @type {any} */ t) => t.props.children === nom),
)[0];
const ordreDes = (/** @type {any} */ root, /** @type {string[]} */ ids) => root
  .findAll((/** @type {any} */ n) => ids.includes(n.props?.testID), { deep: true })
  .map((/** @type {any} */ n) => n.props.testID)
  .filter((/** @type {string} */ id, /** @type {number} */ i, /** @type {string[]} */ liste) => liste.indexOf(id) === i);

describe('FICHE-TOURNOI · 6b — « Partager » en haut à droite, « Signaler » dans un menu', () => {
  test('🔴 joueur sans équipe : « Partager » et « ⋯ », plus de drapeau ; « Partager » ouvre la feuille de partage', () => {
    const root = monter(LECTEURS.sansEquipe());
    const entete = enteteDroite();
    expect(chercherElement(entete, (n) => n.props.icon === 'flag')).toBeNull();
    const partager = chercherElement(entete, (n) => n.props.icon === 'share');
    expect(partager?.props.accessibilityLabel).toBe('Partager');
    expect(chercherElement(entete, (n) => n.props.testID === 'event-actions-menu-button')).toBeTruthy();
    act(() => { partager.props.onPress(); });
    const feuille = root.findAll((/** @type {any} */ n) => typeof n.props?.onSelectChat === 'function' && 'isVisible' in n.props)[0];
    expect(feuille.props.isVisible).toBe(true);
  });

  test('🔴 « ⋯ » ouvre « Plus d’actions » avec « Signaler l’événement », qui ouvre la feuille de signalement', () => {
    const root = monter(LECTEURS.sansEquipe());
    act(() => { chercherElement(enteteDroite(), (n) => n.props.testID === 'event-actions-menu-button').props.onPress(); });
    expect(textes(root)).toContain('Plus d’actions');
    expect(parTestID(root, 'event-manage-chip')).toHaveLength(0);
    const [rangee] = parTestID(root, 'event-menu-report');
    expect(textes(rangee)).toContain('Signaler l’événement');
    act(() => { rangee.findAllByType(TouchableOpacity)[0].props.onPress(); });
    expect(doublureDe(root, 'DOUBLURE_ReportEventModal').props.isVisible).toBe(true);
  });

  test('🔴 organisateur : la feuille « Gérer l’événement » garde ses actions, « Signaler » en dernier', () => {
    const root = monter(LECTEURS.organisateur());
    act(() => { chercherElement(enteteDroite(), (n) => n.props.testID === 'event-actions-menu-button').props.onPress(); });
    expect(textes(root).join(' | ')).toMatch(/Gérer l.événement/);
    expect(parTestID(root, 'event-manage-chip').length).toBeGreaterThan(0);
    expect(parTestID(root, 'event-menu-report')).toHaveLength(1);
  });
});

describe('FICHE-TOURNOI · 6b / 9f — les onglets juste sous le bandeau, les blocs dans Aperçu', () => {
  test('🔴 sans équipe : les onglets avant l essentiel, l inscription, « Rejoindre », « Comment ça marche »', () => {
    const root = monter(LECTEURS.sansEquipe());
    expect(ordreDes(root, ['doublure-onglets', 'tournament-essentials', 'tournament-registration-card', 'tournament-join-team-panel']))
      .toEqual(['doublure-onglets', 'tournament-essentials', 'tournament-registration-card', 'tournament-join-team-panel']);
    const lu = textes(root);
    expect(lu.indexOf('Aperçu')).toBeLessThan(lu.indexOf('Comment ça marche'));
  });

  test('🔴 capitaine : « Mon équipe » d abord, puis les onglets', () => {
    const root = monter(LECTEURS.capitaine());
    expect(ordreDes(root, ['tournament-fiche-my-team-progress', 'doublure-onglets', 'tournament-essentials']))
      .toEqual(['tournament-fiche-my-team-progress', 'doublure-onglets', 'tournament-essentials']);
  });

  test('🔴 onglet Équipes : la liste tout de suite, sans l essentiel ni les blocs d inscription', () => {
    const root = monter(LECTEURS.sansEquipe());
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'tournament-essentials')).toHaveLength(0);
    expect(parTestID(root, 'tournament-registration-card')).toHaveLength(0);
    expect(parTestID(root, 'tournament-join-team-panel')).toHaveLength(0);
    expect(textes(root)).not.toContain('Comment ça marche');
    expect(parTestID(root, 'tournament-teams-public')).toHaveLength(1);
  });
});

describe('FICHE-TOURNOI · 8b — « Équipes · N » et « N équipes inscrites · M places libres »', () => {
  const auSeuil = () => ({ auth: compte('joueur-seul'), event: TOURNOI({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 9 } }) });

  test('🔴 au seuil des 30 % : l onglet compte les équipes, la tête dit les places libres', () => {
    const root = monter(auSeuil());
    expect(ongletsDe(root)).toEqual(['Aperçu', 'Équipes · 9', 'Personnes']);
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'event-tournament-teams-summary').map(textOf)).toEqual(['9 équipes inscrites · 15 places libres']);
  });

  test('sous le seuil (« 4- A ») : ni compte sur l onglet, ni places libres', () => {
    const root = monter(LECTEURS.sansEquipe());
    expect(ongletsDe(root)).toEqual(['Aperçu', 'Équipes', 'Personnes']);
  });
});

describe('FICHE-TOURNOI · 8a — « Rejoindre une équipe » du visiteur, dans le bloc du seuil', () => {
  test('🔴 visiteur : le bouton est dans le bloc et ouvre la connexion du tournoi', () => {
    const root = monter(LECTEURS.visiteur());
    allerSurLOnglet(root, 'tournamentTeams');
    const [bloc] = parTestID(root, 'tournament-teams-threshold');
    const bouton = bloc.findAllByType(TouchableOpacity).find((/** @type {any} */ n) => textOf(n) === 'Rejoindre une équipe');
    expect(bouton).toBeTruthy();
    mockNavigate.mockClear();
    act(() => { bouton.props.onPress(); });
    expect(mockNavigate.mock.calls[0]?.[0]).toBe('PublicAuthStack');
  });

  test('visiteur, inscriptions fermées : pas de bouton', () => {
    const lecteur = LECTEURS.visiteur();
    lecteur.event.tournamentConfig = { ...lecteur.event.tournamentConfig, registrationsClosed: true };
    const root = monter(lecteur);
    allerSurLOnglet(root, 'tournamentTeams');
    expect(textes(root)).not.toContain('Rejoindre une équipe');
  });
});
