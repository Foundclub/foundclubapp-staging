import { FlatList, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminClubList from '../AdminClubList';

// DEFILEMENT (11/11/2026) — TÉMOIN CARACTÉRISANT de la liste des clubs de la console SuperAdmin
// (règle E6 : aucun test ne montait cet écran). Il fige le comportement ACTUEL : l écran monte
// avec deux clubs, le titre et les noms s affichent, la liste qui défile est rendue DANS le
// cadre. Le test « bas actuel » relève la marge du bas telle qu elle est aujourd hui ; une
// autre session la changera et mettra ce test à jour.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

// Deux clubs réalistes, renvoyés par la requête doublée de la console.
const CLUBS = [
  {
    activity: 'Football',
    city: 'Montrivage',
    clubPartner: true,
    clubVerified: true,
    documentId: 'club-as-montrivage',
    isReservationProvider: false,
    name: 'AS Montrivage',
  },
  {
    activity: 'Basket',
    city: 'Lyon',
    clubPartner: false,
    clubVerified: false,
    documentId: 'club-bc-lyon',
    isReservationProvider: true,
    name: 'BC Lyon',
  },
];
jest.mock('@/services/admin/adminClubContentQueries', () => ({
  useBulkDeleteAdminClubContent: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useBulkUpdateAdminClubContent: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetAdminClubContentList: () => ({
    data: { data: CLUBS, meta: { pagination: { total: 2 } } },
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
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
// L écran ne l importe pas encore : la doublure est posée pour la session qui l y branchera.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({
  __esModule: true,
  default: () => 46,
}));
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
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

/**
 * Aplatit les enfants React en une chaîne.
 * @param {any} enfants
 * @returns {string}
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());

/** @type {any[]} */
const arbresMontes = [];
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminClubList />); });
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockCadres.length = 0;
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('DEFILEMENT — liste des clubs SuperAdmin, comportement actuel', () => {
  it('monte avec deux clubs : titre, total et noms des clubs affichés', () => {
    const vus = textes(rendre().root);
    expect(vus).toEqual(expect.arrayContaining([
      'Gestion Clubs',
      'AS Montrivage',
      'BC Lyon',
    ]));
    expect(vus).toContain('2 clubs dans le Content Manager');
  });

  it('la liste des clubs (FlatList) est rendue dans le cadre et porte les deux clubs', () => {
    const arbre = rendre();
    expect(mockCadres.length).toBeGreaterThan(0);
    const listes = arbre.root.findAllByType(FlatList);
    expect(listes).toHaveLength(1);
    expect(listes[0].props.data).toHaveLength(2);
    const dedans = textes(listes[0]);
    expect(dedans).toEqual(expect.arrayContaining(['AS Montrivage', 'BC Lyon']));
    // Le titre est AU-DESSUS de la liste, hors du défilement (comportement actuel).
    expect(dedans).not.toContain('Gestion Clubs');
  });

  // DEFILEMENT-LOT1 (11/11) : avant, « tab-scene » et 32 (la place d une barre absente).
  it('bas : cadre en « scroll-edge », fin de liste à 32 + le retrait commun', () => {
    const liste = rendre().root.findByType(FlatList);
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    expect(StyleSheet.flatten(liste.props.contentContainerStyle).paddingBottom).toBe(32 + 46);
  });
});
