import renderer, { act } from 'react-test-renderer';

// GUIDE-FINITIONS-3 (rejeu 2 du guide Entraîneur, 29/10) :
// - R2-3 (C02) : un coach dont les séances du jour sont finies, ou qui fait le
//   bonus B1 depuis Mon compte, ne voyait aucune séance cadrée : le planning
//   marque maintenant la prochaine séance pas encore finie (`planning.event.next`)
//   et son bouton « Ajouter un événement » (`planning.fab`) ;
// - N11 bis (capture 39) : ce bouton flottant chevauchait la carte cadrée.

const mockUseGetEvents = jest.fn();

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canManageEvents: true,
    userData: { club: { documentId: 'club-1' }, documentId: 'user-1' },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvents: (/** @type {any} */ config, /** @type {any} */ options) => mockUseGetEvents(
    config,
    options,
  ),
}));

// 🪤 T2 — CETTE DOUBLURE N'EST PAS DÉCORATIVE, elle empêche la suite de ne pas
// se charger du tout. `.env` est dans `.gitignore` : il n'existe dans AUCUNE
// copie de travail. Le vrai `eventService` tire `@/services/client` et
// `react-native-blob-util`, et la suite meurt AVANT d'exécuter un seul témoin
// (« Test Suites: 1 failed / Tests: 0 total »). Tout module de service atteint
// par cet écran doit être doublé ici.
jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {any} */ _key, /** @type {any} */ fallback) => fallback || _key,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
}));

jest.mock('@/services/reservation/reservationService', () => ({
  joinReservation: jest.fn(),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionContainerStyle: () => ({}),
}));

// TOUTES les feuilles lourdes de cet ecran vivent derriere UN seul module
// differe : le doubler entierement suffit, et evite d en importer sept.
jest.mock('@/views/event/ParticipantEventListDeferred', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  const doublure = (/** @type {string} */ nom) => function Doublure() {
    return react.createElement(rn.Text, null, nom);
  };
  return {
    DateSlider: doublure('DOUBLURE_DateSlider'),
    EventCardNew: doublure('DOUBLURE_EventCardNew'),
    FeaturedEvents: doublure('DOUBLURE_FeaturedEvents'),
    JoinEventModal: doublure('DOUBLURE_JoinEventModal'),
    LeagueHeaderSwitch: doublure('DOUBLURE_LeagueHeaderSwitch'),
    NotificationBadge: doublure('DOUBLURE_NotificationBadge'),
    ProfileButton: doublure('DOUBLURE_ProfileButton'),
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/views/event/PlanningOnboardingWrapper',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function PlanningOnboardingWrapperDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ScreenContainerDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/atoms/errorWrapper/ErrorWrapper',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ErrorWrapperDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/organisms/planning/PersonalPlanningContainer',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PersonalPlanning'),
);
jest.mock(
  '@/components/atoms/emptyState/EmptyState',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EmptyState'),
);
jest.mock(
  '@/components/atoms/webFloatingOverlay/WebFloatingOverlay',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function WebFloatingOverlayDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, { testID: 'bouton-flottant' }, props.children);
    };
  },
);
let mockTour = {};
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import ParticipantEventList from '../ParticipantEventList';

jest.setTimeout(30000);

/** @type {any} */
let arbre = null;

const requeteVide = (/** @type {boolean} */ enChargement) => ({
  data: undefined,
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isError: false,
  isFetchingNextPage: false,
  isLoading: enChargement,
  refetch: jest.fn(),
});

/**
 * Monte l ecran « Mon planning ».
 * @param {any[]} [evenements] - Les evenements du flux.
 * @returns {any} - La racine du rendu.
 */
const monter = (evenements = []) => {
  mockUseGetEvents.mockImplementation(() => ({
    ...requeteVide(false), data: { pages: [{ data: evenements }] },
  }));

  act(() => {
    arbre = renderer.create(
      <ParticipantEventList
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: jest.fn(),
          setOptions: jest.fn(),
        }}
      />,
    );
  });

  return arbre.root;
};

const ancres = (racine) => racine.findAll((noeud) => typeof noeud.props.testID === 'string'
  && noeud.props.testID.startsWith('tour.target.')).map((noeud) => noeud.props.testID);
const bouton = (racine) => racine.findAll((noeud) => noeud.props.testID === 'bouton-flottant'
  && typeof noeud.type !== 'string');

const heure = (decalageMinutes) => new Date(Date.now() + decalageMinutes * 60000).toISOString();
const FINIE = {
  date: heure(-180), documentId: 'ev-finie', endDate: heure(-60), name: 'Matin',
};
const A_VENIR = {
  date: heure(120), documentId: 'ev-avenir', endDate: heure(240), name: 'Soir',
};
const B1_CARD = { hidesFloatingAction: true, id: 'b1-card' };

afterEach(() => { act(() => arbre?.unmount()); arbre = null; });

describe('R2-3 — la prochaine séance et le bouton sont repérables par le guide', () => {
  it('séance du jour finie + séance à venir : seule celle à venir est « la prochaine »', () => {
    mockTour = {};
    const racine = monter([FINIE, A_VENIR]);
    const ids = ancres(racine);
    expect(ids).toContain('tour.target.planning.event.next');
    expect(ids).toContain('tour.target.planning.event.ev-avenir');
    expect(ids).toContain('tour.target.planning.fab');
    // La prochaine enveloppe la carte à venir, pas la finie.
    const prochaine = racine.findAll(
      (noeud) => noeud.props.testID === 'tour.target.planning.event.next',
    )[0];
    expect(prochaine.findAll(
      (noeud) => noeud.props.testID === 'tour.target.planning.event.ev-avenir',
    )).not.toHaveLength(0);
  });

  it('seulement des séances finies : pas de « prochaine », le bouton reste', () => {
    mockTour = { currentStep: B1_CARD, isGuide: true, tourStatus: 'active' };
    const racine = monter([FINIE]);
    expect(ancres(racine)).not.toContain('tour.target.planning.event.next');
    expect(bouton(racine)).toHaveLength(1);
  });
});

describe('N11 bis — le bouton flottant se range pendant b1-card', () => {
  it('b1-card avec une séance à ouvrir : pas de bouton par-dessus', () => {
    mockTour = { currentStep: B1_CARD, isGuide: true, tourStatus: 'active' };
    expect(bouton(monter([A_VENIR]))).toHaveLength(0);
  });

  it('hors du guide : le bouton est là (témoin)', () => {
    mockTour = {};
    expect(bouton(monter([A_VENIR]))).toHaveLength(1);
  });
});
