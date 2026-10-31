import renderer, { act } from 'react-test-renderer';

import {
  chercherUnSport,
  choisirLeSport,
  lignesDeSport,
  POPULAIRES_EN_TETE,
  SPORTS_A09,
} from '../../../testSupport/temoinChoixDuSport';
import MercatoFilters from '../MercatoFilters';

// LISTE-ANNONCES (A09, 30/09) — LE FILET DE L'ÉCRAN PLEIN `MercatoFilters` (E6).
//
// Ce fichier n'avait AUCUN test. L'écran reste atteint depuis « Mes alertes » (créer ou modifier
// une alerte de PROFILS). Les deux premiers blocs DÉCRIVENT le comportement constaté le 30/09
// (ce qui part dans `mercatoFilters`) ; le bloc A09 est la décision d'Adel : le choix du sport
// commun à toute la recherche (populaires en haut, puis la recherche).

jest.setTimeout(30000);

/** @type {any} CORR-EVENEMENTS 134 : les paramètres de la route, et le profil connecté. */
let mockRouteParams = {};
/** @type {any} */
let mockUserData = null;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
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
    default: (/** @type {any} */ { placeholder, setValue }) => (
      <View placeholder={placeholder} setValue={setValue} testID="select" />
    ),
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { address, setAddress }) => (
      <View address={address} setAddress={setAddress} testID="adresse" />
    ),
  };
});

jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <View testID="rayon" />,
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

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'gh' }),
}));

jest.mock('@/services/searchAlert/searchAlertService', () => ({
  createSearchAlert: jest.fn(),
  getPreviewCount: jest.fn(),
  getSearchAlerts: jest.fn(),
  updateSearchAlert: jest.fn(),
}));

const mockSections = { data: [] };
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => mockSections,
}));

const mockDispatch = jest.fn();
let mockMercatoFilters = /** @type {any} */ ({});
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ mercatoFilters: mockMercatoFilters }, mockDispatch],
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
 * Le sélecteur qui porte ce texte d'exemple.
 * @param {any} tree L'arbre rendu.
 * @param {string} placeholder Le texte d'exemple.
 * @returns {any} Le sélecteur, ou undefined.
 */
const selecteur = (tree, placeholder) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.testID === 'select'
    && node.props?.placeholder === placeholder,
  { deep: false },
)[0];

const POSTE = 'Ex: Attaquant, Gardien...';

/**
 * Monte l'écran plein des filtres de profils.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<MercatoFilters navigation={/** @type {any} */ (navigation)} />);
  });
  return tree;
};

beforeEach(() => {
  mockRouteParams = {};
  mockUserData = null;
  mockDispatch.mockClear();
  mockMercatoFilters = {};
  mockSports = SPORTS_PAR_DEFAUT;
});

describe('MercatoFilters (écran plein) — ce qu il propose, au 30/09', () => {
  it('LE TÉMOIN : sport, catégorie, deux boutons ; le poste attend un sport', async () => {
    const tree = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Sport');
    expect(texte).toContain('Catégorie');
    expect(texte).toContain('Effacer les filtres');
    expect(texte).toContain('Appliquer les filtres');
    expect(selecteur(tree, POSTE)).toBeUndefined();
  });
});

describe('MercatoFilters (écran plein) — ce qui part à la recherche', () => {
  it('LE TÉMOIN : sans rien choisir, les listes partent vides', async () => {
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer les filtres');

    const { payload, type } = mockDispatch.mock.calls[0][0];
    expect(type).toBe('SET_MERCATO_FILTERS');
    expect(payload.activityIds).toEqual([]);
    expect(payload.activityNames).toEqual([]);
  });

  it('le sport choisi part en identifiants ET en noms, et ouvre le poste', async () => {
    const tree = await rendre();

    // A09 — le sport se coche par sa LIGNE dans le choix commun.
    await choisirLeSport(tree, 'Football');
    expect(selecteur(tree, POSTE)).toBeDefined();
    await appuyerSur(tree, 'Appliquer les filtres');

    const { payload } = mockDispatch.mock.calls[0][0];
    expect(payload.activityIds).toEqual(['a-1']);
    expect(payload.activityNames).toEqual(['Football']);
  });

  it('changer de sport remet le poste à zéro', async () => {
    mockMercatoFilters = { activity: ['a-1'], position: ['Gardien'] };
    const tree = await rendre();

    // A09 — décocher le sport par sa LIGNE dans le choix commun.
    await choisirLeSport(tree, 'Football');
    await appuyerSur(tree, 'Appliquer les filtres');

    expect(mockDispatch.mock.calls[0][0].payload.positions).toEqual([]);
  });

  it('« Effacer les filtres » vide TOUT', async () => {
    mockMercatoFilters = { activity: ['a-1'] };
    const tree = await rendre();

    await appuyerSur(tree, 'Effacer les filtres');

    expect(mockDispatch).toHaveBeenCalledWith({ payload: {}, type: 'SET_MERCATO_FILTERS' });
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
    await appuyerSur(tree, 'Appliquer les filtres');
    const { payload } = mockDispatch.mock.calls[0][0];
    expect(payload.activityIds).toEqual(['a-equit']);
    expect(payload.activityNames).toEqual(['Équitation']);
  });
});

// CORR-EVENEMENTS point 134 (recette du site, 30/10) — en créant une alerte, le champ Ville
// affichait « Marseille », qui n'est qu'un exemple, et l'envoi était refusé. Décision A :
// préremplir la ville du profil.
describe('CORR-EVENEMENTS 134 — l alerte part avec la ville du profil', () => {
  const VILLE = { label: 'Lyon 69003', value: '4.85|45.76' };
  const adresse = (/** @type {any} */ tree) => tree.root.findAll(
    (/** @type {any} */ node) => node.props?.testID === 'adresse' && typeof node.props?.setAddress === 'function',
  )[0];

  it('🐞 création d une alerte : la ville du profil est déjà remplie', async () => {
    mockRouteParams = { createAlertMode: true };
    mockUserData = { address: VILLE, documentId: 'dirigeant-1' };
    const tree = await rendre();

    expect(adresse(tree).props.address).toEqual(VILLE);
  });

  it('sans ville au profil : le champ reste vide', async () => {
    mockRouteParams = { createAlertMode: true };
    mockUserData = { documentId: 'dirigeant-1' };
    const tree = await rendre();

    expect(adresse(tree).props.address?.value || '').toBe('');
  });

  it('une ville déjà choisie dans la recherche garde la priorité', async () => {
    mockRouteParams = { createAlertMode: true };
    mockUserData = { address: VILLE, documentId: 'dirigeant-1' };
    mockMercatoFilters = { city: { label: 'Marseille 13001', value: '5.37|43.29' } };
    const tree = await rendre();

    expect(adresse(tree).props.address?.label).toBe('Marseille 13001');
  });
});
