import renderer, { act } from 'react-test-renderer';

import ReservationFilters from '../ReservationFilters';

// D82 (E6) — LE FILET DE L'ECRAN PLEIN `ReservationFilters`.
//
// Ce fichier n'avait AUCUN test avant ce lot. Ces lignes DECRIVENT le
// comportement constate le 2026-08-12, elles ne le redefinissent pas.
//
// Ce qu'elles figent : les 4 criteres proposes, la rampe du rayon (PROPRE a ce
// marche : 20 a 50 km de 2 en 2, la ou l'evenement part de 5 et le club de 2),
// et le payload exact depose dans `reservationFilters`.

jest.setTimeout(30000);

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
  };
});

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
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="saisie" {...props} />,
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="select" {...props} />,
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="adresse" {...props} />,
  };
});

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="rayon" {...props} />,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

// Le `t` marche sur le VRAI dictionnaire : les libelles compares plus bas sont
// ceux que l'utilisateur lit, pas des clefs techniques.
jest.mock('react-i18next', () => {
  const fr = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    // `@/theme/strings` branche i18next avec ce greffon : le retirer ferait
    // mourir la suite sur « undefined module », loin du sujet.
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

const mockDispatch = jest.fn();
let mockReservationFilters = /** @type {any} */ ({});

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ reservationFilters: mockReservationFilters }, mockDispatch],
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'a-1', name: 'Football' }] }),
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
 * Ramasse toutes les chaines d'un arbre rendu, en descendant ses enfants.
 * @param {any} node Le noeud.
 * @returns {string[]} Les chaines qu'il porte.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};

const texteVisible = (/** @type {any} */ tree) => collecterTexte(tree.toJSON()).join(' | ');

/**
 * Recolle en une seule chaine le texte d'un noeud et de ses descendants.
 * @param {any} node Le noeud.
 * @returns {string} Son texte.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
 * Appuie sur le premier element pressable dont le texte est exactement ce
 * libelle, et jette si aucun ne porte ce mot.
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
};

/**
 * Le premier element rendu sous ce testID, sans doublon : `findAll` remonte a
 * la fois l'element composite et son hote.
 * @param {any} tree L'arbre rendu.
 * @param {string} testID L'identifiant.
 * @returns {any} L'element.
 */
const trouver = (tree, testID) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.testID === testID,
  { deep: false },
)[0];

/**
 * Monte l'ecran plein des filtres de reservation avec une navigation espionnee.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  const navigation = /** @type {any} */ ({ goBack: jest.fn(), setOptions: jest.fn() });
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<ReservationFilters navigation={navigation} />);
  });
  return tree;
};

const MARSEILLE = { label: 'Marseille', value: '5.3698|43.2965' };

beforeEach(() => {
  mockGeohash.mockClear();
  mockDispatch.mockClear();
  mockReservationFilters = {};
});

describe('ReservationFilters (ecran plein) — les criteres, au 2026-08-12', () => {
  it('LE TEMOIN : 4 criteres, et les deux boutons de l ancien pack', async () => {
    const tree = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Ville');
    expect(trouver(tree, 'adresse')).toBeDefined();
    expect(texte).toContain('Dans un rayon autour de : 20km');
    expect(trouver(tree, 'select').props.label).toBe('Sport');
    expect(trouver(tree, 'saisie').props.label).toBe('Prix maximum par personne');

    expect(texte).toContain('Effacer les filtres');
    expect(texte).toContain('Appliquer');
  });

  it('la rampe du rayon est PROPRE a ce marche : 20 a 50 km, de 2 en 2', async () => {
    const tree = await rendre();
    const curseur = trouver(tree, 'rayon');

    expect(curseur.props.minimumValue).toBe(20);
    expect(curseur.props.maximumValue).toBe(50);
    expect(curseur.props.step).toBe(2);
  });
});

describe('ReservationFilters (ecran plein) — ce qui part a la recherche', () => {
  it('LE TEMOIN : le payload sans ville porte les 4 criteres', async () => {
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer');

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const { payload, type } = mockDispatch.mock.calls[0][0];
    expect(type).toBe('SET_RESERVATION_FILTERS');
    expect(Object.keys(payload).sort()).toEqual(['activity', 'city', 'maxPrice', 'radius']);
    expect(payload.radius).toBe(20);
  });

  it('LE TEMOIN : avec une ville, il ajoute geohash, lat et lon', async () => {
    mockReservationFilters = { city: MARSEILLE, radius: 30 };
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer');

    const { payload } = mockDispatch.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      'activity', 'city', 'geohash', 'lat', 'lon', 'maxPrice', 'radius',
    ]);
    expect(payload.lat).toBeCloseTo(43.2965);
    expect(payload.lon).toBeCloseTo(5.3698);
    expect(payload.geohash).toBe('gh(43.2965,5.3698,30)');
  });

  it('le sport part en documentId SEUL, pas en tableau', async () => {
    const tree = await rendre();

    await act(async () => {
      trouver(tree, 'select').props.setValue({ value: 'a-1' });
    });
    await appuyerSur(tree, 'Appliquer');

    expect(mockDispatch.mock.calls[0][0].payload.activity).toBe('a-1');
  });

  it('« Effacer les filtres » vide TOUT', async () => {
    mockReservationFilters = { activity: 'a-1', city: MARSEILLE, q: 'padel' };
    const tree = await rendre();

    await appuyerSur(tree, 'Effacer les filtres');

    expect(mockDispatch).toHaveBeenCalledWith({ payload: {}, type: 'SET_RESERVATION_FILTERS' });
  });

  it('LE DEFAUT CONSTATE : le texte de la barre de recherche (`q`) est DETRUIT', async () => {
    // Meme defaut que sur l'ecran plein des evenements : le payload est
    // reconstruit a partir du seul formulaire, et `q` vit dans la MEME poche.
    mockReservationFilters = { city: MARSEILLE, q: 'padel' };
    const tree = await rendre();

    await appuyerSur(tree, 'Appliquer');

    expect(mockDispatch.mock.calls[0][0].payload.q).toBeUndefined();
  });
});
