import renderer, { act } from 'react-test-renderer';

import {
  chercherUnSport,
  choisirLeSport,
  lignesDeSport,
  POPULAIRES_EN_TETE,
  SPORTS_A09,
} from '../../../testSupport/temoinChoixDuSport';
import ClubFilters from '../ClubFilters';

// LISTE-ANNONCES (A09, 30/09) — LE FILET DE L'ÉCRAN PLEIN `ClubFilters` (E6).
//
// Ce fichier n'avait AUCUN test. L'écran reste atteint depuis la CARTE de Rechercher et depuis
// le guide d'affiliation (tutoriel). Les deux premiers blocs DÉCRIVENT le comportement constaté
// le 30/09 (ce qui part dans `clubFilters`) ; le bloc A09 est la décision d'Adel : le choix du
// sport commun à toute la recherche (populaires en haut, puis la recherche).

jest.setTimeout(30000);

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

// Le tutoriel d'affiliation : hors sujet ici, rendu transparent.
jest.mock('@/context/OnboardingContext', () => ({
  OnboardingProvider: (/** @type {any} */ { children }) => children,
  useOnboarding: () => ({ isActive: false, startOnboarding: () => {}, totalSteps: 0 }),
}));
jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));
jest.mock('@/components/molecules/onboardingOverlay/OnboardingOverlay', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/atoms/button/Button', () => {
  // eslint-disable-next-line global-require
  const { Text, TouchableOpacity } = require('react-native');
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

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { label, setAddress }) => (
      <View label={label} setAddress={setAddress} testID="adresse" />
    ),
  };
});

jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { maximumValue, minimumValue, step }) => (
      <View maximumValue={maximumValue} minimumValue={minimumValue} step={step} testID="rayon" />
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

const mockGeohash = jest.fn(
  (/** @type {number} */ lat, /** @type {number} */ lon, /** @type {number} */ rayon) => (
    `gh(${String(lat)},${String(lon)},${String(rayon)})`
  ),
);
jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: mockGeohash }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1' } }),
}));

const mockDispatch = jest.fn();
let mockClubFilters = /** @type {any} */ ({});
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ clubFilters: mockClubFilters }, mockDispatch],
}));

const SPORTS_PAR_DEFAUT = [{ documentId: 'a-1', name: 'Football' }];
let mockSports = /** @type {any[]} */ (SPORTS_PAR_DEFAUT);
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: mockSports, error: null, isLoading: false, refetch: () => {},
  }),
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
 * Le premier élément rendu sous ce testID.
 * @param {any} tree L'arbre rendu.
 * @param {string} testID L'identifiant.
 * @returns {any} L'élément.
 */
const trouver = (tree, testID) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.testID === testID,
  { deep: false },
)[0];

/** @type {any} */
let navigation;

/**
 * Monte l'écran plein des filtres de clubs.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  navigation = { goBack: jest.fn(), setOptions: jest.fn() };
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<ClubFilters navigation={navigation} route={{ params: {} }} />);
  });
  return tree;
};

const MARSEILLE = { label: 'Marseille', value: '5.3698|43.2965' };

beforeEach(() => {
  mockGeohash.mockClear();
  mockDispatch.mockClear();
  mockClubFilters = {};
  mockSports = SPORTS_PAR_DEFAUT;
});

describe('ClubFilters (écran plein) — ce qu il propose, au 30/09', () => {
  it('LE TÉMOIN : la ville, le rayon, le sport, et les deux boutons', async () => {
    const tree = await rendre();
    const texte = texteVisible(tree);

    expect(trouver(tree, 'adresse')).toBeDefined();
    expect(trouver(tree, 'rayon').props.minimumValue).toBe(2);
    // A09 (30/09) : le Sport est le choix commun à toute la recherche, plus un sélecteur.
    expect(texte).toContain('Sport');
    expect(lignesDeSport(tree)[0]).toBe('Tous les sports');
    expect(texte).toContain('Effacer les filtres');
    expect(texte).toContain('Appliquer les filtres');
  });
});

describe('ClubFilters (écran plein) — ce qui part à la recherche', () => {
  it('LE TÉMOIN : sans ville, les 4 champs du formulaire… et un geohash', async () => {
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer les filtres');

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const { payload, type } = mockDispatch.mock.calls[0][0];
    expect(type).toBe('SET_CLUB_FILTERS');
    expect(Object.keys(payload).sort()).toEqual(['activity', 'city', 'geohash', 'name', 'radius']);
    // ⚠️ LE DÉFAUT CONSTATÉ (30/09, hors du lot LISTE-ANNONCES) : sans ville, `''.split('|')`
    // rend `['']`, et une zone est fabriquée sur des NaN. La feuille « Filtrer »
    // (`ClubFiltersSheet`) l'a corrigé ; cet écran plein, non. Décrit ici, pas corrigé.
    expect(payload.geohash).toBe('gh(NaN,NaN,20)');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('LE TÉMOIN : avec une ville, il ajoute geohash, lat et lon', async () => {
    mockClubFilters = { city: MARSEILLE, radius: 30 };
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer les filtres');

    const { payload } = mockDispatch.mock.calls[0][0];
    expect(payload.geohash).toBe('gh(43.2965,5.3698,30)');
    expect(payload.lat).toBeCloseTo(43.2965);
    expect(payload.lon).toBeCloseTo(5.3698);
  });

  it('le sport choisi part en documentId seul', async () => {
    const tree = await rendre();

    // A09 — le sport se choisit par sa LIGNE dans le choix commun.
    await choisirLeSport(tree, 'Football');
    await appuyerSur(tree, 'Appliquer les filtres');

    expect(mockDispatch.mock.calls[0][0].payload.activity).toBe('a-1');
  });

  it('« Effacer les filtres » vide TOUT', async () => {
    mockClubFilters = { activity: 'a-1', city: MARSEILLE };
    const tree = await rendre();

    await appuyerSur(tree, 'Effacer les filtres');

    expect(mockDispatch).toHaveBeenCalledWith({ payload: {}, type: 'SET_CLUB_FILTERS' });
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
    expect(mockDispatch.mock.calls[0][0].payload.activity).toBe('a-equit');
  });
});
