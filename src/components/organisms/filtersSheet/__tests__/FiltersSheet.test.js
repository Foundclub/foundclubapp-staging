import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FiltersSheet from '../FiltersSheet';

// D69 (E6) — la COQUILLE de la feuille de filtres du pack Rechercher
// (capture 05). Ce filet decrit la forme que le pack impose et que trois
// marches partagent : une feuille titree « Filtrer », des rangees-valeur qui
// deplient leur choix sur place, « Voir les resultats » en plein puis
// « Reinitialiser » en texte seul.
//
// Il est pilote par le TEXTE VISIBLE et jamais par la forme de l'arbre : une
// refonte de mise en page peut tout deplacer sans qu'une ligne d'ici ne bouge.

jest.setTimeout(30000);

// BottomModal monte @gorhom/bottom-sheet, qui exige reanimated et un vrai
// contexte de gestes : hors sujet ici. On garde la SEULE chose qui compte —
// le contenu n'est rendu que si `isVisible`.
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
 * Le texte porte par un noeud de l'arbre.
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
 * Deplie une rangee-valeur. On la vise par son `accessibilityLabel` : son texte
 * porte l'intitule ET la valeur ET le chevron, donc il n'est jamais l'intitule
 * tout court.
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

const RANGEES = [
  {
    content: <Text>le choix du sport</Text>,
    key: 'sport',
    label: 'Sport',
    value: 'Tous les sports',
  },
  {
    content: <Text>le choix de la ville</Text>,
    key: 'city',
    label: 'Ville',
    value: 'Marseille · 25 km',
  },
];

/**
 * @param {any} props Les props a surcharger.
 * @returns {Promise<{ tree: any, onApply: jest.Mock, onClose: jest.Mock, onReset: jest.Mock }>} Le rendu.
 */
const rendre = async ({ isVisible = true, rows = RANGEES } = {}) => {
  const onApply = jest.fn();
  const onClose = jest.fn();
  const onReset = jest.fn();
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(
      <FiltersSheet
        isVisible={isVisible}
        onApply={onApply}
        onClose={onClose}
        onReset={onReset}
        rows={rows}
      />,
    );
  });
  return {
    onApply, onClose, onReset, tree,
  };
};

describe('FiltersSheet — la forme que le pack impose', () => {
  it('LE TEMOIN : une feuille titree « Filtrer », ses rangees et ses 2 actions', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).toContain('Filtrer');
    expect(texte).toContain('Sport');
    expect(texte).toContain('Tous les sports');
    expect(texte).toContain('Ville');
    expect(texte).toContain('Marseille · 25 km');
    expect(texte).toContain('Voir les résultats');
    expect(texte).toContain('Réinitialiser');
  });

  it('les mots de l ancien ecran plein ont disparu', async () => {
    const { tree } = await rendre();
    const texte = texteVisible(tree);

    expect(texte).not.toContain('Appliquer les filtres');
    expect(texte).not.toContain('Effacer les filtres');
  });

  it('fermee, elle ne rend rien', async () => {
    const { tree } = await rendre({ isVisible: false });
    expect(tree.toJSON()).toBeNull();
  });

  it('une rangee ne montre son choix qu une fois depliee', async () => {
    const { tree } = await rendre();
    expect(texteVisible(tree)).not.toContain('le choix du sport');

    await ouvrirRangee(tree, 'Sport');
    expect(texteVisible(tree)).toContain('le choix du sport');
  });

  it('deplier une rangee replie la precedente', async () => {
    const { tree } = await rendre();
    await ouvrirRangee(tree, 'Sport');
    await ouvrirRangee(tree, 'Ville');

    expect(texteVisible(tree)).toContain('le choix de la ville');
    expect(texteVisible(tree)).not.toContain('le choix du sport');
  });

  it('« Voir les résultats » et « Réinitialiser » appellent chacun le leur', async () => {
    const { onApply, onReset, tree } = await rendre();

    await appuyerSur(tree, 'Voir les résultats');
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();

    await appuyerSur(tree, 'Réinitialiser');
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('une rangee absente ne laisse aucune trace : le pack la RETIRE, il ne la grise pas', async () => {
    const { tree } = await rendre({ rows: [RANGEES[0]] });
    const texte = texteVisible(tree);

    expect(texte).toContain('Sport');
    expect(texte).not.toContain('Ville');
  });
});
