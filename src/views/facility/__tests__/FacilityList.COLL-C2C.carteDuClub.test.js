/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 🏟️ COLL-C2C (02/10) — LA CARTE D UNE INSTALLATION DU CLUB ET L ÉTAT VIDE (planche
// P8-installations-tel, états 1 et 2). Le VRAI i18next (fr.js) écrit les phrases.
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - le bouton rouge « Supprimer » ne se voit plus sur la carte du club : il est rangé dans le
//     menu « Plus d actions », d où il demande toujours confirmation ;
//   - un club sans Ville et sans installation : « Aucune installation », la phrase au tu,
//     « Ajouter une installation », aucune section de la Ville (déjà vrai : garde-fou).
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
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 24 }),
}));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/emptyState/EmptyState', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function EmptyStateMock(/** @type {any} */ props) {
    return reactActuel.createElement(reactActuel.Fragment, null, [props.title, props.description, props.actionLabel]
      .map((texte) => reactActuel.createElement(TexteRN, { key: texte }, texte)));
  };
});
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

const plusDActions = (/** @type {any} */ arbre, /** @type {string} */ nom) => arbre.root.findAll((/** @type {any} */ n) => (
  typeof n.props?.onPress === 'function' && n.props.accessibilityLabel === `Plus d’actions pour ${nom}`
), { deep: false });
const pressablesDe = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll((/** @type {any} */ n) => (
  typeof n.type !== 'string'
  && typeof n.props?.onPress === 'function'
  && n.findAllByType(Text).some((/** @type {any} */ t) => aplatir(t.props.children).trim() === libelle)
));

beforeEach(() => {
  mockNavigate.mockClear();
  mockOptionsDuContexte.length = 0;
  mockRoute = { params: { clubId: 'as-montrivage' } };
  avecInstallations([SALLE]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

describe('COLL-C2C — la carte d une installation du club', () => {
  it('le bouton rouge « Supprimer » ne se voit plus sur la carte', () => {
    const lus = textes(rendre());
    expect(lus).toContain('Salle annexe');
    expect(lus).not.toContain('Supprimer');
  });

  it('il est rangé dans « Plus d actions », et demande toujours confirmation', () => {
    const arbre = rendre();
    const menu = plusDActions(arbre, 'Salle annexe');
    expect(menu).toHaveLength(1);
    act(() => { menu[0].props.onPress(); });
    const supprimer = pressablesDe(arbre, 'Supprimer l’installation');
    expect(supprimer.length).toBeGreaterThan(0);
    act(() => { supprimer[supprimer.length - 1].props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledWith('Supprimer l\'installation', expect.any(String), expect.any(Array));
  });

  it('même rangement dans le groupe « Au club » quand le club a une Ville', () => {
    avecInstallations([SALLE, DOJO]);
    const arbre = rendre();
    expect(textes(arbre)).not.toContain('Supprimer');
    expect(plusDActions(arbre, 'Salle annexe')).toHaveLength(1);
    // Une installation de la Ville n a pas ce menu côté club : on ne supprime pas chez la Ville.
    expect(plusDActions(arbre, 'Dojo municipal')).toHaveLength(0);
  });
});

describe('COLL-C2C — un club sans Ville et sans installation (état 2)', () => {
  it('« Aucune installation », la phrase au tu, « Ajouter », et aucune section de la Ville', () => {
    avecInstallations([]);
    const lus = textes(rendre());
    expect(lus).toContain('Aucune installation');
    expect(lus).toContain('Ajoute les terrains, gymnases ou salles de ton club.');
    expect(lus).toContain('Ajouter une installation');
    expect(lus.some((texte) => /Ville/.test(texte))).toBe(false);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// R17-PLANNING (20/10) : la section « Planning de toutes les installations » a son propre témoin
// (PlanningDesInstallations.R17PLAN.test.js) ; ici elle est doublée.
jest.mock(
  '@/components/organisms/planning/PlanningDesInstallations',
  () => function PlanningDesInstallationsDouble() { return null; },
);
