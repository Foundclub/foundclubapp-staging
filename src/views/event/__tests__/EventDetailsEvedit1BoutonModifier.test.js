import { Alert, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// EVEDIT-1 / D3 — LE BOUTON « MODIFIER » NE DOIT PLUS OUVRIR SUR UN MUR.
//
// 🧱 LE DEFAUT, TEL QU'IL SE VIT (audit du 2026-08-26) : sur un STAGE ou un
// TOURNOI, le bouton « Modifier » s'affiche, l'ecran s'ouvre, DEUX lectures de
// prechargement partent pour rien, le formulaire se remplit, on peut tout
// saisir — et « Enregistrer » est GRIS. Le refus n'arrive qu'a la fin, sous la
// forme d'un bandeau au milieu du formulaire.
//
// 🔑 LE REMEDE, ET IL TIENT EN UNE PHRASE : le refus (`getEventEditSupport`)
// se consulte LA OU LE BOUTON SE DECIDE, pas a la fin du parcours.
//
// ⚠️ CE QUE CE LOT NE FAIT PAS, ET C'EST DELIBERE : le bouton ne DISPARAIT
// pas. Un bouton qui s'evapore sans explication serait un deuxieme defaut —
// la personne chercherait ce qu'elle a perdu. Il reste, et il DIT pourquoi
// c'est ferme.
//
// ⛔ CE QUI NE BOUGE PAS D'UN POUCE : un entrainement, un match, une detection
// ouvrent exactement comme avant, prechargement compris. Le temoin
// `EventDetailsR5FeuilleEtPrechargement.test.js` garde ce chemin-la ; celui-ci
// garde qu'on ne l'a pas casse en fermant les deux autres.
//
// 🔧 LA DETECTION RESTE OUVERTE, ET CE N'EST PAS UN OUBLI : son garde-fou lit
// un champ (`detectionSlots`) que le serveur ne renvoie pas. C'est le defaut
// D9 de l'audit, il touche la projection SERVEUR et il n'est PAS dans ce lot.
// Le temoin l'epingle pour que personne ne croie l'avoir corrige ici.
//
// Le montage est celui, eprouve, de `EventDetailsR5FeuilleEtPrechargement.test.js`,
// mocks compris.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockPerfMark = jest.fn();
const mockCancelEventMutate = jest.fn();
const mockPrefetch = jest.fn();
/** @type {any[]} */
const mockFeuillesRendues = [];
const mockEventQuery = { data: null };
const mockTeamCompositionQuery = { data: null };

// 🧨 CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService` importe
// `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent — et
// `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute.
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    candidateId: '',
    canInvite: false,
    reason: 'missing-team',
  }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

// ⛔ Jamais un Proxy pour le theme : il rend les echecs Jest illisibles.
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
    prefetchQuery: mockPrefetch,
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
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => ({ ...emptyQuery(), data: mockTeamCompositionQuery.data }),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
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
  getEventByIdForEdit: jest.fn(() => Promise.resolve({ documentId: 'event-1' })),
  getEventTypes: jest.fn(() => Promise.resolve([])),
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
  markEventDetailsPerf: (/** @type {any} */ ...args) => mockPerfMark(...args),
}));

jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: idleMutation(),
      bookFullMutation: idleMutation(),
      cancelEventMutation: { isPending: false, mutate: mockCancelEventMutate },
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
        accessibilityLabel: props.accessibilityLabel,
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
    mockFeuillesRendues.push(props);
    return react.createElement(rn.View, null, props.children);
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
  '../components/EventParticipants',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventParticipants'),
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

// 🎛️ `SegmentedControl` importe `react-native-gesture-handler`, dont un fichier
// n'est PAS couvert par le `transformIgnorePatterns` du depot : sans doublure,
// la SUITE ENTIERE meurt au chargement et AUCUN test ne s'execute.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      { testID: 'doublure-onglets' },
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

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

// Le premier montage transpile tout le graphe d'imports de l'ecran :
// au-dela des 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '10:00',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' },
  type: { name: 'Entrainement' },
  ...overrides,
});

const defaultAuth = (/** @type {any} */ overrides = {}) => ({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: 'user-1', role: { name: 'Joueur' } },
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockUseAuth.mockReturnValue(defaultAuth(auth));

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
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

/**
 * Le pressable d'une rangee du menu, atteint par la CLEF de son libelle puis
 * remonte jusqu'au `TouchableOpacity` qui le porte.
 * @param {any} root - Racine du rendu.
 * @param {string} cle - La cle de la rangee.
 * @returns {any} - Le pressable, ou null.
 */
const rangeeDuMenu = (/** @type {any} */ root, /** @type {string} */ cle) => {
  const [etiquette] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `event-manage-label-${cle}`,
    { deep: false },
  );
  let noeud = etiquette ? etiquette.parent : null;
  while (noeud && noeud.type !== TouchableOpacity) noeud = noeud.parent;

  return noeud;
};

/**
 * Cherche un element dans un arbre NON MONTE, par predicat sur ses props.
 * @param {any} element - Racine de l'arbre d'elements.
 * @param {any} predicat - Le test applique a chaque noeud.
 * @returns {any} - Le premier element qui satisfait le predicat, ou null.
 */
const chercherDansElements = (element, predicat) => {
  if (!element || typeof element !== 'object') return null;
  if (Array.isArray(element)) {
    return element.reduce(
      (/** @type {any} */ trouve, /** @type {any} */ enfant) => (
        trouve || chercherDansElements(enfant, predicat)
      ),
      null,
    );
  }
  if (element.props && predicat(element)) return element;
  return chercherDansElements(element.props?.children, predicat);
};

/**
 * Le ⋯ de la barre du haut, ou null s'il n'y a rien a gerer.
 * @returns {any} - L'element du bouton, ou null.
 */
const boutonDeGestion = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  if (!appels.length) return null;
  return chercherDansElements(
    appels[appels.length - 1][0].headerRight(),
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
  );
};

/**
 * Monte l'ecran vu par un organisateur sur cet evenement, et ouvre son menu.
 * @param {any} evenement - L'evenement affiche.
 * @returns {any} - La racine du rendu.
 */
const monterEtOuvrirLeMenu = (evenement) => {
  const root = mountScreen({
    auth: {
      canEditEvent: () => true,
      canManageEvent: () => true,
      userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
    },
    event: evenement,
  });
  const bouton = boutonDeGestion();
  if (bouton) {
    act(() => {
      bouton.props.onPress();
    });
  }

  return root;
};

/**
 * Ouvre le menu de cet evenement et appuie sur « Modifier ».
 * @param {any} evenement - L'evenement affiche.
 * @returns {void}
 */
const toucherModifier = (evenement) => {
  const root = monterEtOuvrirLeMenu(evenement);
  const rangee = rangeeDuMenu(root, 'edit');
  if (!rangee) throw new Error('La rangee « Modifier » est introuvable');
  act(() => {
    rangee.props.onPress();
  });
};

const STAGE = () => buildEvent({ eventFormat: 'stage_parent', type: { name: 'Stage' } });
const TOURNOI = () => buildEvent({ name: 'Tournoi de printemps', type: { name: 'Tournoi' } });
const DETECTION = () => buildEvent({ type: { name: 'Detection' } });

/** @type {any} */
let alerte = null;

beforeEach(() => {
  mockPrefetch.mockClear();
  mockNavigate.mockClear();
  mockSetOptions.mockClear();
  mockFeuillesRendues.length = 0;
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  mounted = null;
  if (alerte) alerte.mockRestore();
  alerte = null;
});

describe('D3 — un STAGE n ouvre plus un formulaire mort', () => {
  test('le bouton « Modifier » est TOUJOURS la — il ne disparait pas', () => {
    const root = monterEtOuvrirLeMenu(STAGE());

    // ⛔ Un bouton qui s'evapore sans explication serait un DEUXIEME defaut.
    expect(rangeeDuMenu(root, 'edit')).not.toBeNull();
  });

  test('mais il DIT pourquoi c est ferme, au lieu d ouvrir', () => {
    toucherModifier(STAGE());

    expect(alerte).toHaveBeenCalled();
    const dits = alerte.mock.calls.map((/** @type {any} */ a) => a.join(' ')).join(' | ');
    // 🎯 Le motif exact que porte `getEventEditSupport`, pas un « non » nu.
    expect(dits).toMatch(/stage/i);
  });

  test('et l ecran de modification ne s ouvre PAS', () => {
    toucherModifier(STAGE());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // 🥈 LE GAIN DE VITESSE DE D3, et il est gratuit : deux lectures reseau qui
  // partaient pour remplir un formulaire qu'on allait refuser.
  test('et les DEUX lectures de prechargement ne partent plus pour rien', () => {
    toucherModifier(STAGE());

    expect(mockPrefetch).not.toHaveBeenCalled();
  });
});

describe('D3 — un TOURNOI se comporte pareil', () => {
  test('le bouton reste, il explique, et il n ouvre rien', () => {
    toucherModifier(TOURNOI());

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPrefetch).not.toHaveBeenCalled();
    const dits = alerte.mock.calls.map((/** @type {any} */ a) => a.join(' ')).join(' | ');
    expect(dits).toMatch(/tournoi/i);
  });
});

// ---------------------------------------------------------------------------
// ⛔ CE QUI NE CHANGE PAS — la moitie du temoin qui protege les autres
// ---------------------------------------------------------------------------
describe('D3 — tout le reste ouvre exactement comme avant', () => {
  test('un ENTRAINEMENT ouvre l ecran, sans aucun message', () => {
    toucherModifier(buildEvent());

    expect(alerte).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });

  test('et il precharge toujours ses deux lectures AVANT de naviguer', () => {
    toucherModifier(buildEvent());

    const clefs = mockPrefetch.mock.calls.map((/** @type {any} */ appel) => appel[0].queryKey);
    expect(clefs).toEqual(
      expect.arrayContaining([['event', 'event-1', 'edit'], ['event-types']]),
    );
    expect(Math.max(...mockPrefetch.mock.invocationCallOrder))
      .toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });

  // 🔧 D9 DE L'AUDIT, ET IL N'EST PAS DANS CE LOT. Le garde-fou des detections
  // lit `detectionSlots`, un champ que la projection d'edition du SERVEUR ne
  // renvoie pas : il ne se declenche donc jamais, ni avant ce lot ni apres.
  // Ce temoin l'ecrit noir sur blanc, pour que personne ne croie l'avoir
  // corrige ici — et pour que le jour ou le serveur renverra le champ, ce soit
  // une DECISION et pas une surprise.
  test('une DETECTION ouvre toujours — son refus vit cote serveur (D9, hors lot)', () => {
    toucherModifier(DETECTION());

    expect(alerte).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EVEDIT-3 (E6) — LE PRECHARGEMENT QUI REPART A CHAQUE APPUI.
//
// 🧨 L'AMPLIFICATEUR DE « CA CHARGE PENDANT DES HEURES ». Les deux
// prechargements poses par EVEDIT-1 sont une bonne idee, mais un seul des deux
// porte une duree de fraicheur. Le commentaire du code EXPLIQUE pourquoi
// `event-types` en a besoin — « sans elle, ce prechargement-ci repartirait au
// reseau a CHAQUE appui sur Modifier » — et la meme phrase vaut mot pour mot
// pour la fiche elle-meme, qui n'en a pas. La regle a ete ecrite, puis
// appliquee a une ligne sur deux.
//
// 🔗 POURQUOI CA COMPTE MAINTENANT : le lot FCMSTORM a mesure 27 refus `429`
// en rafale le 28/08. Un appui qui n'a pas l'air d'agir se rejoue — et chaque
// rejeu relancait une lecture complete de l'evenement. C'est exactement la
// forme de charge que la protection anti-abus du serveur punit, et un `429`
// sur cette lecture-la fige l'ecran de modification (voir
// `EventEditEvedit3Ouverture.test.js`).
//
// ⛔ CE TEMOIN NE MESURE AUCUNE MILLISECONDE : il verifie qu'une duree de
// fraicheur est DEMANDEE. Ce que react-query en fait est son affaire, pas
// celle de cet ecran.
describe('EVEDIT-3 — le prechargement de la fiche ne repart pas a chaque appui', () => {
  test('la lecture de l evenement porte une duree de fraicheur, comme sa voisine', () => {
    toucherModifier(buildEvent());

    const lectureFiche = mockPrefetch.mock.calls
      .map((/** @type {any} */ appel) => appel[0])
      .find((/** @type {any} */ options) => options.queryKey?.[2] === 'edit');

    expect(lectureFiche).toBeDefined();
    // 🔴 ROUGE AVANT : `staleTime` valait `undefined`, donc zero — la lecture
    // repartait au reseau meme deux secondes apres la precedente.
    expect(typeof lectureFiche.staleTime).toBe('number');
    expect(lectureFiche.staleTime).toBeGreaterThan(0);
  });

  test('deux appuis de suite ne redemandent pas deux fois la meme fiche', () => {
    toucherModifier(buildEvent());
    toucherModifier(buildEvent());

    // La fraicheur demandee doit etre la MEME aux deux appuis : c'est elle qui
    // permet a react-query de servir le second sans repartir au reseau.
    const fraicheurs = mockPrefetch.mock.calls
      .map((/** @type {any} */ appel) => appel[0])
      .filter((/** @type {any} */ options) => options.queryKey?.[2] === 'edit')
      .map((/** @type {any} */ options) => options.staleTime);

    expect(fraicheurs).toHaveLength(2);
    expect(fraicheurs[0]).toBe(fraicheurs[1]);
    expect(fraicheurs[0]).toBeGreaterThan(0);
  });
});
