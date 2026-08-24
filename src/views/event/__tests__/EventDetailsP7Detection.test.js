import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  capteurBarreDuBas,
  capteurEntete,
  capteurModaleParticipation,
  capteurParticipants,
} from '@/testSupport/p7Capteurs';

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
// Les deux mutations que la fiche candidat doit REUTILISER (jamais un second
// chemin d'ecriture) : on les garde stables pour pouvoir les observer.
const mockAccepterParticipation = jest.fn();
const mockRefuserParticipation = jest.fn();
const mockLireLesCandidatures = jest.fn(() => Promise.resolve([]));
// 📑 R9 — LA COPIE PAGINEE, pilotable. Les demandes arrivent a l ecran par
// DEUX chemins : embarquees dans l evenement, et paginees par cette requete.
// Seule la seconde porte `recruitmentAd` cote serveur ; il faut donc pouvoir
// les faire diverger pour prouver laquelle gagne la deduplication.
const mockParticipationsPages = { pages: /** @type {any} */ (null) };

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
  useGetEventParticipations: () => ({
    ...emptyQuery(),
    data: mockParticipationsPages.pages
      ? { pages: mockParticipationsPages.pages }
      : null,
  }),
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

// 🔌 D4 — LE MOCK ETENDU, ET SEULEMENT DANS CE FICHIER. Les 15 suites voisines
// doublent ce service avec le SEUL `applyToRecruitmentAd` : elles continuent de
// marcher parce que `getRecruitmentApplications` n'est appele que dans un
// HANDLER (a l'ouverture de la fiche), jamais au rendu.
jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
  getRecruitmentApplications: (/** @type {any} */ adId) => mockLireLesCandidatures(adId),
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
      acceptParticipationMutation: { isPending: false, mutate: mockAccepterParticipation },
      bookFullMutation: idleMutation(),
      cancelEventMutation: idleMutation(),
      coachArrivalMutation: idleMutation(),
      createEventParticipationMutation: idleMutation(),
      declineParticipationMutation: { isPending: false, mutate: mockRefuserParticipation },
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
  // R9 — MEME TEXTE QU AVANT, plus la capture de ses props. La barre du bas
  // porte `onJoin`, et c est le SEUL chemin qui ouvre le choix du poste : sans
  // ses props, aucun temoin ne peut ouvrir ce selecteur pour le regarder.
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    const { capteurBarreDuBas } = require('@/testSupport/p7Capteurs');
    return function BarreDuBasDouble(/** @type {any} */ props) {
      capteurBarreDuBas.props = props;
      return react.createElement(rn.Text, null, 'DOUBLURE_EventAnswerButtons');
    };
  },
);
jest.mock(
  '@/components/organisms/joinEventModal/JoinEventModal',
  // R9 — meme texte qu avant, plus la capture de `contextNote` : c est la
  // seule difference observable entre « je postule au poste de gardien » et
  // « je participe sans poste precis ».
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    const { capteurModaleParticipation } = require('@/testSupport/p7Capteurs');
    return function JoinEventModalDouble(/** @type {any} */ props) {
      capteurModaleParticipation.props = props;
      return react.createElement(rn.Text, null, 'DOUBLURE_JoinEventModal');
    };
  },
);
/* eslint-enable global-require */
// La doublure de la modale de refus rend son ETAT : c'est le seul moyen de
// prouver que « Refuser » ouvre bien la modale existante, et n'ecrit rien lui-meme.
jest.mock('@/components/organisms/refuseParticipationModal/RefuseParticipationModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function RefuseModalDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.Text,
      null,
      `DOUBLURE_RefuseParticipationModal:${props.isVisible ? 'ouverte' : 'fermee'}`,
    );
  };
});
/* eslint-disable global-require */
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

const monter = (/** @type {any} */ { auth, event, pagesPaginees = null, params = {} } = {}) => {
  mockEventQuery.data = event === undefined ? buildDetection() : event;
  mockParticipationsPages.pages = pagesPaginees;
  mockUseAuth.mockReturnValue(auth || authOrganisateur());

  demonter();
  mockSetOptions.mockClear();
  // 🧹 Les compteurs d'appels repartent de zero a chaque montage : sans ca, un
  // `not.toHaveBeenCalled()` compterait les appels du temoin precedent.
  // `mockClear` n'efface QUE les appels, pas les `mockResolvedValueOnce` poses
  // juste avant le montage.
  mockAccepterParticipation.mockClear();
  mockRefuserParticipation.mockClear();
  mockLireLesCandidatures.mockClear();
  capteurEntete.props = null;
  capteurParticipants.props = null;
  capteurBarreDuBas.props = null;
  capteurModaleParticipation.props = null;

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

    expect(sections.map((/** @type {any} */ item) => item.position))
      .toEqual(['Gardien', 'Attaquant']);
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

describe('P7 - la fiche candidat, en feuille', () => {
  /**
   * Ouvre la fiche comme le ferait un doigt sur un candidat : l'onglet
   * « Candidats » monte la liste, et la liste appelle `onCandidatePress`.
   * @param {any} root - L'arbre monte.
   * @param {any} payload - La personne, et sa participation quand on l'a.
   * @returns {void} - Rien.
   */
  const taperSurUnCandidat = (root, payload) => {
    allerSurLOnglet(root, 'participants');
    act(() => {
      capteurParticipants.props.onCandidatePress(payload);
    });
  };

  const DEMANDE_GARDIEN = {
    documentId: 'part-gardien-attente',
    isActive: true,
    participationStatus: 'pending',
    recruitmentAd: { documentId: 'ad-gardien' },
    user: GARDIEN_2,
  };

  test('P7 · temoin 12 — taper un candidat ouvre sa fiche : poste et statut', () => {
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });

    // Avant l'appui, aucune fiche.
    expect(contient(root, 'A postulé au poste')).toBe(false);

    taperSurUnCandidat(root, { participation: DEMANDE_GARDIEN, user: GARDIEN_2 });

    expect(contient(root, 'A postulé au poste : Gardien')).toBe(true);
    expect(contient(root, 'Demande à traiter')).toBe(true);
  });

  test('P7 · temoin 13 — « Accepter » passe par la mutation DEJA en place', () => {
    // 🔒 Le point qui compte : la fiche ne cree pas un second chemin
    // d'ecriture. Elle appelle `handleUpdateParticipation`, donc la meme
    // confirmation et la meme mutation que la carte de demande.
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });

    taperSurUnCandidat(root, { participation: DEMANDE_GARDIEN, user: GARDIEN_2 });

    const accepter = root.findAll(
      (/** @type {any} */ node) => node.props?.accessibilityRole === 'button'
        && textOf(node) === 'Accepter',
    )[0];
    act(() => {
      accepter.props.onPress();
    });

    // L'ecran demande confirmation AVANT d'ecrire : c'est le comportement
    // existant, la fiche ne le contourne pas.
    expect(alerte).toHaveBeenCalled();
    expect(mockAccepterParticipation).not.toHaveBeenCalled();

    // On appuie sur « Confirmer » de l'alerte.
    const boutons = alerte.mock.calls[alerte.mock.calls.length - 1][2];
    act(() => {
      boutons[boutons.length - 1].onPress();
    });

    expect(mockAccepterParticipation).toHaveBeenCalledWith('part-gardien-attente');
    alerte.mockRestore();
  });

  test('P7 · temoin 14 — « Refuser » ouvre la modale de refus existante', () => {
    // Refuser demande un motif : l'ecran a deja une modale pour ca. La fiche
    // l'ouvre au lieu d'ecrire elle-meme — sinon on perdrait le motif.
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });

    taperSurUnCandidat(root, { participation: DEMANDE_GARDIEN, user: GARDIEN_2 });
    expect(contient(root, 'DOUBLURE_RefuseParticipationModal:fermee')).toBe(true);

    const refuser = root.findAll(
      (/** @type {any} */ node) => node.props?.accessibilityRole === 'button'
        && textOf(node) === 'Refuser',
    )[0];
    act(() => {
      refuser.props.onPress();
    });

    expect(contient(root, 'DOUBLURE_RefuseParticipationModal:ouverte')).toBe(true);
    expect(mockRefuserParticipation).not.toHaveBeenCalled();
  });

  test('P7 · temoin 15 — le retour individuel est LU sur la candidature d annonce', async () => {
    // 📝 Regle 6. `reviewNote` ne voyage PAS avec l'evenement (le serveur peuple
    // `recruitmentAds.candidates`, pas `.applications`) : on va le chercher.
    mockLireLesCandidatures.mockResolvedValueOnce([
      { documentId: 'candidature-1', reviewNote: 'Bon pied gauche, a revoir.', user: GARDIEN_2 },
    ]);
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });

    taperSurUnCandidat(root, { participation: DEMANDE_GARDIEN, user: GARDIEN_2 });
    await act(async () => {});

    expect(mockLireLesCandidatures).toHaveBeenCalledWith('ad-gardien');
    expect(contient(root, 'Bon pied gauche, a revoir.')).toBe(true);
  });

  test('P7 · temoin 16 — hors annonce, la fiche NOMME la difference', async () => {
    // 🔒 D3 : une `event-participation` n'a AUCUN champ `reviewNote`. On ne
    // l'invente pas, et on n'affiche pas un cadre vide qui ferait croire a une
    // note effacee : on ecrit pourquoi il n'y en a pas.
    const LIBRE = { avatar: null, documentId: 'u-libre', firstname: 'Elia' };
    const root = monter({
      event: buildDetection({ participations: [GARDIEN_1, LIBRE] }),
    });

    taperSurUnCandidat(root, { participation: null, user: LIBRE });
    await act(async () => {});

    const motif = 'Le retour individuel n’existe que pour les candidatures'
      + ' passées par une annonce.';
    expect(contient(root, motif)).toBe(true);
    // Et on n'est pas alle chercher une candidature qui n'existe pas.
    expect(mockLireLesCandidatures).not.toHaveBeenCalled();
  });

  test('P7 · temoin 17 — une lecture qui echoue le DIT, elle ne ment pas', async () => {
    mockLireLesCandidatures.mockRejectedValueOnce(new Error('reseau'));
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });

    taperSurUnCandidat(root, { participation: DEMANDE_GARDIEN, user: GARDIEN_2 });
    await act(async () => {});

    expect(contient(root, 'Impossible de lire le retour pour le moment.')).toBe(true);
  });
});

describe('P7 - le bouton « Inviter dans l equipe » nait GRISE (serveur = lot P10)', () => {
  test('P7 · temoin 18 — il est monte, DESACTIVE, et son motif est ecrit', () => {
    // 🔒 Un bouton grise qui dit pourquoi vaut mieux qu'un bouton absent :
    // l'organisateur sait que la fonction existe et qu'elle arrive. Le rail
    // serveur de l'invitation avec consentement est le lot P10 ; le brancher
    // ici est un micro-lot qui vient APRES la recolte des deux.
    const root = monter({ event: buildDetection({ participations: [GARDIEN_1] }) });
    allerSurLOnglet(root, 'participants');
    act(() => {
      capteurParticipants.props.onCandidatePress({
        participation: {
          documentId: 'part-gardien-attente',
          participationStatus: 'pending',
          recruitmentAd: { documentId: 'ad-gardien' },
          user: GARDIEN_2,
        },
        user: GARDIEN_2,
      });
    });

    const inviter = root.findAll(
      (/** @type {any} */ node) => node.props?.accessibilityRole === 'button'
        && textOf(node) === 'Inviter dans l’équipe',
    )[0];

    expect(inviter).toBeDefined();
    expect(inviter.props.disabled).toBe(true);
    expect(contient(root, 'L’invitation arrive bientôt.')).toBe(true);
  });
});

describe('R9 - LE CANDIDAT ACCEPTE QUI DISPARAISSAIT DE SON POSTE', () => {
  // 🧨 LE CONSTAT DE RECETTE DU 24/08, mot pour mot : « un candidat accepte
  // n apparait NI dans les candidats du poste avant, NI dans la liste du poste
  // apres ». Deux causes, et il fallait les deux pour reparer :
  //
  //   1. le POPULATE ne descendait pas `recruitmentAd` sur les demandes
  //      embarquees dans l evenement (repare dans `eventService.js` et dans
  //      l allowlist du serveur) ;
  //   2. la DEDUPLICATION inserait la copie embarquee EN PREMIER, donc la copie
  //      amputee gagnait sur la copie paginee qui, elle, portait bien le lien.
  //
  // 🪤 CE QUI RENDAIT LE DEFAUT INVISIBLE AUX TESTS : les fixtures des suites
  // d ecran posent `recruitmentAd` a la main sur les demandes embarquees. Elles
  // decrivent un serveur plus genereux que le vrai. Les temoins ci-dessous
  // reproduisent donc la charge REELLE d avant le lot : embarquee SANS le lien,
  // paginee AVEC.

  /**
   * La demande telle que le serveur l embarquait dans l evenement : sans annonce.
   * @param {any} demande - la demande complete
   * @returns {any} la meme demande, amputee de son lien vers l annonce
   */
  const sansLAnnonce = (demande) => {
    const { recruitmentAd, ...reste } = demande;
    return reste;
  };

  /**
   * Monte la detection avec les DEUX copies divergentes.
   * @param {any} [surcharge] - surcharge de l evenement
   * @returns {any} la racine du rendu
   */
  const monterAvecLesDeuxCopies = (surcharge = {}) => {
    const detection = buildDetection(surcharge);
    return monter({
      event: {
        ...detection,
        participationRequests: detection.participationRequests.map(sansLAnnonce),
      },
      pagesPaginees: [{
        data: detection.participationRequests,
        meta: { pagination: { page: 1, pageCount: 1 } },
      }],
    });
  };

  test('R9 · temoin 4 — AVANT sa validation, le candidat est sous SON poste', () => {
    const root = monterAvecLesDeuxCopies();
    allerSurLOnglet(root, 'participants');

    const sections = capteurParticipants.props.detectionPositionSections;
    const gardien = sections.find((/** @type {any} */ item) => item.position === 'Gardien');

    expect(gardien.pending.map((/** @type {any} */ item) => item.documentId))
      .toEqual(['part-gardien-attente']);
  });

  test('R9 · temoin 5 — APRES sa validation, le retenu reste sous SON poste', () => {
    // GARDIEN_1 est accepte : le serveur le range dans `participations`, et
    // l ecran doit le rattacher a « Gardien » en passant par sa demande.
    const root = monterAvecLesDeuxCopies({ participations: [GARDIEN_1] });
    allerSurLOnglet(root, 'participants');

    const sections = capteurParticipants.props.detectionPositionSections;
    const gardien = sections.find((/** @type {any} */ item) => item.position === 'Gardien');

    expect(gardien.participating.map((/** @type {any} */ user) => user.documentId))
      .toEqual([GARDIEN_1.documentId]);
    expect(gardien.acceptedCount).toBe(1);
  });

  test('R9 · temoin 6 — PERSONNE ne tombe dans le groupe de repli au passage', () => {
    // 🧯 Le garde-fou : reparer le rangement ne doit pas se faire en poussant
    // les gens dans « sans poste precise ». Tout le monde a un poste ici.
    const root = monterAvecLesDeuxCopies({ participations: [GARDIEN_1] });
    allerSurLOnglet(root, 'participants');

    const sections = capteurParticipants.props.detectionPositionSections;

    expect(sections.every((/** @type {any} */ item) => item.key !== 'p7-sans-poste')).toBe(true);
  });

  test('R9 · temoin 7 — les DEUX copies n en font qu une : aucun doublon', () => {
    // 🔒 La deduplication doit toujours faire son travail : preferer la copie
    // complete ne veut pas dire garder les deux.
    const root = monterAvecLesDeuxCopies();
    allerSurLOnglet(root, 'participants');

    const sections = capteurParticipants.props.detectionPositionSections;
    const toutesLesDemandes = sections.flatMap((/** @type {any} */ item) => item.pending);

    expect(toutesLesDemandes).toHaveLength(2);
    expect(new Set(toutesLesDemandes.map((/** @type {any} */ item) => item.documentId)).size)
      .toBe(2);
  });
});

describe('R9 - POSTULER SANS VISER UN POSTE PRECIS', () => {
  // 🧨 LE CONSTAT DE RECETTE DU 24/08 : le selecteur n offrait QUE des postes.
  // Or une detection accepte aussi des inscriptions hors annonce — le groupe
  // d affichage « Sans poste precise » existait deja cote liste (p7-sans-poste),
  // mais rien a l ecran ne permettait D Y ENTRER. Une porte de sortie sans porte
  // d entree.
  //
  // 🔌 Le chemin est celui qui existait deja : `pendingDetectionSlot` a null
  // renvoie la confirmation vers `handleConfirmParticipation`, exactement comme
  // avant ce lot. Aucun second chemin d ecriture n est ouvert ici.

  const joueur = () => authOrganisateur(false);

  /**
   * Ouvre le selecteur de postes comme un joueur le ferait depuis la barre du bas.
   * @param {any} [surcharge] - surcharge de l evenement
   * @returns {any} la racine du rendu
   */
  const ouvrirLeSelecteur = (surcharge = {}) => {
    const root = monter({ auth: joueur(), event: buildDetection(surcharge) });
    act(() => {
      capteurBarreDuBas.props.onJoin();
    });
    return root;
  };

  /**
   * Appuie sur le bouton qui porte exactement ce libelle.
   * @param {any} root - la racine du rendu
   * @param {string} libelle - le texte du bouton
   * @returns {void}
   */
  const appuyerSur = (root, libelle) => {
    const bouton = root.findAll(
      (/** @type {any} */ node) => node.props?.accessibilityRole === 'button'
        && textOf(node) === libelle,
    )[0];
    act(() => {
      bouton.props.onPress();
    });
  };

  test('R9 · temoin 18 — le selecteur offre une rangee « sans poste precis »', () => {
    const root = ouvrirLeSelecteur();

    expect(contient(root, 'Sans poste précis')).toBe(true);
  });

  test('R9 · temoin 19 — l emprunter confirme SANS annoncer de poste choisi', () => {
    const root = ouvrirLeSelecteur();

    appuyerSur(root, 'Participer sans poste');

    // La modale de confirmation s ouvre — avec sa declaration de responsabilite,
    // comme tout chemin generique — mais elle n annonce AUCUN poste.
    expect(capteurModaleParticipation.props.isVisible).toBe(true);
    expect(capteurModaleParticipation.props.contextNote).toBeFalsy();
  });

  test('R9 · temoin 20 — choisir un VRAI poste continue de l annoncer', () => {
    // 🔒 La borne : la rangee neuve ne doit rien retirer au chemin d avant.
    const root = ouvrirLeSelecteur();

    appuyerSur(root, 'Participer');

    expect(capteurModaleParticipation.props.contextNote).toBe('Poste choisi : Gardien.');
  });

  test('R9 · temoin 21 — sans AUCUN poste, on va droit a la confirmation, sans selecteur', () => {
    // 🧭 CE TEMOIN DIT POURQUOI LA RANGEE N A PAS BESOIN D EXISTER ICI. Quand la
    // detection ne cherche aucun poste, l ecran n ouvre pas de selecteur du tout :
    // il confirme directement. C est DEJA « participer sans poste precis », par
    // un chemin plus court. Un selecteur a une seule rangee serait un ecran de
    // plus pour rien.
    const root = monter({ auth: joueur(), event: buildDetection({ recruitmentAds: [] }) });
    act(() => {
      capteurBarreDuBas.props.onJoin();
    });

    expect(contient(root, 'Choisir un poste')).toBe(false);
    expect(capteurModaleParticipation.props.isVisible).toBe(true);
    expect(capteurModaleParticipation.props.contextNote).toBeFalsy();
  });
});
