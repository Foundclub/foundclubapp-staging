/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 🏟️ COLL-C2C (02/10) — D32 : « RÉPARTIR » SES CRÉNEAUX DE LA VILLE ENTRE SES ÉQUIPES, depuis
// « Tes installations ». Le dirigeant (et lui seul, jugé par le serveur : `canManageClubSlots`)
// ouvre, créneau par créneau, le panneau de C2B en mode `repartition` (son témoin :
// SeasonSlotForm.COLL-C2C.repartition.test.js) ; le serveur ne le laisse changer que l équipe
// (admin tests/authz/COLL-C2C-repartition.test.js). Le VRAI i18next (fr.js) écrit les phrases.
//
// Harnais repris de FacilityList.COLL-C2C.troisGroupes.test.js (mêmes doublures).

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityContext;
/** @type {any[]} */
const mockOptionsDuContexte = [];
const mockNavigate = jest.fn();

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
/** @type {any[]} */
const mockPanneaux = [];
jest.mock('@/components/organisms/seasonSlot/SeasonSlotForm', () => function SeasonSlotFormMock(/** @type {any} */ props) {
  mockPanneaux.push(props);
  return null;
});
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

const repartir = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => (
  typeof n.props?.onPress === 'function' && String(n.props.accessibilityLabel || '').startsWith('Répartir')
), { deep: false });

beforeEach(() => {
  mockNavigate.mockClear();
  mockOptionsDuContexte.length = 0;
  mockPanneaux.length = 0;
  mockRoute = { params: { clubId: 'as-montrivage' } };
  avecInstallations([SALLE, GYMNASE, DOJO]);
  mockFacilityContext.data = { ...mockFacilityContext.data, canManageClubSlots: true, pendingClubSessions: [] };
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2C — D32 : le dirigeant répartit ses créneaux de la Ville', () => {
  it('chaque créneau du club a son « Répartir », qui dit lequel', () => {
    const arbre = rendre();
    const gestes = repartir(arbre);
    expect(gestes).toHaveLength(2);
    expect(gestes.map((g) => g.props.accessibilityLabel)).toEqual([
      'Répartir : U15 · chaque mardi 17:30 – 19:00',
      'Répartir : U15 · chaque jeudi 18:00 – 19:30',
    ]);
    expect(textes(arbre).filter((texte) => texte === 'Répartir')).toHaveLength(2);
  });

  it('« Répartir » ouvre le panneau de C2B en répartition, sur CE créneau ; « fini » relit la page', () => {
    const arbre = rendre();
    act(() => { repartir(arbre)[1].props.onPress(); });
    const panneau = mockPanneaux.at(-1);
    expect(panneau.repartition).toBe(true);
    expect(panneau.slot.documentId).toBe('s2');
    expect(textes(arbre)).toContain('Quelle équipe sur ce créneau ?');
    act(() => { panneau.onDone(); });
    expect(mockFacilityContext.refetch).toHaveBeenCalled();
    expect(textes(arbre)).not.toContain('Quelle équipe sur ce créneau ?');
  });

  it('un membre qui ne dirige pas le club ne répartit rien', () => {
    mockFacilityContext.data = { ...mockFacilityContext.data, canManageClubSlots: false };
    const arbre = rendre();
    expect(repartir(arbre)).toHaveLength(0);
    expect(textes(arbre)).toContain('U15 · chaque mardi 17:30 – 19:00');
  });
});
