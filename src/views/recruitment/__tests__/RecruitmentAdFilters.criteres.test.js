import renderer, { act } from 'react-test-renderer';

import {
  chercherUnSport,
  choisirLeSport,
  lignesDeSport,
  POPULAIRES_EN_TETE,
  SPORTS_A09,
} from '../../../testSupport/temoinChoixDuSport';
import RecruitmentAdFilters from '../RecruitmentAdFilters';

// LISTE-ANNONCES (A09, 01/10) — LE FILET DE L'ÉCRAN PLEIN `RecruitmentAdFilters` (E6).
//
// Ce fichier n'avait AUCUN test. Aucun bouton de l'app n'ouvre plus cet écran, mais il reste
// enregistré et atteignable sur le SITE par son adresse (`/recruitment/filters`). Les deux premiers
// blocs DÉCRIVENT le comportement constaté (ce qui part dans `recruitmentAdFilters`) ; le bloc A09
// est la décision d'Adel : le choix du sport commun à toute la recherche.

jest.setTimeout(30000);

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity>
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChangeText, placeholder, value }) => (
      <TextInput onChangeText={onChangeText} placeholder={placeholder} value={value} />
    ),
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { label, setValue }) => (
      <View label={label} setValue={setValue} testID="select" />
    ),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

// Le `t` marche sur le VRAI dictionnaire : les libellés comparés sont ceux qu'on lit.
jest.mock('react-i18next', () => {
  const fr = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {string} */ repli) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ morceau) => (
            noeud === undefined || noeud === null ? undefined : noeud[morceau]
          ),
          fr,
        );
        return typeof valeur === 'string' ? valeur : (repli || cle);
      },
    }),
  };
});

const mockVide = { data: [] };
jest.mock('@/services/section/sectionQueries', () => ({ useGetSections: () => mockVide }));
jest.mock('@/services/category/categoryQueries', () => ({ useGetCategories: () => mockVide }));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => mockVide }));

const mockDispatch = jest.fn();
let mockRecruitmentAdFilters = /** @type {any} */ ({});
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ recruitmentAdFilters: mockRecruitmentAdFilters }, mockDispatch],
}));

const SPORTS_PAR_DEFAUT = [{ documentId: 'a-1', name: 'Football' }];
let mockSports = /** @type {any[]} */ (SPORTS_PAR_DEFAUT);
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: mockSports }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: espaces,
    }),
  };
});

/**
 * Ramasse toutes les chaînes d'un arbre rendu.
 * @param {any} node Le nœud.
 * @returns {string[]} Les chaînes.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};

const texteVisible = (/** @type {any} */ tree) => collecterTexte(tree.toJSON()).join(' | ');

/**
 * Le texte d'un nœud et de ses descendants.
 * @param {any} node Le nœud.
 * @returns {string} Son texte.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
 * Appuie sur le premier élément pressable qui porte exactement ce libellé.
 * @param {any} tree L'arbre rendu.
 * @param {string} libelle Le texte du bouton.
 * @returns {Promise<void>} Rien.
 */
const appuyerSur = async (tree, libelle) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
    ),
    { deep: true },
  );
  if (cibles.length === 0) throw new Error(`Aucun bouton « ${libelle} »`);
  await act(async () => {
    cibles[0].props.onPress();
  });
  // `handleSubmit` de react-hook-form valide en asynchrone.
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/**
 * Le sélecteur qui porte cet intitulé.
 * @param {any} tree L'arbre rendu.
 * @param {string} label L'intitulé.
 * @returns {any} Le sélecteur, ou undefined.
 */
const selecteur = (tree, label) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.testID === 'select' && node.props?.label === label,
  { deep: false },
)[0];

/**
 * Monte l'écran plein des filtres d'annonces.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<RecruitmentAdFilters navigation={/** @type {any} */ (navigation)} />);
  });
  return tree;
};

beforeEach(() => {
  mockDispatch.mockClear();
  mockRecruitmentAdFilters = {};
  mockSports = SPORTS_PAR_DEFAUT;
});

describe('RecruitmentAdFilters (écran plein) — ce qu il propose, au 01/10', () => {
  it('LE TÉMOIN : le sport, et les deux boutons', async () => {
    const tree = await rendre();
    const texte = texteVisible(tree);

    // A09 (01/10) : le Sport est le choix commun à toute la recherche, plus un sélecteur.
    expect(selecteur(tree, 'Sport')).toBeUndefined();
    expect(texte).toContain('Sport');
    expect(lignesDeSport(tree)[0]).toBe('Tous les sports');
    expect(texte).toContain('Effacer');
    expect(texte).toContain('Appliquer');
  });
});

describe('RecruitmentAdFilters (écran plein) — ce qui part à la recherche', () => {
  it('LE TÉMOIN : sans rien choisir, les 6 clefs partent vides', async () => {
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer');

    expect(mockDispatch).toHaveBeenCalledWith({
      payload: {
        category: [], city: '', level: [], position: '', section: '', sport: '',
      },
      type: 'SET_RECRUITMENT_AD_FILTERS',
    });
  });

  it('le sport part par son NOM', async () => {
    const tree = await rendre();

    // A09 — le sport se choisit par sa LIGNE dans le choix commun.
    await choisirLeSport(tree, 'Football');
    await appuyerSur(tree, 'Appliquer');

    expect(mockDispatch.mock.calls[0][0].payload.sport).toBe('Football');
  });

  it('« Effacer » vide TOUT', async () => {
    mockRecruitmentAdFilters = { sport: 'Football' };
    const tree = await rendre();

    await appuyerSur(tree, 'Effacer');

    expect(mockDispatch).toHaveBeenCalledWith({ payload: {}, type: 'SET_RECRUITMENT_AD_FILTERS' });
  });
});

describe('A09 — le sport : populaires en haut, recherche dans TOUS les sports', () => {
  it('populaires en tête (ordre d Adel), recherche sans accent, et le choix part', async () => {
    mockSports = [...SPORTS_A09];
    const tree = await rendre();

    expect(lignesDeSport(tree)).toEqual(POPULAIRES_EN_TETE);
    await chercherUnSport(tree, 'equit');
    expect(lignesDeSport(tree)).toEqual(['Équitation']);

    await choisirLeSport(tree, 'Équitation');
    await appuyerSur(tree, 'Appliquer');
    expect(mockDispatch.mock.calls[0][0].payload.sport).toBe('Équitation');
  });
});
