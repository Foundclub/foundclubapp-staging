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
  organisateur: () => ({ auth: compte('orga-1', { peutGerer: true }), event: TOURNOI() }),
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
    carteMonEquipe: parTestID(root, 'tournament-team-progress').length,
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
    barreDuBas: 'Gérer mon équipe inscrite',
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 2,
    conditions: 1,
    creerUneEquipe: 1,
    essentiel: 0,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      conditions: 2,
      creerUneEquipe: 2,
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
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  invite: {
    barreDuBas: 'Répondre à mon invitation',
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 2,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 0,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      conditions: 2,
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
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  membre: {
    barreDuBas: 'Voir mon équipe inscrite',
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 2,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 0,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      conditions: 2,
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
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  organisateur: {
    barreDuBas: 'Gérer le tournoi',
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 2,
    conditions: 1,
    creerUneEquipe: 1,
    essentiel: 0,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      conditions: 2,
      creerUneEquipe: 2,
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
    rejoindre: 1,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  sansEquipe: {
    barreDuBas: 'Voir le tournoi',
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 2,
    conditions: 1,
    creerUneEquipe: 1,
    essentiel: 0,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      conditions: 2,
      creerUneEquipe: 2,
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
    rail: 0,
    rejoindre: 1,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  tropJeune: {
    barreDuBas: 'Voir le tournoi',
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 2,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 0,
    inscrireEquipeDuClub: 0,
    messageAge: 1,
    ongletEquipes: {
      aucuneEquipe: 0,
      conditions: 2,
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
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
  visiteur: {
    barreDuBas: "Se connecter pour s'inscrire",
    brouillon: 1,
    carteMonEquipe: 0,
    carteTournoi: 2,
    conditions: 1,
    creerUneEquipe: 0,
    essentiel: 0,
    inscrireEquipeDuClub: 0,
    messageAge: 0,
    ongletEquipes: {
      aucuneEquipe: 0,
      conditions: 2,
      creerUneEquipe: 0,
      resume: [
        '24 équipes attendues',
      ],
    },
    onglets: [
      'Aperçu',
      'Équipes',
      'Personnes · 0',
    ],
    participer: 0,
    rail: 0,
    rejoindre: 0,
    reponseAuTournoi: 0,
    validationManuelle: 0,
  },
};

// État d'avant : a671bf518.
describe('T-PAGES-4 · point 0 — ce que chaque lecteur voit (caractérisant)', () => {
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
    expect(ordreDe(root)).toEqual([
      'tournament-essentials',
      'tournament-registration-card',
      'tournament-join-team-panel',
      'event-tournament-terms-link',
      'doublure-onglets',
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
    expect(ordreDe(root)).toEqual([
      'tournament-fiche-my-team',
      'tournament-essentials',
      'event-tournament-terms-link',
      'doublure-onglets',
    ]);
    const [carte] = parTestID(root, 'tournament-fiche-my-team');
    expect(textes(carte)).toEqual(expect.arrayContaining(['Les Aigles', 'Voir mon équipe', '1 / 5']));
    expect(parTestID(root, 'tournament-team-progress-todo')).toHaveLength(1);
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
    expect(textes(carte)).toEqual(['Les Aigles', 'Voir mon équipe']);
  });

  test('🔴 trop jeune : le message dans la carte, aucun bouton, rien en bas', () => {
    const root = monter(LECTEURS.tropJeune());
    const [carte] = parTestID(root, 'tournament-registration-card');
    expect(textes(carte)).toEqual(['Ton inscription', 'Ce tournoi est ouvert à partir de 16 ans.']);
    expect(carte.findAllByType(TouchableOpacity)).toHaveLength(0);
    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(0);
  });

  test('🔴 inscription et conditions montées une seule fois (plus dans l onglet Équipes)', () => {
    const root = monter(LECTEURS.sansEquipe());
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'tournament-registration-card')).toHaveLength(1);
    expect(parTestID(root, 'event-tournament-terms-link')).toHaveLength(1);
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
    expect(textes(carte)).toEqual(['Poules + finale', 'Matchs de 10 minutes.']);
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
    expect(ongletsDe(root)).toEqual(['Aperçu', 'Équipes', 'Personnes · 0']);
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
