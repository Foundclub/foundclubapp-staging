import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import HistoryWizardSingle from '../HistoryWizardSingle';

// INSCRIPTION-CODE-2 (19/11/2026) — « TON PARCOURS SPORTIF » EN 3 PETITS ÉCRANS (planche V2,
// H1-H3, v2_06 « ok » ; insc_12 « fais la proposition avec tous les écrans de l'ajout »).
// Avant : UN écran de 3 556 px (club, période, catégories, niveau, déclaration, puis « Valider »
// tout en bas). Le même contenu, en 3 étapes : 1 sur 3 le club, 2 sur 3 la période, 3 sur 3
// catégorie, niveau et la déclaration là où on valide. Harnais repris de
// `HistoryWizardSingle.test.js` (D40), doublure de WizardStepLayout enrichie (titre, étape, retour).

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
      children, isNextDisabled, nextLabel, onBack, onNext, stepCount, stepIndex, subtitle, title,
    }) => (
      <RNView>
        <RNText testID="titre">{title}</RNText>
        <RNText testID="sous-titre">{subtitle}</RNText>
        <RNText testID="etape">{`${stepIndex}/${stepCount}`}</RNText>
        <RNTouchable onPress={onBack} testID="retour"><RNText>retour</RNText></RNTouchable>
        {children}
        <RNTouchable disabled={Boolean(isNextDisabled)} onPress={onNext} testID="suivant">
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


const texte = (tree, testID) => tree.root.findAll(
  (node) => node.type === Text && node.props.testID === testID,
)[0]?.props.children;
const touche = (tree, testID) => tree.root.findAll(
  (node) => node.type === TouchableOpacity && node.props.testID === testID,
)[0];
const tousLesTextes = (tree) => tree.root.findAllByType(Text)
  .map((node) => node.props.children)
  .filter((valeur) => typeof valeur === 'string');
const appuyer = async (noeud) => { await act(async () => { noeud.props.onPress(); }); };

describe('H1 — 1 sur 3 : le club', () => {
  it('le titre, la phrase, « 1/3 », et rien de la période ni du niveau', () => {
    const { tree } = rendre();
    expect(texte(tree, 'titre')).toBe('Dans quel club ?');
    expect(texte(tree, 'sous-titre'))
      .toBe('Un club où tu as joué. Tu ajouteras les autres ensuite.');
    expect(texte(tree, 'etape')).toBe('1/3');
    const lus = tousLesTextes(tree);
    expect(lus).toContain('Club non trouvé ? Saisir manuellement');
    expect(lus).not.toContain('Arrivée');
    expect(lus).not.toContain('Ta catégorie là-bas');
    expect(lus).not.toContain("Déclaration sur l'honneur");
  });

  it('sans club, « Continuer » est inactif ; avec un club, il mène au 2 sur 3', async () => {
    const vide = rendre();
    expect(touche(vide.tree, 'suivant').props.disabled).toBe(true);
    expect(tousLesTextes(vide.tree)).toContain('Continuer');

    mockState.current = { ...etatVierge(), club: CLUB };
    const { tree } = rendre();
    await appuyer(touche(tree, 'suivant'));
    expect(texte(tree, 'etape')).toBe('2/3');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('« retour » au 1 sur 3 referme l’assistant', async () => {
    const { navigation, tree } = rendre();
    await appuyer(touche(tree, 'retour'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('H2 — 2 sur 3 : la période', () => {
  it('« De quand à quand ? », le club, Arrivée, Départ, « J’y suis toujours »', async () => {
    mockState.current = { ...etatVierge(), club: CLUB };
    const { tree } = rendre();
    await appuyer(touche(tree, 'suivant'));
    expect(texte(tree, 'titre')).toBe('De quand à quand ?');
    expect(texte(tree, 'sous-titre')).toBe('AS Test Rugby');
    const lus = tousLesTextes(tree);
    expect(lus).toContain('Arrivée');
    expect(lus).toContain('Départ');
    expect(lus).toContain('J’y suis toujours');
    expect(lus).not.toContain('Club non trouvé ? Saisir manuellement');
    expect(lus).not.toContain('Ta catégorie là-bas');
  });

  it('« J’y suis toujours » cache le départ', async () => {
    mockState.current = { ...etatVierge(), club: CLUB, isCurrentlyActive: true };
    const { tree } = rendre();
    await appuyer(touche(tree, 'suivant'));
    expect(tousLesTextes(tree)).not.toContain('Départ');
  });

  it('« retour » au 2 sur 3 revient au club, sans refermer', async () => {
    mockState.current = { ...etatVierge(), club: CLUB };
    const { navigation, tree } = rendre();
    await appuyer(touche(tree, 'suivant'));
    await appuyer(touche(tree, 'retour'));
    expect(texte(tree, 'etape')).toBe('1/3');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

describe('H3 — 3 sur 3 : catégorie, niveau, la déclaration là où on valide', () => {
  const allerAuTrois = async (etat) => {
    mockState.current = { ...etatVierge(), club: CLUB, ...etat };
    const rendu = rendre();
    await appuyer(touche(rendu.tree, 'suivant'));
    await appuyer(touche(rendu.tree, 'suivant'));
    return rendu;
  };

  it('« À quel niveau ? », « club · période », les intertitres, la déclaration', async () => {
    const { tree } = await allerAuTrois({ isCurrentlyActive: true, startYear: 2019 });
    expect(texte(tree, 'etape')).toBe('3/3');
    expect(texte(tree, 'titre')).toBe('À quel niveau ?');
    expect(texte(tree, 'sous-titre')).toBe('AS Test Rugby · 2019 à aujourd’hui');
    const lus = tousLesTextes(tree);
    expect(lus).toContain('Ta catégorie là-bas');
    expect(lus).toContain('Ton meilleur niveau là-bas');
    expect(lus).toContain("Déclaration sur l'honneur");
    expect(lus)
      .toContain('Je déclare que ces informations sont exactes. Elles peuvent être vérifiées.');
    expect(lus).not.toContain('Arrivée');
  });

  it('une période finie : « 2015 à 2018 »', async () => {
    const { tree } = await allerAuTrois({ endYear: 2018, startYear: 2015 });
    expect(texte(tree, 'sous-titre')).toBe('AS Test Rugby · 2015 à 2018');
  });

  it('« Ajouter à mon parcours » enregistre, une seule fois', async () => {
    const { tree } = await allerAuTrois({});
    expect(tousLesTextes(tree)).toContain('Ajouter à mon parcours');
    await appuyer(touche(tree, 'suivant'));
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('en modification, le bouton reste « Enregistrer »', async () => {
    const { tree } = await allerAuTrois({ editingEntry: { documentId: 'h-1' } });
    expect(tousLesTextes(tree)).toContain('Enregistrer');
  });
});
