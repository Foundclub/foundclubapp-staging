/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { SectionList, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// RATTRAPAGE (10/11/2026, Adel « 212 », capture iPhone de 12:40) — « le haut ne se scroll pas et en
// bas y'a du padding inutile ». Côté dirigeant, le haut (« Tes installations », la ligne des
// nombres, « Tes demandes à la Ville ») restait FIXE, environ 30 % de l'écran, et les cartes se
// coupaient dessous ; en bas, la place d'un dock qui n'existe pas sur cette page.
// La règle de T3-BANDEAU-HAUT et T3-BANDE-BAS (03-04/11) : tout défile sauf la flèche ; le cadre ne
// garde rien en bas (`scroll-edge`), la fin de la liste laisse 24 + le retrait commun.
// Et « Tes demandes à la Ville » passe sous la ligne des nombres, en pleine largeur.

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityContext;
/** @type {any[]} */
const mockOptionsDuContexte = [];
const mockNavigate = jest.fn();

// R17-SIGNALER-1 : la carte et l accueil lisent le resume des signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useCollectiviteFacilityReportsSummary: () => ({ data: null }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate, setOptions: jest.fn() }),
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
  useClubFacilityContext: (/** @type {any} */ contexte, /** @type {any} */ options) => {
    mockOptionsDuContexte.push(options);
    return mockFacilityContext;
  },
}));
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: () => ({}),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [], error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  }),
}));
// COLL-C4B-BIS (03/10) : la carte d une installation de la Ville lit sa fermeture (bandeau).
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: () => ({ data: null }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  deleteFacility: jest.fn(),
  getFacilitySections: (/** @type {any[]} */ installations) => (
    Array.isArray(installations) && installations.length ? [{ data: installations, title: '' }] : []
  ),
}));
// Une page de pile n'a pas de dock flottant : sa place (ici 120) n'a rien à faire en bas.
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 120 }),
}));
/** @type {any[]} */
const mockCadres = [];
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    mockCadres.push(props);
    return props.children;
  },
);
// La place de la barre du téléphone (34) + la marge du cadre (12), comme sur un iPhone.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({
  __esModule: true,
  default: () => 46,
}));
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/emptyState/EmptyState', () => function EmptyStateMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);

const VILLE = { collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' } };
const deLaVille = (/** @type {any} */ installation) => ({
  ...VILLE, isReadOnly: true, isShared: true, ownerName: 'Ville de Montrivage', ownerType: 'collectivite', ...installation,
});
const SALLE = {
  documentId: 'salle-annexe', isReadOnly: false, isShared: false, maxSlots: 1, name: 'Salle annexe', ownerType: 'club', type: 'Gymnase',
};
const creneau = (/** @type {string} */ id, /** @type {number} */ weekday, debut, fin, equipe = 'U15') => ({
  documentId: id, endTime: fin, facility: { documentId: 'gym-tilleuls' }, startTime: debut, team: equipe ? { name: equipe } : null, weekday,
});
const GYMNASE = deLaVille({
  address: { description: '12 rue des Tilleuls' },
  clubSeasonSlots: [creneau('s1', 2, '17:30', '19:00'), creneau('s2', 4, '18:00', '19:30')],
  documentId: 'gym-tilleuls',
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  type: 'Gymnase',
});
const DOJO = deLaVille({
  closingTime: '22:00:00', documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', openingTime: '08:00:00', type: 'Dojo',
});
const STADE = deLaVille({
  documentId: 'stade', maxSlots: 2, name: 'Stade municipal', type: 'Terrain',
});

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
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((n) => aplatir(n.props.children).trim());
const avecInstallations = (/** @type {any[]} */ installations) => {
  mockFacilityContext = {
    data: { allFacilities: installations, cmId: null }, error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  };
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockOptionsDuContexte.length = 0;
  mockRoute = { params: { clubId: 'as-montrivage' } };
  avecInstallations([SALLE, GYMNASE, DOJO, STADE]);
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

const laListe = (/** @type {any} */ arbre) => arbre.root.findByType(SectionList);

describe('RATTRAPAGE 212 — le haut des installations défile, la marge du bas est la commune', () => {
  it('le titre, la ligne des nombres et « Tes demandes à la Ville » sont DANS la liste qui défile', () => {
    const liste = laListe(rendre());
    const dedans = liste.findAllByType(Text).map((n) => aplatir(n.props.children).trim());
    expect(dedans).toEqual(expect.arrayContaining([
      'Tes installations',
      '1 au club · 1 avec tes créneaux de la Ville · 2 à demander',
      'Tes demandes à la Ville',
    ]));
  });

  it('« Tes demandes à la Ville » vient sous la ligne des nombres, pas à côté du titre', () => {
    const arbre = rendre();
    const enLigne = arbre.root.findAll((/** @type {any} */ n) => n.props?.style
      && StyleSheet.flatten(n.props.style)?.flexDirection === 'row'
      && n.findAll((/** @type {any} */ m) => m.props?.testID === 'facility-list-tes-demandes').length > 0);
    expect(enLigne).toHaveLength(0);
    const lus = textes(arbre);
    expect(lus.indexOf('Tes demandes à la Ville')).toBeGreaterThan(lus.indexOf('1 au club · 1 avec tes créneaux de la Ville · 2 à demander'));
  });

  it('en bas : le cadre ne garde rien, la fin de la liste laisse 24 + le retrait commun', () => {
    const liste = laListe(rendre());
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    expect(StyleSheet.flatten(liste.props.contentContainerStyle).paddingBottom).toBe(24 + 46);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
jest.mock(
  '@/components/organisms/planning/PlanningDesInstallations',
  () => function PlanningDesInstallationsDouble() { return null; },
);
