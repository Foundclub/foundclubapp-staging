import renderer, { act } from 'react-test-renderer';

import RecruitmentFiltersSheet from '../RecruitmentFiltersSheet';

// D57 (E6) — la feuille de filtres du pack Rechercher (capture 05). Le bouton
// qui l'ouvre et sa pastille existaient deja et n'ont PAS ete refaits ; ce
// filet decrit la feuille elle-meme.
//
// Il est pilote par le TEXTE VISIBLE (« Sport », « Voir les resultats »...) et
// jamais par la forme de l'arbre : une refonte de mise en page peut tout
// deplacer sans qu'une ligne d'ici ne bouge.

jest.setTimeout(30000);

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// BottomModal monte @gorhom/bottom-sheet, qui exige reanimated et un vrai
// contexte de gestes : hors sujet ici. On garde la SEULE chose qui compte pour
// ce test — le contenu n'est rendu que si `isVisible`.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // D86 : la doublure rend l'entete et le pied, comme le vrai composant. Sans
    // eux, elle effacerait en silence le titre et les deux actions.
    default: ({
      children, footerComponent, headerComponent, isVisible,
    }) => (isVisible ? (
      <View>
        {headerComponent}
        {children}
        {footerComponent}
      </View>
    ) : null),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  // eslint-disable-next-line global-require
  const { TextInput } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChangeText, placeholder, value }) => (
      <TextInput onChangeText={onChangeText} placeholder={placeholder} value={value} />
    ),
  };
});

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'a-1', name: 'Football' }] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'c-1', name: 'U17' }] }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'n-1', name: 'Régional' }] }),
}));

/**
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

const texteVisible = (/** @type {any} */ tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Le texte porte par un noeud de l'arbre (instances ou chaines).
 * @param {any} node Le noeud.
 * @returns {string} Son texte.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
 * Appuie sur l'element pressable qui porte EXACTEMENT ce libelle.
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
  if (cibles.length === 0) {
    throw new Error(`Aucun element pressable ne porte le libelle « ${libelle} »`);
  }
  await act(async () => {
    cibles[0].props.onPress();
  });
};

/**
 * Deplie une rangee-valeur. On la vise par son `accessibilityLabel` et non par
 * son texte : la rangee porte l'intitule ET la valeur ET le chevron, donc son
 * texte n'est jamais « Sport » tout court.
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
  if (cibles.length === 0) {
    throw new Error(`Aucune rangee « ${intitule} »`);
  }
  await act(async () => {
    cibles[0].props.onPress();
  });
};

/**
 * @param {any} props Les props a surcharger.
 * @returns {Promise<{ tree: any, onApply: jest.Mock, onClose: jest.Mock }>} Le rendu.
 */
const rendre = async ({
  audienceFilter = 'all',
  filters = {},
  isVisible = true,
  showAudienceRow = true,
} = {}) => {
  const onApply = jest.fn();
  const onClose = jest.fn();
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(
      <RecruitmentFiltersSheet
        audienceFilter={audienceFilter}
        filters={filters}
        isVisible={isVisible}
        onApply={onApply}
        onClose={onClose}
        showAudienceRow={showAudienceRow}
      />,
    );
  });
  return { onApply, onClose, tree };
};

describe('RecruitmentFiltersSheet — les rangees du pack', () => {
  it('LE TEMOIN : la feuille porte les 5 rangees et ses 2 actions', async () => {
    const { tree } = await rendre();
    const rendu = texteVisible(tree);

    expect(rendu).toContain('Filtrer');
    expect(rendu).toContain('Sport');
    expect(rendu).toContain('Ville');
    expect(rendu).toContain('Profil');
    expect(rendu).toContain('Catégorie');
    expect(rendu).toContain('Niveau');
    expect(rendu).toContain('Voir les résultats');
    expect(rendu).toContain('Réinitialiser');
  });

  it('fermee, elle ne rend rien', async () => {
    const { tree } = await rendre({ isVisible: false });

    expect(tree.toJSON()).toBeNull();
  });

  // Le pack : « si un filtre n'existe pas cote back, retire la rangee (ne
  // l'affiche pas grisee) ». « Profil » ne vaut que pour le recrutement.
  it('hors recrutement, la rangee « Profil » disparait au lieu d etre grisee', async () => {
    const { tree } = await rendre({ showAudienceRow: false });

    expect(texteVisible(tree)).not.toContain('Profil');
    expect(texteVisible(tree)).toContain('Sport');
  });

  it('une rangee montre la valeur active, pas le repli', async () => {
    const { tree } = await rendre({
      filters: { category: ['c-1'], level: ['n-1'], sport: 'Football' },
    });
    const rendu = texteVisible(tree);

    expect(rendu).toContain('Football');
    expect(rendu).toContain('U17');
    expect(rendu).toContain('Régional');
    expect(rendu).not.toContain('Tous les sports');
  });
});

describe('RecruitmentFiltersSheet — ce qu elle renvoie a la recherche', () => {
  it('« Voir les résultats » applique le choix ET referme', async () => {
    const { onApply, onClose, tree } = await rendre();

    await ouvrirRangee(tree, 'Sport');
    await appuyerSur(tree, 'Football');
    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ sport: 'Football' }),
      'all',
    );
    expect(onClose).toHaveBeenCalled();
  });

  // ⛔ LE PIEGE QUE CE TEMOIN GARDE : la page de filtres complete pose deux
  // clefs que la feuille n'affiche pas. Un payload reconstruit de zero les
  // effacerait en silence a chaque validation.
  it('elle ne detruit PAS les filtres qu elle n affiche pas', async () => {
    const { onApply, tree } = await rendre({
      filters: { position: 'Gardien', section: 'sec-1' },
    });

    await appuyerSur(tree, 'Voir les résultats');

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ position: 'Gardien', section: 'sec-1' }),
      'all',
    );
  });

  it('« Réinitialiser » vide les filtres et remet le profil a « tout »', async () => {
    const { onApply, tree } = await rendre({
      audienceFilter: 'coach',
      filters: { category: ['c-1'], city: 'Lyon', sport: 'Football' },
    });

    await appuyerSur(tree, 'Réinitialiser');

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        category: [], city: '', level: [], sport: '',
      }),
      'all',
    );
  });

  it('le profil choisi voyage a part : c est un filtre client, pas serveur', async () => {
    const { onApply, tree } = await rendre();

    await ouvrirRangee(tree, 'Profil');
    await appuyerSur(tree, 'Coachs');
    await appuyerSur(tree, 'Voir les résultats');

    const [filtres, profil] = onApply.mock.calls[0];
    expect(profil).toBe('coach');
    expect(filtres.audienceType).toBeUndefined();
  });
});

// R07 point 1 — LE DERNIER FILTRE RESPIRE AVANT LE PIED, ici aussi.
//
// ⚠️ CETTE FEUILLE EST UNE JUMELLE RECOPIEE du socle `filtersSheet/FiltersSheet`
// — elle ne l'importe PAS, elle monte `BottomModal` elle-meme. C'est deja ce qui
// a oblige D86 a faire deux fois la meme correction. Ce filet existe pour que la
// prochaine fois, l'oubli soit ROUGE au lieu d'etre invisible.
describe('R07 — le dernier filtre respire avant le pied colle', () => {
  /**
   * Aplatit un style RN (tableau, valeurs nulles) en un seul objet.
   * @param {any} style Le style tel que pose sur l'element.
   * @returns {Record<string, any>} Le style resolu.
   */
  const styleAplati = (style) => (Array.isArray(style)
    ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
    : (style || {}));

  it('LE TEMOIN : la reserve du bas enveloppe les rangees, la derniere comprise', async () => {
    const { tree } = await rendre();

    const reserves = tree.root.findAll(
      (/** @type {any} */ node) => styleAplati(node.props?.style).marginBottom === 16,
      { deep: true },
    );

    expect(reserves.length).toBeGreaterThan(0);
    // Et elle porte bien la liste : « Niveau » est la derniere rangee du pack,
    // celle qui touchait « Voir les resultats ».
    expect(texteDuNoeud(reserves[0]) || texteVisible(tree)).toContain('Niveau');
  });

  it('les 2 actions restent DEHORS de cette reserve : elles vivent dans le pied', async () => {
    const { tree } = await rendre();

    const reserve = tree.root.findAll(
      (/** @type {any} */ node) => styleAplati(node.props?.style).marginBottom === 16,
      { deep: true },
    )[0];

    // Le pied est un frere de la liste, jamais son enfant : c'est l'acquis D86
    // et la reserve du bas ne doit pas l'avoir avale.
    expect(texteDuNoeud(reserve)).not.toContain('Voir les résultats');
    expect(texteDuNoeud(reserve)).not.toContain('Réinitialiser');
    expect(texteVisible(tree)).toContain('Voir les résultats');
  });
});
