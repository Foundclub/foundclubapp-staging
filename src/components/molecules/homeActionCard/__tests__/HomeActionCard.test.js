import { Image, Pressable, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import HomeActionCard from '../HomeActionCard';

// Filet du lot L10-C (docs/STRATEGIE_PAYWALL_2026_08_01.md §2.3) : c'est CETTE
// carte qui rend le grisage des points d'entree du hub. La regle interdit deux
// choses en meme temps — griser en silence (sans etiquette) et griser mort
// (sans appui). Elle doit donc etre pale ET pressable, l'appui menant a la
// vente. Ce fichier n'avait aucun test (regle E6).

jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : n'importe quelle cle rend un objet vide.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: {
        neutral00: 'encre-claire',
        neutral200: 'neutre-200',
        primary500: 'couleur-primaire',
        primary700: 'couleur-surface',
        violet500: 'couleur-club',
      },
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

/**
 * Tous les textes rendus, aplatis.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Monte la carte « Ajouter un événement » du hub dans un etat donne.
 * @param {any} props
 * @returns {Promise<any>}
 */
const renderCard = async ({
  disabled = false,
  illustration = undefined,
  locked = false,
  onPress = jest.fn(),
  premiumScope = undefined,
}) => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <HomeActionCard
        disabled={disabled}
        illustration={illustration}
        locked={locked}
        onPress={onPress}
        premiumScope={premiumScope}
        subtitle="Publie un entrainement"
        title="Ajouter un événement"
      />,
    );
  });
  return tree;
};

/**
 * Le style applique par le Pressable racine, etat non presse.
 * @param {any} tree
 * @returns {any}
 */
const rootStyle = (tree) => {
  const style = tree.root.findByType(Pressable).props.style({ pressed: false });
  return (Array.isArray(style) ? style : [style])
    .reduce((/** @type {any} */ merged, /** @type {any} */ entry) => Object.assign(
      merged,
      entry || {},
    ), {});
};

describe('HomeActionCard — le grisage d un point d entree (L10-C)', () => {
  it('reste normale et pressable quand rien ne bloque', async () => {
    const onPress = jest.fn();
    const tree = await renderCard({ onPress });

    expect(rootStyle(tree).opacity).toBeUndefined();
    expect(tree.root.findByType(Pressable).props.disabled).toBe(false);

    await act(async () => { tree.root.findByType(Pressable).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('grise SANS couper l appui quand le quota est epuise', async () => {
    const onPress = jest.fn();
    const tree = await renderCard({ locked: true, onPress, premiumScope: 'team' });

    expect(rootStyle(tree).opacity).toBe(0.55);
    // C'est tout l'objet du lot : l'appui doit encore ouvrir la feuille de vente.
    expect(tree.root.findByType(Pressable).props.disabled).toBe(false);

    await act(async () => { tree.root.findByType(Pressable).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('affiche l etiquette de l offre — griser en silence est interdit', async () => {
    const tree = await renderCard({ locked: true, premiumScope: 'team' });

    expect(collectText(tree.toJSON()).join(' | ')).toContain('Offre Équipe');
  });

  it('laisse `disabled` couper l appui : c est un blocage d une autre nature', async () => {
    const onPress = jest.fn();
    const tree = await renderCard({ disabled: true, locked: true, onPress });

    // Publication non autorisee par le club : ni gris de quota, ni vente.
    expect(rootStyle(tree).opacity).toBe(0.5);
    expect(tree.root.findByType(Pressable).props.disabled).toBe(true);
  });
});

// D59 ① — Adel n'a pas les 5 dessins de fond (decision du 2026-08-09). Le repli
// ne doit donc plus etre une icone etiree : ces trois tests figent le cas « pas
// d'image » pour qu'un lot futur ne le reintroduise pas sans le voir.
describe('HomeActionCard — le repli quand aucune illustration n existe (D59 ①)', () => {
  // La carte porte exactement 2 images utiles : la tuile d'icone et la fleche.
  // Une 3e image signifie qu'un fond a ete rendu.
  const USEFUL_IMAGE_COUNT = 2;

  it('sans illustration, AUCUNE image de fond n est rendue', async () => {
    const tree = await renderCard({});

    expect(tree.root.findAllByType(Image)).toHaveLength(USEFUL_IMAGE_COUNT);
  });

  it('sans illustration, le repli est un halo de la couleur d accent — pas un dessin', async () => {
    const tree = await renderCard({});
    const halos = tree.root.findAllByType(View).filter(
      (/** @type {any} */ node) => node.props?.style?.borderRadius
        && node.props.style.position === 'absolute'
        && node.props.style.backgroundColor,
    );

    // Deux disques concentriques : c'est la retombee qui fait lire un halo
    // plutot qu'une pastille. Ils partagent donc le meme centre.
    expect(halos).toHaveLength(2);
    halos.forEach((/** @type {any} */ halo) => {
      const { bottom, height, right, width } = halo.props.style;
      expect(height).toBe(width);
      expect(bottom + (height / 2)).toBe(43);
      expect(right + (width / 2)).toBe(49);
    });
  });

  it('avec une illustration, elle reprend sa place et le halo disparait', async () => {
    // ⛔ Le mecanisme n'est PAS supprime : il resservira le jour ou Adel
    // fournit les images (`assets_home/card-*-glow.png` du pack).
    const tree = await renderCard({ illustration: { uri: 'card-match-glow' } });

    expect(tree.root.findAllByType(Image)).toHaveLength(USEFUL_IMAGE_COUNT + 1);
    expect(
      tree.root.findAllByType(Image).some(
        (/** @type {any} */ node) => node.props.source?.uri === 'card-match-glow',
      ),
    ).toBe(true);
  });
});
