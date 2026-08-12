import renderer, { act } from 'react-test-renderer';

import ClubFiltersSheet from '../ClubFiltersSheet';

// D69 (E6) — LE FILET DU MARCHE CLUB.
//
// Ce que ce filet garde, c'est la LISTE DES CRITERES qui partent a la
// recherche, pas la mise en page : l'ecran plein `ClubFilters` deposait
// `activity`, `city`, `radius`, `geohash`, `lat` et `lon` dans `clubFilters`,
// et laissait passer `name` (le texte de la barre de recherche, range dans la
// MEME poche). La feuille doit deposer exactement la meme chose.
//
// ⚠️ `ClubFilters` n'avait AUCUN test avant ce lot : ces lignes decrivent le
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

// Les deux selecteurs ouvrent leur propre feuille et interrogent le reseau :
// hors sujet. On garde ce qui compte — leur maniere de RENDRE une valeur.
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
  }),
}));

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
      <ClubFiltersSheet
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

describe('ClubFiltersSheet — la forme du pack', () => {
  it('LE TEMOIN : une feuille titree « Filtrer », 2 rangees, 2 actions', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Filtrer');
    expect(texte).toContain('Sport');
    expect(texte).toContain('Ville');
    expect(texte).toContain('Voir les résultats');
    expect(texte).toContain('Réinitialiser');
  });

  it('sans filtre, les rangees lisent leur repli', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Tous les sports');
    expect(texte).toContain('Toutes les villes');
  });

  it('la valeur affichee est la selection REELLE, pas une valeur ecrite en dur', async () => {
    const { tree } = await rendre({
      filters: { activity: 'a-1', city: MARSEILLE, radius: 25 },
    });
    const texte = texteVisible(tree);

    expect(texte).toContain('Football');
    expect(texte).toContain('Marseille · 25 km');
    expect(texte).not.toContain('Tous les sports');
  });

  it('le rayon se lit dans la rangee Ville, il n a plus de rangee a lui', async () => {
    const { tree } = await rendre({ filters: { city: MARSEILLE, radius: 25 } });
    const rangees = tree.root.findAll(
      (/** @type {any} */ node) => typeof node.props?.accessibilityLabel === 'string'
        && node.props.accessibilityLabel.includes(' : '),
      { deep: true },
    ).map((/** @type {any} */ node) => node.props.accessibilityLabel);

    expect(rangees).toEqual(expect.arrayContaining([expect.stringContaining('Ville : Marseille · 25 km')]));
    expect(rangees.some((/** @type {string} */ l) => l.startsWith('Rayon'))).toBe(false);
  });
});

describe('ClubFiltersSheet — ce qu elle envoie a la recherche', () => {
  it('LE TEMOIN : elle depose les MEMES clefs que l ecran plein', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, radius: 25 } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply).toHaveBeenCalledTimes(1);
    const envoye = onApply.mock.calls[0][0];
    expect(Object.keys(envoye).sort()).toEqual(
      ['activity', 'city', 'geohash', 'lat', 'lon', 'radius'],
    );
    expect(envoye.city).toEqual(MARSEILLE);
    expect(envoye.radius).toBe(25);
    expect(envoye.lat).toBeCloseTo(43.2965);
    expect(envoye.lon).toBeCloseTo(5.3698);
    expect(envoye.geohash).toBe('gh(43.2965,5.3698,25)');
  });

  it('elle ne detruit PAS le texte de la barre de recherche, range dans la meme poche', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, name: 'OM' } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].name).toBe('OM');
  });

  it('le rayon reste REGLABLE, depuis la rangee Ville', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, radius: 25 } });

    await ouvrirRangee(tree, 'Ville');
    await act(async () => {
      trouver(tree, 'rayon').props.onValueChange(42);
    });

    expect(texteVisible(tree)).toContain('Marseille · 42 km');

    await appuyerSur(tree, 'Voir les résultats');
    expect(onApply.mock.calls[0][0].radius).toBe(42);
    expect(onApply.mock.calls[0][0].geohash).toBe('gh(43.2965,5.3698,42)');
  });

  it('le sport choisi part bien en critere', async () => {
    const { onApply, tree } = await rendre();

    await ouvrirRangee(tree, 'Sport');
    await act(async () => {
      trouver(tree, 'select').props.setValue({ value: 'a-1' });
    });
    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].activity).toBe('a-1');
  });

  it('sans ville, aucune zone n est calculee — pas de geohash fabrique sur des NaN', async () => {
    const { onApply, tree } = await rendre({ filters: { activity: 'a-1' } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(mockGeohash).not.toHaveBeenCalled();
    expect(onApply.mock.calls[0][0].geohash).toBeUndefined();
    expect(onApply.mock.calls[0][0].lat).toBeUndefined();
  });

  it('« Voir les résultats » referme la feuille', async () => {
    const { onClose, tree } = await rendre();
    await appuyerSur(tree, 'Voir les résultats');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('« Réinitialiser » vide TOUT, comme « Effacer les filtres » avant lui', async () => {
    const { onApply, onClose, tree } = await rendre({
      filters: { activity: 'a-1', city: MARSEILLE, name: 'OM' },
    });

    await appuyerSur(tree, 'Réinitialiser');

    expect(onApply).toHaveBeenCalledWith({});
    // Elle ne referme pas : l'utilisateur voit ses rangees redevenir vides.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rouverte, elle repart des filtres reellement appliques', async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    /** @type {any} */
    let tree;
    await act(async () => {
      tree = renderer.create(
        <ClubFiltersSheet
          filters={{ city: MARSEILLE, radius: 25 }}
          isVisible={false}
          onApply={onApply}
          onClose={onClose}
        />,
      );
    });

    await act(async () => {
      tree.update(
        <ClubFiltersSheet
          filters={{ city: MARSEILLE, radius: 25 }}
          isVisible
          onApply={onApply}
          onClose={onClose}
        />,
      );
    });

    expect(texteVisible(tree)).toContain('Marseille · 25 km');
  });
});
