import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import HistoryWizardSingle from '../HistoryWizardSingle';

// D40 marche 1 — le MEME defaut ③ que D23, sur l'ecran que le TELEPHONE execute.
//
// D23 (`99467f9`) a corrige `HistoryWizardClub.js` — la copie WEB. Le bloc fautif
// est reste, caractere pour caractere, dans `HistoryWizardSingle.js` : des qu'un
// club est retenu la liste de resultats disparait (`!hasSelectedClub`) et la carte
// du club retenu est rendue SANS `onPress`. `ClubSearchResultCard` se met alors en
// `disabled` : plus rien n'est tapable. Une faute de frappe devient definitive.
//
// Ce filet vise le COMPORTEMENT (« je peux retirer le club retenu »), pas la forme
// de l'arbre : la carte porte le nom du club, le lien porte son libelle.
//
// Il couvre aussi la marche 3 : apres un enregistrement on revient sur la LISTE
// (motif LinkedIn), on ne repart plus au profil.

const mockDispatch = jest.fn();
const mockState = { current: /** @type {any} */ (null) };
const mockCreate = jest.fn(() => Promise.resolve());
const mockUpdate = jest.fn(() => Promise.resolve());

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
  default: () => ({ userData: { documentId: 'user-d40' } }),
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

jest.mock(
  '@/components/molecules/autocompleteSelect/AutocompleteSelect',
  () => 'AutocompleteSelect',
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => 'BottomModal');
jest.mock('@/components/molecules/input/Input', () => 'Input');
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => 'AutocompleteAddressInput',
);
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

// La doublure expose le bouton de validation : la marche 3 se prouve en
// l'appuyant, pas en relisant `handleSuccess`.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const {
    Text: RNText,
    TouchableOpacity: RNTouchable,
    View: RNView,
  } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children, isNextDisabled, nextLabel, onNext,
    }) => (
      <RNView>
        {children}
        <RNTouchable disabled={Boolean(isNextDisabled)} onPress={onNext}>
          <RNText>{nextLabel}</RNText>
        </RNTouchable>
      </RNView>
    ),
  };
});

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({
    data: [], error: null, isLoading: false, refetch: () => {},
  }),
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({
    data: [], error: null, isLoading: false, refetch: () => {},
  }),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClubs: () => ({ data: undefined, isLoading: false }),
  useSearchClubs: () => ({ data: [], isLoading: false }),
}));

jest.mock('@/services/search/searchQueries', () => ({
  useSearchClubs: () => ({ data: undefined, error: null, isLoading: false }),
}));

jest.mock('@/services/search/searchService', () => ({ mapSearchPayload: () => [] }));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useCreateHistory: () => ({ isPending: false, mutateAsync: mockCreate }),
  useUpdateHistory: () => ({ isPending: false, mutateAsync: mockUpdate }),
}));

jest.mock('@/utils/location', () => ({
  getLocationCoordinates: () => undefined,
  normalizeLocationInput: (/** @type {any} */ value) => value,
}));

const CLUB = { documentId: 'club-1', name: 'AS Test Rugby' };

const etatVierge = () => ({
  categories: [],
  club: null,
  customClubName: '',
  editingEntry: null,
  endYear: 2026,
  isCurrentlyActive: false,
  level: null,
  multisportClub: null,
  returnRoute: null,
  startYear: 2026,
  useCustomClub: false,
});

const rendre = (/** @type {any} */ params = {}) => {
  const navigation = {
    goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn(), setParams: jest.fn(),
  };
  let arbre;
  act(() => {
    arbre = renderer.create(
      <HistoryWizardSingle
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params })}
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

describe('HistoryWizardSingle — retirer le club retenu (D40 marche 1)', () => {
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
