import renderer, { act } from 'react-test-renderer';

import EventFiltersSheet from '../EventFiltersSheet';

// D82 (E6) — LE FILET DU MARCHE EVENEMENT.
//
// Ce que ce filet garde, c'est la LISTE DES CRITERES qui partent a la
// recherche, pas la mise en page. Le filet pose sur l'ecran plein
// (`src/views/event/__tests__/EventFilters.criteres.test.js`) a mesure ce qu'il
// deposait dans `eventFilters` le 2026-08-12 : `activity`, `category`, `city`,
// `club`, `level`, `radius`, `team`, `teamIds`, `type`, plus `geohash`, `lat`
// et `lon` des qu'une ville est choisie. La feuille doit deposer exactement la
// meme chose — c'est ce qui prouve qu'aucun critere ne s'est perdu.

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
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'c-1', name: 'U13' }] }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'n-1', name: 'Régional 1' }] }),
}));
jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTypes: () => ({ data: [{ documentId: 't-1', name: 'Match' }] }),
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClubs: () => ({ data: { pages: [{ data: [{ documentId: 'cl-1', name: 'OM' }] }] } }),
}));
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({ data: { pages: [{ data: [{ documentId: 'eq-1', name: 'U13 A' }] }] } }),
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
      <EventFiltersSheet
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

const CLEFS_SANS_VILLE = [
  'activity', 'category', 'city', 'club', 'geohash', 'lat', 'level',
  'lon', 'radius', 'team', 'teamIds', 'type',
];

beforeEach(() => {
  mockGeohash.mockClear();
});

describe('EventFiltersSheet — la forme du pack', () => {
  it('LE TEMOIN : une feuille titree « Filtrer », 7 rangees, 2 actions', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Filtrer');
    expect(intitulesDesRangees(tree)).toEqual([
      'Sport', 'Ville', 'Catégorie', 'Niveau', "Type d'événement", 'Club', 'Équipe',
    ]);
    expect(texte).toContain('Voir les résultats');
    expect(texte).toContain('Réinitialiser');
  });

  it('les mots de l ancien ecran plein ont disparu', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).not.toContain('Effacer les filtres');
    expect(texte).not.toContain('Appliquer les filtres');
  });

  it('sans filtre, les rangees lisent leur repli', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Tous les sports');
    expect(texte).toContain('Toutes les villes');
    expect(texte).toContain('Toutes');
    expect(texte).toContain('Tous');
  });

  it('la valeur affichee est la selection REELLE, pas une valeur ecrite en dur', async () => {
    const { tree } = await rendre({
      filters: {
        activity: ['a-1'],
        category: ['c-1'],
        city: MARSEILLE,
        club: { label: 'OM', value: 'cl-1' },
        radius: 25,
      },
    });
    const texte = texteVisible(tree);

    expect(texte).toContain('Football');
    expect(texte).toContain('U13');
    expect(texte).toContain('OM');
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

    expect(rangees).toEqual(
      expect.arrayContaining([expect.stringContaining('Ville : Marseille · 25 km')]),
    );
    expect(rangees.some((/** @type {string} */ l) => l.startsWith('Rayon'))).toBe(false);
  });

  it('la rampe du rayon est celle de l ecran plein : 5 a 50 km, de 2 en 2', async () => {
    // Chaque marche a la sienne (le club va au kilometre pres depuis 2 km).
    // La copier d'une feuille a l'autre changerait un filtre en silence.
    const { tree } = await rendre({ filters: { city: MARSEILLE } });

    await ouvrirRangee(tree, 'Ville');
    const curseur = trouver(tree, 'rayon');

    expect(curseur.props.minimumValue).toBe(5);
    expect(curseur.props.maximumValue).toBe(50);
    expect(curseur.props.step).toBe(2);
  });
});

describe('EventFiltersSheet — ce qu elle envoie a la recherche', () => {
  it('LE TEMOIN : elle depose les MEMES clefs que l ecran plein', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, radius: 25 } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply).toHaveBeenCalledTimes(1);
    const envoye = onApply.mock.calls[0][0];
    expect(Object.keys(envoye).sort()).toEqual(CLEFS_SANS_VILLE);
    expect(envoye.city).toEqual(MARSEILLE);
    expect(envoye.radius).toBe(25);
    expect(envoye.lat).toBeCloseTo(43.2965);
    expect(envoye.lon).toBeCloseTo(5.3698);
    expect(envoye.geohash).toBe('gh(43.2965,5.3698,25)');
  });

  it('CE QUE L ECRAN PLEIN DETRUISAIT : le texte de la barre de recherche survit', async () => {
    const { onApply, tree } = await rendre({ filters: { city: MARSEILLE, q: 'tournoi' } });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].q).toBe('tournoi');
  });

  it('elle ne detruit pas non plus les bornes de dates, rangees dans la meme poche', async () => {
    const { onApply, tree } = await rendre({
      filters: { startDateAfter: '2026-09-01T00:00:00.000Z' },
    });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply.mock.calls[0][0].startDateAfter).toBe('2026-09-01T00:00:00.000Z');
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

  it('les 4 criteres a choix multiple partent en TABLEAU, comme avant', async () => {
    const { onApply, tree } = await rendre();

    /** @type {[string, string][]} */
    const choix = [
      ['Sport', 'a-1'],
      ['Catégorie', 'c-1'],
      ['Niveau', 'n-1'],
      ["Type d'événement", 't-1'],
    ];

    // Une rangee ouverte REPLIE la precedente : on ouvre, on choisit, on
    // referme, sinon le selecteur trouve n'est pas celui qu'on croit.
    for (let index = 0; index < choix.length; index += 1) {
      const [intitule, valeur] = choix[index];
      // eslint-disable-next-line no-await-in-loop
      await ouvrirRangee(tree, intitule);
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        trouver(tree, 'select').props.setValue([{ value: valeur }]);
      });
      // eslint-disable-next-line no-await-in-loop
      await ouvrirRangee(tree, intitule);
    }

    await appuyerSur(tree, 'Voir les résultats');

    const envoye = onApply.mock.calls[0][0];
    expect(envoye.activity).toEqual(['a-1']);
    expect(envoye.category).toEqual(['c-1']);
    expect(envoye.level).toEqual(['n-1']);
    expect(envoye.type).toEqual(['t-1']);
  });

  it('une equipe choisie voyage DEUX fois : `team` et `teamIds`', async () => {
    const { onApply, tree } = await rendre({ filters: { club: { label: 'OM', value: 'cl-1' } } });

    await ouvrirRangee(tree, 'Équipe');
    await act(async () => {
      trouver(tree, 'select').props.setValue({ label: 'U13 A', value: 'eq-1' });
    });
    await appuyerSur(tree, 'Voir les résultats');

    const envoye = onApply.mock.calls[0][0];
    expect(envoye.team).toEqual({ label: 'U13 A', value: 'eq-1' });
    expect(envoye.teamIds).toEqual(['eq-1']);
  });

  it('l equipe est FERMEE tant qu aucun club n est choisi, comme l ecran plein', async () => {
    const { tree } = await rendre();

    await ouvrirRangee(tree, 'Équipe');

    expect(trouver(tree, 'select').props.disabled).toBe(true);
  });

  it('changer de club remet l equipe a zero : elle appartenait a l autre', async () => {
    const { onApply, tree } = await rendre({
      filters: { club: { label: 'OM', value: 'cl-1' }, team: { label: 'U13 A', value: 'eq-1' } },
    });

    await ouvrirRangee(tree, 'Club');
    await act(async () => {
      trouver(tree, 'select').props.setValue({ label: 'OL', value: 'cl-2' });
    });
    await appuyerSur(tree, 'Voir les résultats');

    const envoye = onApply.mock.calls[0][0];
    expect(envoye.club).toEqual({ label: 'OL', value: 'cl-2' });
    expect(envoye.team).toBeNull();
    expect(envoye.teamIds).toBeNull();
  });

  it('sans ville, aucune zone n est calculee — pas de geohash fabrique sur des NaN', async () => {
    const { onApply, tree } = await rendre({ filters: { activity: ['a-1'] } });

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
      filters: { activity: ['a-1'], city: MARSEILLE, q: 'tournoi' },
    });

    await appuyerSur(tree, 'Réinitialiser');

    expect(onApply).toHaveBeenCalledWith({});
    // Elle ne referme pas : l'utilisateur voit ses rangees redevenir vides.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('CE QUE L ECRAN PLEIN OUBLIAIT : rouverte, elle raffiche le sport applique', async () => {
    // L'ecran plein ECRIVAIT `activity` mais RELISAIT `activities` : le sport
    // choisi ne revenait jamais. La feuille relit la clef qu'elle ecrit.
    const onApply = jest.fn();
    const onClose = jest.fn();
    const filtres = { activity: ['a-1'], city: MARSEILLE, radius: 25 };
    /** @type {any} */
    let tree;
    await act(async () => {
      tree = renderer.create(
        <EventFiltersSheet
          filters={filtres}
          isVisible={false}
          onApply={onApply}
          onClose={onClose}
        />,
      );
    });

    await act(async () => {
      tree.update(
        <EventFiltersSheet
          filters={filtres}
          isVisible
          onApply={onApply}
          onClose={onClose}
        />,
      );
    });

    const texte = texteVisible(tree);
    expect(texte).toContain('Football');
    expect(texte).toContain('Marseille · 25 km');
  });
});
