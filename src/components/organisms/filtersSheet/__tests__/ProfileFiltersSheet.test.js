import renderer, { act } from 'react-test-renderer';

import ProfileFiltersSheet from '../ProfileFiltersSheet';

// D69 (E6) — LE FILET DE LA RECHERCHE DE PROFILS (capture 05 du pack).
//
// Ce que ce filet garde, c'est la LISTE DES CRITERES qui partent a la
// recherche, pas la mise en page. L'ecran plein `MercatoFilters` deposait dans
// `mercatoFilters` un jeu de clefs REDONDANT, et cette redondance est
// structurelle : la liste lit `activityNames || activity`,
// `sectionIds || category` et `positions || position`. En oublier une moitie
// viderait le critere EN SILENCE.
//
// ⚠️ `MercatoFilters` n'avait AUCUN test avant ce lot : ces lignes decrivent le
// comportement constate le 2026-08-11, elles ne le redefinissent pas.

jest.setTimeout(30000);

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // D86 : la doublure rend l'entete et le pied, comme le vrai composant. Sans
    // eux, elle effacerait en silence le titre et les deux actions.
    default: (/** @type {any} */ { children, footerComponent, headerComponent, isVisible }) => (
      isVisible ? (
        <View>
          {headerComponent}
          {children}
          {footerComponent}
        </View>
      ) : null
    ),
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View testID="select" {...props} />,
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View testID="adresse" {...props} />,
  };
});

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View testID="rayon" {...props} />,
  };
});

// Le prefixe `mock` n'est pas cosmetique : jest hisse les fabriques de
// `jest.mock` au-dessus des declarations, et refuse toute autre variable.
const mockGeohash = jest.fn(
  (/** @type {number} */ lat, /** @type {number} */ lon, /** @type {number} */ rayon) => (
    `gh(${String(lat)},${String(lon)},${String(rayon)})`
  ),
);

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: mockGeohash }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'a-1', name: 'Football' }] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [{ documentId: 's-1', name: 'Seniors' }] }),
}));

jest.mock('@/constants/positions', () => ({
  getPositionValuesForSport: (/** @type {string} */ sport) => (
    sport === 'Football' ? ['Gardien', 'Ailier'] : []
  ),
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
 * @param {any} node Le noeud.
 * @returns {string} Son texte.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
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
 * @param {any} tree L'arbre rendu.
 * @param {string} intitule L'intitule de la rangee.
 * @returns {Promise<void>} Rien.
 */
const ouvrirRangee = async (tree, intitule) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function'
      && String(node.props?.accessibilityLabel || '').startsWith(`${intitule} : `)
    ),
    { deep: true },
  );
  if (cibles.length === 0) throw new Error(`Aucune rangee « ${intitule} »`);
  await act(async () => {
    cibles[0].props.onPress();
  });
};

/**
 * Les intitules des rangees actuellement rendues, dans l'ordre.
 *
 * ⚠️ Le dedoublonnage n'est pas cosmetique : `findAll({ deep: true })` rend A LA
 * FOIS le composant et la vue hote qu'il produit, donc chaque rangee remonte
 * deux fois.
 * @param {any} tree L'arbre rendu.
 * @returns {string[]} Les intitules.
 */
const rangees = (tree) => Array.from(new Set(tree.root.findAll(
  (/** @type {any} */ node) => typeof node.props?.accessibilityLabel === 'string'
    && node.props.accessibilityLabel.includes(' : ')
    && typeof node.props?.onPress === 'function',
  { deep: true },
).map((/** @type {any} */ node) => String(node.props.accessibilityLabel).split(' : ')[0])));

/**
 * Le premier element rendu sous ce testID.
 * @param {any} tree L'arbre rendu.
 * @param {string} testID L'identifiant.
 * @returns {any} L'element.
 */
const trouver = (tree, testID) => tree.root.findAll(
  (/** @type {any} */ node) => node.props?.testID === testID,
  { deep: true },
)[0];

/**
 * @param {any} props Les props a surcharger.
 * @returns {Promise<{ tree: any, onApply: jest.Mock, onClose: jest.Mock }>} Le rendu.
 */
const rendre = async ({ filters = {}, isVisible = true } = {}) => {
  const onApply = jest.fn();
  const onClose = jest.fn();
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(
      <ProfileFiltersSheet
        filters={filters}
        isVisible={isVisible}
        onApply={onApply}
        onClose={onClose}
      />,
    );
  });
  return { onApply, onClose, tree };
};

const MARSEILLE = { label: 'Marseille', value: '5.3698|43.2965' };

beforeEach(() => {
  mockGeohash.mockClear();
});

describe('ProfileFiltersSheet — la forme du pack (capture 05)', () => {
  it('LE TEMOIN : une feuille titree « Filtrer », ses rangees et ses 2 actions', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Filtrer');
    expect(texte).toContain('Voir les résultats');
    expect(texte).toContain('Réinitialiser');
    expect(rangees(tree)).toEqual(['Sport', 'Ville', 'Catégorie']);
  });

  it('sans filtre, les rangees lisent leur repli', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Tous les sports');
    expect(texte).toContain('Toutes les villes');
    expect(texte).toContain('Toutes');
  });

  it('la valeur affichee est la selection REELLE, pas une valeur ecrite en dur', async () => {
    const { tree } = await rendre({
      filters: {
        activity: ['a-1'], category: ['s-1'], city: MARSEILLE, radius: 25,
      },
    });
    const texte = texteVisible(tree);

    expect(texte).toContain('Football');
    expect(texte).toContain('Marseille · 25 km');
    expect(texte).toContain('Seniors');
  });

  it('« Poste » apparait quand un sport est choisi, et disparait sinon', async () => {
    const { tree } = await rendre();
    expect(rangees(tree)).not.toContain('Poste');

    const { tree: avecSport } = await rendre({ filters: { activity: ['a-1'] } });
    expect(rangees(avecSport)).toContain('Poste');
  });

  it('les rangees sans equivalent serveur sont ABSENTES, pas grisees', async () => {
    const { tree } = await rendre({ filters: { activity: ['a-1'] } });
    const intitules = rangees(tree);

    // Le pack les dessine, la recherche de profils ne les connait pas.
    expect(intitules).not.toContain('Profil');
    expect(intitules).not.toContain('Niveau');
  });
});

describe('ProfileFiltersSheet — ce qu elle envoie a la recherche', () => {
  it('LE TEMOIN : elle depose les clefs REDONDANTES que la liste sait lire', async () => {
    const { onApply, tree } = await rendre({
      filters: {
        activity: ['a-1'], category: ['s-1'], city: MARSEILLE, position: ['Ailier'], radius: 25,
      },
    });

    await appuyerSur(tree, 'Voir les résultats');

    const envoye = onApply.mock.calls[0][0];
    expect(envoye.activity).toEqual(['a-1']);
    expect(envoye.activityIds).toEqual(['a-1']);
    expect(envoye.activityNames).toEqual(['Football']);
    expect(envoye.category).toEqual(['s-1']);
    expect(envoye.sectionIds).toEqual(['s-1']);
    expect(envoye.position).toEqual(['Ailier']);
    expect(envoye.positions).toEqual(['Ailier']);
    expect(envoye.geohash).toBe('gh(43.2965,5.3698,25)');
    expect(envoye.radius).toBe(25);
  });

  it('elle ne detruit PAS le texte de la barre de recherche, range dans la meme poche', async () => {
    const { onApply, tree } = await rendre({ filters: { q: 'ailier gauche' } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].q).toBe('ailier gauche');
  });

  it('le rayon reste REGLABLE, depuis la rangee Ville', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, radius: 25 } });

    await ouvrirRangee(tree, 'Ville');
    await act(async () => {
      trouver(tree, 'rayon').props.onValueChange(42);
    });

    expect(texteVisible(tree)).toContain('Marseille · 42 km');

    await appuyerSur(tree, 'Voir les résultats');
    expect(onApply.mock.calls[0][0].geohash).toBe('gh(43.2965,5.3698,42)');
  });

  it('changer de sport remet le poste a zero, comme l ecran plein', async () => {
    const { onApply, tree } = await rendre({ filters: { activity: ['a-1'], position: ['Ailier'] } });

    await ouvrirRangee(tree, 'Sport');
    await act(async () => {
      trouver(tree, 'select').props.setValue([{ value: 'a-1' }]);
    });
    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].position).toEqual([]);
    expect(onApply.mock.calls[0][0].positions).toEqual([]);
  });

  it('sans ville, aucune zone n est calculee — pas de geohash fabrique sur des NaN', async () => {
    const { onApply, tree } = await rendre({ filters: { activity: ['a-1'] } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(mockGeohash).not.toHaveBeenCalled();
    expect(onApply.mock.calls[0][0].geohash).toBeUndefined();
  });

  it('« Voir les résultats » referme la feuille', async () => {
    const { onClose, tree } = await rendre();
    await appuyerSur(tree, 'Voir les résultats');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('« Réinitialiser » vide TOUT, comme « Effacer les filtres » avant lui', async () => {
    const { onApply, onClose, tree } = await rendre({
      filters: { activity: ['a-1'], city: MARSEILLE },
    });

    await appuyerSur(tree, 'Réinitialiser');

    expect(onApply).toHaveBeenCalledWith({});
    expect(onClose).not.toHaveBeenCalled();
  });
});
