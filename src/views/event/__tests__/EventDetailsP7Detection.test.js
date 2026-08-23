import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { capteurEntete, capteurParticipants } from '@/testSupport/p7Capteurs';

// Lot P7 (vague P du 23/08) — LE TABLEAU DE BORD DU RECRUTEMENT d'une
// detection : les deux tuiles de l'entete (planche 03, carte E) et le
// regroupement des candidats PAR POSTE dans l'onglet « Candidats »
// (regle 5 du pack : participants retenus / demandes a traiter).
//
// 🎯 CE QUE CE FILET REGARDE : ce que l'ecran CALCULE et DESCEND a ses enfants.
// Les deux enfants concernes sont donc doubles par des capteurs de props, et
// non par les doublures de texte des 16 suites voisines : c'est le seul moyen
// de prouver qu'un chiffre est juste, et pas seulement qu'un bloc est monte.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et ce qui ne l'est pas, jamais ou ni comment.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: /** @type {any} */ (null) };

// 📸 Les capteurs vivent dans `@/testSupport/p7Capteurs` (importe plus haut) :
// chaque rendu y ECRASE la valeur, un temoin lit donc toujours le DERNIER
// rendu, celui qui correspond a l'etat courant de l'ecran.

jest.mock('react-i18next', () => {
  const rendre = (/** @type {any} */ modele, /** @type {any} */ options) => String(modele)
    .replace(
      /\{\{(\w+)\}\}/g,
      (/** @type {any} */ _tout, /** @type {any} */ nom) => (
        options && nom in options ? String(options[nom]) : `{{${nom}}}`
      ),
    );
  return {
    ...jest.requireActual('react-i18next'),
    useTranslation: () => ({
      t: (
        /** @type {string} */ key,
        /** @type {any} */ fallback,
        /** @type {any} */ options,
      ) => {
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
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

// 🏆 Sans ce mock, le hook tire `tournamentCompetitionService` donc
// `@/services/client`, et la SUITE ENTIERE tombe a 0 test (piege connu :
// un import de service de plus = des suites qui ne s'executent plus).
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
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
    return react.createElement(rn.View, null, props.headerComponent, props.children);
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

// 📸 LES DEUX CAPTEURS. Ils rendent AUSSI leur nom en texte, pour que les
// temoins qui veulent seulement savoir « ce bloc est-il monte ? » restent
// lisibles comme dans les suites voisines.
jest.mock('../components/EventHeader', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  // eslint-disable-next-line global-require
  const capteur = require('@/testSupport/p7Capteurs').capteurEntete;
  return function EventHeaderCapteur(/** @type {any} */ props) {
    capteur.props = props;
    return react.createElement(rn.Text, null, 'DOUBLURE_EventHeader');
  };
});

jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  // eslint-disable-next-line global-require
  const capteur = require('@/testSupport/p7Capteurs').capteurParticipants;
  return function EventParticipantsCapteur(/** @type {any} */ props) {
    capteur.props = props;
    return react.createElement(rn.Text, null, 'DOUBLURE_EventParticipants');
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
import EventDetails from '../EventDetails';
/* eslint-enable import/first */

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const ROUTES_PILE_EVENEMENT = ['EventDetails', 'EventEdit', 'EventPublishedShowcase'];

const GARDIEN_1 = { avatar: null, documentId: 'u-gardien-1', firstname: 'Alix' };
const GARDIEN_2 = { avatar: null, documentId: 'u-gardien-2', firstname: 'Bahia' };
const GARDIEN_3 = { avatar: null, documentId: 'u-gardien-3', firstname: 'Chris' };
const ATTAQUANT_1 = { avatar: null, documentId: 'u-attaquant-1', firstname: 'Dany' };

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Detection gardiens',
  participations: [],
  startTime: '10:00',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' },
  type: { name: 'Detection' },
  ...overrides,
});

// 🔭 LA DETECTION DE RECETTE, construite pour EXERCER le `max()` anti-double-
// comptage dans LES DEUX SENS :
//   · « Gardien »   : 3 candidats d'annonce mais seulement 2 participations
//                     ⇒ c'est la liste de l'annonce qui gagne (3).
//   · « Attaquant » : AUCUN candidat d'annonce mais 1 participation
//                     ⇒ c'est la somme des participations qui gagne (1).
// Sans ce `max()`, l'un des deux chiffres serait faux.
const buildDetection = (/** @type {any} */ overrides = {}) => buildEvent({
  participationRequests: [
    {
      documentId: 'part-gardien-accepte',
      isActive: true,
      participationStatus: 'accepted',
      recruitmentAd: { documentId: 'ad-gardien' },
      user: GARDIEN_1,
    },
    {
      documentId: 'part-gardien-attente',
      isActive: true,
      participationStatus: 'pending',
      recruitmentAd: { documentId: 'ad-gardien' },
      user: GARDIEN_2,
    },
    {
      documentId: 'part-attaquant-attente',
      isActive: true,
      participationStatus: 'pending',
      recruitmentAd: { documentId: 'ad-attaquant' },
      user: ATTAQUANT_1,
    },
  ],
  recruitmentAds: [
    {
      candidates: [GARDIEN_1, GARDIEN_2, GARDIEN_3],
      documentId: 'ad-gardien',
      position: 'Gardien',
      quantity: 2,
    },
    {
      candidates: [],
      documentId: 'ad-attaquant',
      position: 'Attaquant',
      quantity: 1,
    },
  ],
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

const monter = (/** @type {any} */ { auth, event, params = {} } = {}) => {
  mockEventQuery.data = event === undefined ? buildDetection() : event;
  mockUseAuth.mockReturnValue(auth || authOrganisateur());

  demonter();
  mockSetOptions.mockClear();
  capteurEntete.props = null;
  capteurParticipants.props = null;

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
  const parts = /** @type {string[]} */ ([]);
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

// 🧭 Meme lecture que N2Caracterisation : on passe par la doublure d'onglets,
// puis par SES `TouchableOpacity`. Un `findAll` sur le testID compterait aussi
// les noeuds imbriques et rendrait chaque libelle plusieurs fois.
const libellesDesOnglets = (/** @type {any} */ root) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === 'doublure-onglets', { deep: false })
  .flatMap((/** @type {any} */ node) => node
    .findAllByType(TouchableOpacity)
    .map((/** @type {any} */ item) => textOf(item)));

const allerSurLOnglet = (/** @type {any} */ root, /** @type {string} */ valeur) => {
  const onglet = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `onglet-${valeur}`,
  )[0];
  act(() => {
    onglet.props.onPress();
  });
};

describe('P7 - le tableau de bord du recrutement descend jusqu a l entete', () => {
  test('P7 · temoin 1 — les deux chiffres du metier arrivent a l entete', () => {
    monter({ event: buildDetection() });

    // « postes ouverts » : les deux postes ont encore de la place
    // (Gardien 1 valide sur 2, Attaquant 0 sur 1).
    // « candidatures a voir » : Gardien 3 - 1 valide = 2, Attaquant 1 - 0 = 1.
    expect(capteurEntete.props.detectionSummary).toEqual({
      openPositions: 2,
      toReview: 3,
    });
  });

  test('P7 · temoin 2 — un poste COMPLET sort du compte des postes ouverts', () => {
    // Le poste de gardien ne demande plus qu'UNE place, et elle est prise.
    const root = monter({
      event: buildDetection({
        recruitmentAds: [
          {
            candidates: [GARDIEN_1, GARDIEN_2, GARDIEN_3],
            documentId: 'ad-gardien',
            position: 'Gardien',
            quantity: 1,
          },
          {
            candidates: [],
            documentId: 'ad-attaquant',
            position: 'Attaquant',
            quantity: 1,
          },
        ],
      }),
    });

    expect(capteurEntete.props.detectionSummary.openPositions).toBe(1);
    // Le nombre de candidatures a regarder, lui, ne bouge pas : fermer un
    // poste ne fait disparaitre personne.
    expect(capteurEntete.props.detectionSummary.toReview).toBe(3);
    expect(contient(root, 'DOUBLURE_EventHeader')).toBe(true);
  });

  test('P7 · temoin 3 — une detection SANS poste porte deux zeros, pas de trou', () => {
    monter({ event: buildDetection({ participationRequests: [], recruitmentAds: [] }) });

    expect(capteurEntete.props.detectionSummary).toEqual({
      openPositions: 0,
      toReview: 0,
    });
  });

  test('P7 · temoin 4 — un evenement qui n est PAS une detection ne recoit rien', () => {
    // C'est la prop, et elle seule, qui commande les tuiles : un match ne doit
    // pas se mettre a porter deux tuiles vides.
    monter({ event: buildEvent({ type: { name: 'Match' } }) });

    expect(capteurEntete.props.detectionSummary).toBeNull();
  });

  test('P7 · temoin 5 — l ordre des onglets d une detection ne bouge pas', () => {
    // 🔒 D5 : l'ordre est fige AU CARACTERE PRES par N2Caracterisation:1277.
    // Ce lot n'ajoute ni ne renomme aucun onglet — on le PROUVE ici aussi,
    // parce que c'est exactement le genre de chose qu'un tableau de bord
    // pousse a faire.
    const root = monter({ event: buildDetection() });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Répartition', 'Candidats · 0']);
  });

  test('P7 · temoin 6 — l onglet Candidats monte toujours sa liste', () => {
    const root = monter({ event: buildDetection() });

    allerSurLOnglet(root, 'participants');

    expect(contient(root, 'DOUBLURE_EventParticipants')).toBe(true);
  });
});

describe('P7 - les candidats descendent RANGES PAR POSTE (regle 5)', () => {
  test('P7 · temoin 7 — un groupe par poste, chacun avec ses deux listes', () => {
    // GARDIEN_1 est valide sur le poste de gardien : le serveur l'a donc mis
    // dans `participations`. C'est de LA qu'il faut le reprendre — c'est la
    // liste que l'onglet rendait deja avant ce lot.
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });
    allerSurLOnglet(root, 'participants');

    const sections = capteurParticipants.props.detectionPositionSections;

    expect(sections.map((/** @type {any} */ item) => item.position)).toEqual(['Gardien', 'Attaquant']);
    expect(sections[0].participating.map((/** @type {any} */ user) => user.documentId))
      .toEqual([GARDIEN_1.documentId]);
    expect(sections[0].pending.map((/** @type {any} */ item) => item.documentId))
      .toEqual(['part-gardien-attente']);
    expect(sections[0].acceptedCount).toBe(1);
    expect(sections[0].quantity).toBe(2);
    // Le poste d'attaquant n'a encore retenu personne : le groupe existe quand
    // meme, avec sa demande a trancher.
    expect(sections[1].participating).toEqual([]);
    expect(sections[1].pending.map((/** @type {any} */ item) => item.documentId))
      .toEqual(['part-attaquant-attente']);
  });

  test('P7 · temoin 8 — PERSONNE ne disparait : le groupe de repli', () => {
    // 🧯 Le temoin le plus important du livrable. Une detection accepte aussi
    // des inscriptions HORS annonce. Sans groupe de repli, regrouper par poste
    // effacerait ces gens de l'ecran — une perte silencieuse.
    const LIBRE = { avatar: null, documentId: 'u-libre', firstname: 'Elia' };
    const CURIEUX = { avatar: null, documentId: 'u-curieux', firstname: 'Flo' };
    const detection = buildDetection({ participations: [GARDIEN_1, LIBRE] });
    const root = monter({
      event: {
        ...detection,
        participationRequests: [
          ...detection.participationRequests,
          {
            documentId: 'part-sans-annonce',
            isActive: true,
            participationStatus: 'pending',
            user: CURIEUX,
          },
        ],
      },
    });
    allerSurLOnglet(root, 'participants');

    const sections = capteurParticipants.props.detectionPositionSections;
    const repli = sections[sections.length - 1];

    expect(sections).toHaveLength(3);
    expect(repli.key).toBe('p7-sans-poste');
    expect(repli.position).toBe('');
    expect(repli.participating.map((/** @type {any} */ user) => user.documentId))
      .toEqual([LIBRE.documentId]);
    expect(repli.pending.map((/** @type {any} */ item) => item.documentId))
      .toEqual(['part-sans-annonce']);
  });

  test('P7 · temoin 9 — sans groupe de repli a remplir, il n existe pas', () => {
    // Un groupe vide est un trou dans l'ecran : il ne se monte que s'il porte
    // quelqu'un.
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });
    allerSurLOnglet(root, 'participants');

    const sections = capteurParticipants.props.detectionPositionSections;

    expect(sections.every((/** @type {any} */ item) => item.key !== 'p7-sans-poste')).toBe(true);
  });

  test('P7 · temoin 10 — un evenement qui n est pas une detection ne groupe RIEN', () => {
    // 🔒 La liste vide est ce qui garantit que tous les autres types d'evenement
    // gardent EXACTEMENT l'affichage d'avant ce lot.
    const root = monter({ event: buildEvent({ type: { name: 'Match' } }) });
    allerSurLOnglet(root, 'participants');

    expect(capteurParticipants.props.detectionPositionSections).toEqual([]);
  });

  test('P7 · temoin 11 — une detection SANS poste ne groupe rien non plus', () => {
    const root = monter({
      event: buildDetection({ participations: [GARDIEN_1], recruitmentAds: [] }),
    });
    allerSurLOnglet(root, 'participants');

    expect(capteurParticipants.props.detectionPositionSections).toEqual([]);
  });
});
