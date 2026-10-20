// 🏟️ R17-PLANNING (20/10/2026, REC17-005 lot 1) — SOUS LES CARTES DE LA VILLE, « Planning de toutes
// les installations » (planches P10-planning-ordi / P10-planning-tel, validées le 19/10). Les
// cartes ne changent pas ; la section n existe QU EN MODE VILLE (route avec collectiviteId),
// jamais pour un club.
// Banc repris de FacilityList.COLL-C2B.villeRestylee.test.js ; la section elle-même est doublée ici
// (son témoin propre : PlanningDesInstallations.R17PLAN.test.js).
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

//

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockCollectiviteInstallations;
/** @type {any} */
let mockFacilityContext;
/** @type {any} */
let mockSemaines;
/** @type {any[]} */
const mockSemainesDemandees = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'as-montrivage' } } }),
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
      Images: { calendar: 3, edit: 2, pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => mockFacilityContext,
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage' }],
  }),
}));

jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: (/** @type {any[]} */ installations) => {
    mockSemainesDemandees.push(installations);
    return mockSemaines;
  },
}));

jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: () => ({ data: null }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  deleteFacility: jest.fn(),
  getFacilitySections: (/** @type {any[]} */ installations) => (
    Array.isArray(installations) && installations.length ? [{ data: installations, title: '' }] : []
  ),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 24 }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, 'ROUE');
});
jest.mock(
  '@/components/atoms/emptyState/EmptyState',
  () => function EmptyStateMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);

const GYMNASE = {
  address: { description: '12 rue des Tilleuls, Montrivage' },
  capacityConflictMode: 'pending_validation',
  closingTime: '22:00:00.000',
  documentId: 'gym-tilleuls',
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  openingTime: '08:00:00.000',
  type: 'Gymnase',
};
const DOJO = {
  capacityConflictMode: 'allow_and_notify',
  closingTime: '22:00:00.000',
  documentId: 'dojo',
  maxSlots: 1,
  name: 'Dojo municipal',
  openingTime: '08:00:00.000',
  type: 'Dojo',
};

/** @type {any[]} */
const arbresMontes = [];
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<FacilityList />); });
  arbresMontes.push(arbre);
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());

/** @type {any[]} */
const mockSections = [];
jest.mock(
  '@/components/organisms/planning/PlanningDesInstallations',
  () => function PlanningDesInstallationsDouble(/** @type {any} */ props) {
    mockSections.push(props);
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    return reactActuel.createElement(TexteRN, null, 'SECTION PLANNING GENERAL');
  },
);

beforeEach(() => {
  mockSections.length = 0;
  mockSemainesDemandees.length = 0;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
  mockCollectiviteInstallations = {
    data: [GYMNASE, DOJO], error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  };
  mockFacilityContext = {
    data: { allFacilities: [GYMNASE], cmId: null },
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  };
  mockSemaines = {};
});

afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('R17-PLANNING — le planning général sous les cartes de la Ville', () => {
  test('1 ROUGE-AVANT — mode Ville : la section suit les cartes, avec SES installations', () => {
    const arbre = rendre();
    const lus = textes(arbre);
    expect(lus).toContain('SECTION PLANNING GENERAL');
    // Les cartes ne changent pas, et viennent AVANT la section.
    expect(lus.indexOf('Gymnase des Tilleuls'))
      .toBeLessThan(lus.indexOf('SECTION PLANNING GENERAL'));
    const props = mockSections.at(-1);
    expect(props.collectiviteId).toBe('ville-montrivage');
    expect(props.installations.map((/** @type {any} */ i) => i.documentId))
      .toEqual(['gym-tilleuls', 'dojo']);
  });

  test('2 ROUGE-AVANT — toucher le nom d une installation ouvre SA fiche (comme sa carte)', () => {
    rendre();
    act(() => mockSections.at(-1).onOuvrirInstallation(DOJO));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteInstallation', {
      collectiviteId: 'ville-montrivage',
      facilityId: 'dojo',
    });
  });

  test('3 PROTEGE — mode club : aucune section', () => {
    mockRoute = { params: {} };
    expect(textes(rendre())).not.toContain('SECTION PLANNING GENERAL');
    expect(mockSections).toHaveLength(0);
  });

  test('4 PROTEGE — une Ville sans installation : l état vide seul, pas de section', () => {
    mockCollectiviteInstallations = { ...mockCollectiviteInstallations, data: [] };
    rendre();
    expect(mockSections).toHaveLength(0);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// R17-SIGNALER-1 (récolte 20/10 d) : la carte et l accueil lisent le résumé des signalements
// (doublure, pas de réseau), comme dans les témoins voisins.
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useCollectiviteFacilityReportsSummary: () => ({ data: null }),
}));
