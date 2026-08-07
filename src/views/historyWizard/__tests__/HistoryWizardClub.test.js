import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import HistoryWizardClub from '../HistoryWizardClub';

// D23 — defaut ③ de la recette du 2026-08-07 : « etape Historique sportif : on
// ajoute un club, on ne peut plus l'enlever ».
//
// CAUSE : des qu'un club est retenu, la liste de resultats disparait
// (`!hasSelectedClub`) et la carte du club retenu etait rendue SANS `onPress`.
// `ClubSearchResultCard` se met alors en `disabled` : plus rien n'est tapable.
// Le seul chemin restant etait invisible — retaper dans le champ de recherche,
// qui vide la selection au passage. Une faute de frappe devenait definitive.
//
// Ce filet vise le COMPORTEMENT (« je peux retirer le club retenu »), pas la
// forme de l'arbre : la carte porte le nom du club, le lien porte son libelle.

const mockDispatch = jest.fn();
const mockState = { current: /** @type {any} */ (null) };

jest.mock('../HistoryWizardContext', () => ({
  useHistoryWizard: () => ({ dispatch: mockDispatch, state: mockState.current }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@react-native-community/slider', () => 'Slider');

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'user-d23' } }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => undefined }),
}));

// Doublure qui PORTE le nom du club et dit si elle est pressable : c'est
// exactement ce que le defaut concerne.
jest.mock('@/components/molecules/clubSearchResultCard/ClubSearchResultCard', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ item, onPress }) => (
      <RNTouchable accessibilityRole="button" disabled={!onPress} onPress={onPress}>
        <RNText>{item?.name}</RNText>
      </RNTouchable>
    ),
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => 'AutocompleteSelect');
jest.mock('@/components/molecules/bottomModal/BottomModal', () => 'BottomModal');
jest.mock('@/components/molecules/input/Input', () => 'Input');
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => 'AutocompleteAddressInput');
jest.mock('@/components/organisms/searchComponent/searchComponent', () => 'SearchComponent');
jest.mock('@/components/atoms/button/Button', () => 'Button');

jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClubs: () => ({ data: undefined, isLoading: false }),
  useSearchClubs: () => ({ data: [], isLoading: false }),
}));

jest.mock('@/services/search/searchQueries', () => ({
  useSearchClubs: () => ({ data: undefined, error: null, isLoading: false }),
}));

jest.mock('@/services/search/searchService', () => ({ mapSearchPayload: () => [] }));

jest.mock('@/utils/location', () => ({
  getLocationCoordinates: () => undefined,
  normalizeLocationInput: (/** @type {any} */ value) => value,
}));

const CLUB = { documentId: 'club-1', name: 'AS Test Rugby' };

const etatVierge = () => ({
  club: null,
  customClubName: '',
  multisportClub: null,
  useCustomClub: false,
});

const rendre = () => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(
      <HistoryWizardClub
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: {} })}
      />,
    );
  });
  return { navigation, tree: /** @type {any} */ (arbre) };
};

const pressableParTexte = (tree, libelle) => tree.root
  .findAllByType(TouchableOpacity)
  .find((node) => node.findAllByType(Text)
    .some((texte) => String(texte.props.children) === libelle));

beforeEach(() => {
  jest.clearAllMocks();
  mockState.current = etatVierge();
});

describe('HistoryWizardClub — retirer le club retenu (D23 ③)', () => {
  it('la carte du club retenu est PRESSABLE, et la presser vide la selection', () => {
    mockState.current = { ...etatVierge(), club: CLUB };
    const { tree } = rendre();

    const carte = pressableParTexte(tree, CLUB.name);
    // C'ETAIT LE DEFAUT : sans `onPress`, la carte partait en `disabled`.
    expect(carte).toBeDefined();
    expect(carte.props.disabled).toBe(false);

    act(() => { carte.props.onPress(); });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_CLUB_SELECTION' });
  });

  it('un libelle visible dit comment le retirer : « Changer de club »', () => {
    mockState.current = { ...etatVierge(), club: CLUB };
    const { tree } = rendre();

    const lien = pressableParTexte(tree, 'Changer de club');
    expect(lien).toBeDefined();

    act(() => { lien.props.onPress(); });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_CLUB_SELECTION' });
  });

  it('un club multisport retenu se retire de la meme facon', () => {
    mockState.current = { ...etatVierge(), multisportClub: CLUB };
    const { tree } = rendre();

    act(() => { pressableParTexte(tree, CLUB.name).props.onPress(); });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_CLUB_SELECTION' });
  });

  it('sans club retenu, ni carte ni lien de retrait', () => {
    const { tree } = rendre();

    expect(pressableParTexte(tree, CLUB.name)).toBeUndefined();
    expect(pressableParTexte(tree, 'Changer de club')).toBeUndefined();
  });
});
