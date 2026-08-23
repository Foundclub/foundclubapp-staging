import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import fr from '@/theme/strings/translations/fr';

// Lot P1 (vague P du 23/08) — N7-events : CINQ RETOUCHES DE LA PAGE EVENEMENT.
//
// Ce filet tient quatre des cinq items du lot (le quatrieme, la bascule
// d'entrainement qui demenage dans le menu ⋯, vit dans
// `EventDetailsL4MenuTroisPoints.test.js`, qu'il casse et reecrit) :
//   1. la phrase-robot FFF ne sert plus de description, et le bloc s'appelle
//      « Description » ;
//   2. « Cotisation » est GRISEE avec son motif quand une campagne existe deja,
//      au lieu de disparaitre ;
//   3. les quatre statuts de « Mettre a la une » passent par `t()` ;
//   5. le fil du tournoi distingue Poules / Matchs / Publie grace au dashboard.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et ce qui ne l'est pas, jamais ou ni comment.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };
const mockCampaigns = { value: /** @type {any[]} */ ([]) };
// 🏆 Item 5 — le dashboard du tournoi, PILOTE PAR LE TEMOIN. `undefined` = le
// serveur n'a encore rien dit (ou le hook est mocke muet, comme dans les 15
// suites voisines) : la page doit alors garder son calcul de repli.
const mockDashboard = { data: /** @type {any} */ (undefined) };

// 🔤 La doublure de traduction ENREGISTRE les clefs demandees (motif N1) : c'est
// ce qui prouve qu'un libelle passe par `t()` et non par une chaine en dur.
jest.mock('react-i18next', () => {
  const askedKeys = /** @type {string[]} */ ([]);
  const rendre = (/** @type {any} */ modele, /** @type {any} */ options) => String(modele)
    .replace(
      /\{\{(\w+)\}\}/g,
      (/** @type {any} */ _tout, /** @type {any} */ nom) => (
        options && nom in options ? String(options[nom]) : `{{${nom}}}`
      ),
    );
  return {
    ...jest.requireActual('react-i18next'),
    askedKeys,
    useTranslation: () => ({
      t: (
        /** @type {string} */ key,
        /** @type {any} */ fallback,
        /** @type {any} */ options,
      ) => {
        askedKeys.push(key);
        const modele = typeof fallback === 'string' ? fallback : key;
        const reglages = typeof fallback === 'string' ? options : fallback;
        return rendre(modele, reglages);
      },
    }),
  };
});

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
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: mockCampaigns.value } }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

// 🏆 Item 5 (D8) — LE SEUL MOCK QUI N'EST PAS UNE RECOPIE. Sans lui, ce hook tire
// `tournamentCompetitionService` donc `@/services/client`, et la SUITE ENTIERE
// tombe a 0 test (piege connu : un import de service de plus = des suites qui ne
// s'executent plus). Ici il rend ce que le temoin lui a donne.
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: mockDashboard.data, isLoading: false }),
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

/* eslint-disable import/first */
// @ts-ignore — `askedKeys` n'existe que dans la doublure ci-dessus.
import { askedKeys } from 'react-i18next';

import EventDetails from '../EventDetails';
/* eslint-enable import/first */

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const PHRASE_ROBOT = 'Match externe synchronisé - Domicile';
const DESCRIPTION_HUMAINE = 'Rendez-vous 1h avant au parking du stade.';
const ROUTES_PILE_EVENEMENT = ['EventDetails', 'EventEdit', 'EventPublishedShowcase'];

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

// ⚽ UN MATCH SYNCHRONISE DEPUIS LA FFF, tel que le robot le cree : le nom
// porte l'adversaire, la description est la phrase-robot.
const buildMatchFFF = (/** @type {any} */ overrides = {}) => buildEvent({
  description: PHRASE_ROBOT,
  externalAutoSource: 'fff',
  name: 'U15 vs FC Voisin',
  type: { name: 'Match' },
  ...overrides,
});

const authOrganisateur = (/** @type {boolean} */ peutGerer = true) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    documentId: 'user-1',
    role: { name: peutGerer ? 'Dirigeant' : 'Joueur' },
  },
});

/** @type {any} */
let mounted = null;

const demonter = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

const monter = (/** @type {any} */ {
  auth,
  campagnes = [],
  dashboard,
  event,
  params = {},
} = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockCampaigns.value = campagnes;
  mockDashboard.data = dashboard;
  mockUseAuth.mockReturnValue(auth || authOrganisateur());

  demonter();
  mockSetOptions.mockClear();
  askedKeys.length = 0;

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          getParent: () => undefined,
          getState: () => ({ routeNames: ROUTES_PILE_EVENEMENT }),
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1', ...params } }}
      />,
    );
  });

  return mounted.root;
};

afterEach(() => {
  demonter();
});

const textOf = (/** @type {any} */ node) => {
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

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const contient = (/** @type {any} */ root, /** @type {string} */ extrait) => textesVisibles(root)
  .join(' | ')
  .includes(extrait);

const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false });

// ─── Le menu ⋯ vit dans l'en-tete de navigation (motif L4MenuTroisPoints) ───
const elementDEntete = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  if (!appels.length) return null;
  return appels[appels.length - 1][0].headerRight();
};

const chercherDansElements = (/** @type {any} */ element, /** @type {(n: any) => boolean} */ predicat) => {
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

const ouvrirLeMenu = () => {
  const bouton = chercherDansElements(
    elementDEntete(),
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
  );
  if (!bouton) throw new Error('Aucun bouton trois-points dans l en-tete de navigation');
  act(() => {
    bouton.props.onPress();
  });
};

const rangeesDeLaFeuille = (/** @type {any} */ root) => parTestID(root, 'event-manage-chip');

const rangee = (/** @type {any} */ root, /** @type {string} */ extrait) => rangeesDeLaFeuille(root)
  .find((/** @type {any} */ n) => textOf(n).includes(extrait));

// La clef du titre, telle que la doublure `t` la rend (aucun repli textuel).
const TITRE_DESCRIPTION = 'eventDetails.fields.description';

describe('P1 · item 1 — la phrase-robot FFF ne sert plus de description', () => {
  test('sur un match synchronise, la phrase-robot N EST PLUS affichee et le bloc disparait', () => {
    const root = monter({ event: buildMatchFFF() });

    // ⛔ Ni la phrase, ni son ancien montage « phrase - Domicile - VS … ».
    expect(contient(root, 'Match externe synchron')).toBe(false);
    // Le bloc entier s'efface : sans texte, pas de titre orphelin.
    expect(contient(root, TITRE_DESCRIPTION)).toBe(false);
  });

  test('une VRAIE description ecrite par un humain sur un match synchronise RESTE affichee', () => {
    const root = monter({ event: buildMatchFFF({ description: DESCRIPTION_HUMAINE }) });

    expect(contient(root, DESCRIPTION_HUMAINE)).toBe(true);
    expect(contient(root, TITRE_DESCRIPTION)).toBe(true);
  });

  test('un match NON externe garde sa description, meme si elle ressemble a la phrase-robot', () => {
    // 🔒 La garde est `externalAutoSource` : sans source externe, on ne
    // censure rien — ce que l'organisateur a ecrit est a lui.
    const root = monter({
      event: buildMatchFFF({ externalAutoSource: undefined }),
    });

    expect(contient(root, 'Match externe synchron')).toBe(true);
    expect(contient(root, TITRE_DESCRIPTION)).toBe(true);
  });

  test('un entrainement ordinaire avec description : rien ne change', () => {
    const root = monter({ event: buildEvent({ description: DESCRIPTION_HUMAINE }) });

    expect(contient(root, DESCRIPTION_HUMAINE)).toBe(true);
    expect(contient(root, TITRE_DESCRIPTION)).toBe(true);
  });

  test('le bloc s appelle « Description » dans fr.js — la clef est conservee, sa valeur change', () => {
    // 🔑 La CLEF ne bouge pas (le controle de recolte compare les ensembles de
    // clefs) ; c'est sa VALEUR qui passe de « À propos » a « Description ».
    expect(fr.eventDetails.fields.description).toBe('Description');
  });
});

describe('P1 · item 2 — « Cotisation » grisee avec son motif, jamais masquee', () => {
  const CAMPAGNE = {
    currency: 'EUR',
    defaultAmountCents: 5000,
    documentId: 'camp-1',
    name: 'Cotisation U15',
    status: 'draft',
    totals: { total: 3 },
  };

  test('AVEC une campagne deja liee : la rangee est LA, grisee, et dit pourquoi', () => {
    const root = monter({ campagnes: [CAMPAGNE] });
    ouvrirLeMenu();

    const ligne = rangee(root, 'Cotisation');
    expect(ligne).toBeTruthy();
    expect(ligne.findAllByType(TouchableOpacity)[0].props.disabled).toBe(true);
    expect(textOf(ligne)).toContain('Cet événement a déjà une cotisation');
    expect(askedKeys).toContain('eventDetails.managePanel.campaignAlreadyLinked');
  });

  test('SANS campagne, suggeree par le tunnel : la rangee reste ACTIVE et sans motif', () => {
    const root = monter({ params: { eventCampaignCreationSuggested: true } });
    ouvrirLeMenu();

    const ligne = rangee(root, 'Cotisation');
    expect(ligne).toBeTruthy();
    expect(ligne.findAllByType(TouchableOpacity)[0].props.disabled).toBeFalsy();
    expect(textOf(ligne)).not.toContain('déjà une cotisation');
  });

  test('SANS campagne et sans suggestion : toujours aucune rangee (perimetre inchange)', () => {
    const root = monter();
    ouvrirLeMenu();

    expect(rangee(root, 'Cotisation')).toBeUndefined();
  });
});

describe('P1 · item 3 — les quatre statuts de « Mettre a la une » passent par t()', () => {
  // Trois portees (publique, club, multisport) ⇒ trois statuts visibles d'un
  // coup ; le quatrieme (« Disponible ») se lit sur un second montage.
  const avecMultisport = (/** @type {any} */ featuredRequestsSummary) => buildEvent({
    club: { documentId: CLUB_ID, parentMultisport: { documentId: 'cm-1' } },
    featuredRequestsSummary,
    team: {
      club: { documentId: CLUB_ID, parentMultisport: { documentId: 'cm-1' } },
      documentId: TEAM_ID,
      name: 'U15',
    },
  });

  const ouvrirMettreALaUne = (/** @type {any} */ root) => {
    ouvrirLeMenu();
    const ligne = rangee(root, 'À la une');
    if (!ligne) throw new Error('Aucune rangee « À la une » dans la feuille');
    act(() => {
      ligne.findAllByType(TouchableOpacity)[0].props.onPress();
    });
  };

  test('en attente · deja a la une · refusee : trois clefs, trois libelles', () => {
    const root = monter({
      event: avecMultisport({
        CM: { requestId: 'r3', status: 'rejected' },
        PUBLIC: { requestId: 'r1', status: 'pending' },
        SECTION: { requestId: 'r2', status: 'approved' },
      }),
    });
    ouvrirMettreALaUne(root);

    expect(askedKeys).toContain('reservation.featuredRequest.pending');
    expect(askedKeys).toContain('eventDetails.featuredRequest.alreadyFeatured');
    expect(askedKeys).toContain('eventDetails.featuredRequest.rejected');
    expect(contient(root, 'Demande en attente')).toBe(true);
    expect(contient(root, 'Déjà à la une')).toBe(true);
    expect(contient(root, 'Refusée, tu peux redemander')).toBe(true);
  });

  test('disponible : la quatrieme clef', () => {
    const root = monter({ event: buildEvent({ featuredRequestsSummary: {} }) });
    ouvrirMettreALaUne(root);

    expect(askedKeys).toContain('eventDetails.featuredRequest.available');
    expect(contient(root, 'Disponible')).toBe(true);
  });

  test('les deux clefs neuves existent dans fr.js, les deux reprises aussi', () => {
    expect(fr.eventDetails.featuredRequest.rejected).toBe('Refusée, tu peux redemander');
    expect(fr.eventDetails.featuredRequest.available).toBe('Disponible');
    expect(fr.eventDetails.featuredRequest.alreadyFeatured).toBe('Déjà à la une');
    expect(fr.reservation.featuredRequest.pending).toBe('Demande en attente');
  });
});
