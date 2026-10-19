/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 🖥️ COLL-C4B-BIS (03/10/2026), point 6 — planche 25 du plan ; design HY521H1 « P3b-actu-tel » ecran 6 :
// « La fiche de l installation porte un bandeau tant que la fermeture dure ou approche ». Cote club, la
// carte d une installation de la Ville (« Tes installations ») porte le bandeau que le serveur annonce
// (`meta.bandeau` : en cours, ou dans les 14 jours), avec ses jours. Limite nommee par C4B (461815de) :
// « la carte Installations de la Ville de la fiche du club n en porte pas ». ROUGE avant le lot.
// Harnais de FacilityList.COLL-C2C.troisGroupes.test.js.

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
/** @type {Record<string, any>} */
const mockBandeaux = {};
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: (/** @type {string} */ id) => ({
    // FINITIONS13-COLL (04/10) : une liste = `meta.bandeaux` (serveur d apres), sinon `meta.bandeau`.
    data: mockBandeaux[id] ? {
      data: [],
      meta: Array.isArray(mockBandeaux[id])
        ? { bandeau: mockBandeaux[id][0], bandeaux: mockBandeaux[id] }
        : { bandeau: mockBandeaux[id] },
    } : null,
  }),
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

describe('COLL-C4B-BIS point 6 — la carte d une installation de la Ville porte son bandeau', () => {
  it('le dojo, ferme pendant les vacances : la carte le dit, avec ses jours ; le gymnase, ouvert, rien', () => {
    mockBandeaux.dojo = {
      documentId: 'f-dojo', endDate: '2026-10-25', kind: 'closure', reason: 'vacances', startDate: '2026-10-17',
    };
    const arbre = rendre();
    const lus = textes(arbre);
    // FINITIONS11-COLL (03/10, planche 25) : le type de l installation nomme le lieu.
    expect(lus).toContain('Le dojo est fermé du samedi 17 octobre au dimanche 25 octobre');
    expect(lus).toContain('Vacances.');
    const bandeaux = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === 'carte-ville-bandeau-dojo');
    expect(bandeaux).toHaveLength(1);
    expect(arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === 'carte-ville-bandeau-gym-tilleuls')).toHaveLength(0);
    delete mockBandeaux.dojo;
  });
});

// 🎨 FINITIONS13-COLL (04/10) — point 8 : TOUTES les fermetures à venir (tournée T13 : la fermeture
// du 15 restait invisible tant qu'une autre existait le 10). ROUGE avant le lot.
describe('FINITIONS13-COLL point 8 — le bandeau dit toutes les fermetures à venir', () => {
  it('deux fermetures annoncées : deux bandeaux, la plus proche d’abord', () => {
    mockBandeaux.dojo = [
      {
        documentId: 'f-1', endDate: '2026-10-08', kind: 'closure', label: 'Ascension', reason: 'autre', startDate: '2026-10-08',
      },
      {
        documentId: 'f-2', endDate: '2026-10-15', kind: 'closure', reason: 'travaux', startDate: '2026-10-15',
      },
    ];
    const lus = textes(rendre());
    const premier = lus.indexOf('Le dojo est fermé le jeudi 8 octobre');
    const second = lus.indexOf('Le dojo est fermé le jeudi 15 octobre');
    expect(premier).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(premier);
    delete mockBandeaux.dojo;
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
