import renderer, { act } from 'react-test-renderer';

import ReservationFiltersSheet from '../ReservationFiltersSheet';

// D82 (E6) — LE FILET DU MARCHE RESERVATION.
//
// Le filet pose sur l'ecran plein
// (`src/views/reservation/__tests__/ReservationFilters.criteres.test.js`) a
// mesure ce qu'il deposait dans `reservationFilters` le 2026-08-12 :
// `activity`, `city`, `maxPrice` et `radius`, plus `geohash`, `lat` et `lon`
// des qu'une ville est choisie. La feuille doit deposer exactement la meme
// chose — c'est ce qui prouve qu'aucun critere ne s'est perdu.

jest.setTimeout(30000);

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

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="select" {...props} />,
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
 * Les intitules des rangees, dans l'ordre, lus sur leur libelle d'accessibilite.
 * @param {any} tree L'arbre rendu.
 * @returns {string[]} Les intitules.
 */
const intitulesDesRangees = (tree) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.props?.onPress === 'function'
    && typeof node.props?.accessibilityLabel === 'string'
    && node.props.accessibilityLabel.includes(' : '),
  { deep: false },
).map((/** @type {any} */ node) => String(node.props.accessibilityLabel).split(' : ')[0]);

/**
 * Deplie la rangee dont le libelle d'accessibilite commence par cet intitule.
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
 * Monte la feuille avec des espions sur ses deux sorties, `onApply` et
 * `onClose`, et rend le tout a l'appelant.
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
      <ReservationFiltersSheet
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

describe('ReservationFiltersSheet — la forme du pack', () => {
  it('LE TEMOIN : une feuille titree « Filtrer », 3 rangees, 2 actions', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Filtrer');
    expect(intitulesDesRangees(tree)).toEqual([
      'Sport', 'Ville', 'Prix maximum par personne',
    ]);
    expect(texte).toContain('Voir les résultats');
    expect(texte).toContain('Réinitialiser');
  });

  it('les mots de l ancien ecran plein ont disparu', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).not.toContain('Effacer les filtres');
    expect(texte).not.toContain('Appliquer');
  });

  it('sans filtre, les rangees lisent leur repli', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Tous les sports');
    expect(texte).toContain('Toutes les villes');
    expect(texte).toContain('Sans limite');
  });

  it('la valeur affichee est la selection REELLE, pas une valeur ecrite en dur', async () => {
    const { tree } = await rendre({
      filters: {
        activity: 'a-1', city: MARSEILLE, maxPrice: 50, radius: 30,
      },
    });
    const texte = texteVisible(tree);

    expect(texte).toContain('Football');
    expect(texte).toContain('Marseille · 30 km');
    expect(texte).toContain('50 €');
    expect(texte).not.toContain('Sans limite');
  });

  it('le rayon se lit dans la rangee Ville, il n a plus de rangee a lui', async () => {
    const { tree } = await rendre({ filters: { city: MARSEILLE, radius: 30 } });
    const rangees = tree.root.findAll(
      (/** @type {any} */ node) => typeof node.props?.accessibilityLabel === 'string'
        && node.props.accessibilityLabel.includes(' : '),
      { deep: true },
    ).map((/** @type {any} */ node) => node.props.accessibilityLabel);

    expect(rangees).toEqual(
      expect.arrayContaining([expect.stringContaining('Ville : Marseille · 30 km')]),
    );
    expect(rangees.some((/** @type {string} */ l) => l.startsWith('Rayon'))).toBe(false);
  });

  it('la rampe du rayon est celle de l ecran plein : 20 a 50 km, de 2 en 2', async () => {
    // Chaque marche a la sienne (l evenement part de 5, le club de 2). La
    // copier d une feuille a l autre changerait un filtre en silence.
    const { tree } = await rendre({ filters: { city: MARSEILLE } });

    await ouvrirRangee(tree, 'Ville');
    const curseur = trouver(tree, 'rayon');

    expect(curseur.props.minimumValue).toBe(20);
    expect(curseur.props.maximumValue).toBe(50);
    expect(curseur.props.step).toBe(2);
  });
});

describe('ReservationFiltersSheet — ce qu elle envoie a la recherche', () => {
  it('LE TEMOIN : elle depose les MEMES clefs que l ecran plein', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, radius: 30 } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply).toHaveBeenCalledTimes(1);
    const envoye = onApply.mock.calls[0][0];
    expect(Object.keys(envoye).sort()).toEqual([
      'activity', 'city', 'geohash', 'lat', 'lon', 'maxPrice', 'radius',
    ]);
    expect(envoye.city).toEqual(MARSEILLE);
    expect(envoye.radius).toBe(30);
    expect(envoye.lat).toBeCloseTo(43.2965);
    expect(envoye.lon).toBeCloseTo(5.3698);
    expect(envoye.geohash).toBe('gh(43.2965,5.3698,30)');
  });

  it('CE QUE L ECRAN PLEIN DETRUISAIT : le texte de la barre de recherche survit', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, q: 'padel' } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].q).toBe('padel');
  });

  it('elle ne detruit pas la pastille de sport de la liste (`activitySlug`)', async () => {
    const { onApply, tree } = await rendre({ filters: { activitySlug: 'padel' } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].activitySlug).toBe('padel');
  });

  it('le rayon reste REGLABLE, depuis la rangee Ville', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, radius: 30 } });

    await ouvrirRangee(tree, 'Ville');
    await act(async () => {
      trouver(tree, 'rayon').props.onValueChange(42);
    });

    expect(texteVisible(tree)).toContain('Marseille · 42 km');

    await appuyerSur(tree, 'Voir les résultats');
    expect(onApply.mock.calls[0][0].radius).toBe(42);
    expect(onApply.mock.calls[0][0].geohash).toBe('gh(43.2965,5.3698,42)');
  });

  it('le sport part en documentId SEUL, pas en tableau', async () => {
    const { onApply, tree } = await rendre();

    await ouvrirRangee(tree, 'Sport');
    await act(async () => {
      trouver(tree, 'select').props.setValue({ value: 'a-1' });
    });
    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].activity).toBe('a-1');
  });

  it('le prix maximum reste saisissable, depuis sa rangee', async () => {
    const { onApply, tree } = await rendre();

    await ouvrirRangee(tree, 'Prix maximum par personne');
    await act(async () => {
      trouver(tree, 'saisie').props.onChangeText('35');
    });

    expect(texteVisible(tree)).toContain('35 €');

    await appuyerSur(tree, 'Voir les résultats');
    expect(onApply.mock.calls[0][0].maxPrice).toBe('35');
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
      filters: { activity: 'a-1', city: MARSEILLE, q: 'padel' },
    });

    await appuyerSur(tree, 'Réinitialiser');

    expect(onApply).toHaveBeenCalledWith({});
    // Elle ne referme pas : l'utilisateur voit ses rangees redevenir vides.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rouverte, elle repart des filtres reellement appliques', async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    const filtres = { activity: 'a-1', city: MARSEILLE, radius: 30 };
    /** @type {any} */
    let tree;
    await act(async () => {
      tree = renderer.create(
        <ReservationFiltersSheet
          filters={filtres}
          isVisible={false}
          onApply={onApply}
          onClose={onClose}
        />,
      );
    });

    await act(async () => {
      tree.update(
        <ReservationFiltersSheet
          filters={filtres}
          isVisible
          onApply={onApply}
          onClose={onClose}
        />,
      );
    });

    const texte = texteVisible(tree);
    expect(texte).toContain('Football');
    expect(texte).toContain('Marseille · 30 km');
  });
});
