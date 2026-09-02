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
/**
 * RN 0.81 a retire le `forwardRef` autour de `Pressable` : React expose desormais
 * la fonction INTERNE du memo dans l'arbre de test, la ou 0.78 exposait l'objet
 * memo lui-meme. La recherche par type rendait donc 0 apres la montee.
 * Ce predicat accepte les DEUX formes, pour survivre aux deux versions.
 * @param {any} noeud Un noeud de l arbre rendu par react-test-renderer.
 * @returns {boolean} Vrai si ce noeud est un Pressable, quelle que soit la version de RN.
 */
const estPressable = (noeud) => noeud.type === Pressable
  || noeud.type === /** @type {any} */ (Pressable).type;

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
  emphasis = undefined,
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
        emphasis={emphasis}
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
 * Les disques du halo de repli : absolus, ronds, et de couleur pleine.
 * @param {any} tree
 * @returns {any[]}
 */
const halosDe = (tree) => tree.root.findAllByType(View).filter(
  (/** @type {any} */ node) => node.props?.style?.borderRadius
    && node.props.style.position === 'absolute'
    && node.props.style.backgroundColor,
);

/**
 * Le style applique par le Pressable racine, etat non presse.
 * @param {any} tree
 * @returns {any}
 */
const rootStyle = (tree) => {
  const style = tree.root.find(estPressable).props.style({ pressed: false });
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
    expect(tree.root.find(estPressable).props.disabled).toBe(false);

    await act(async () => { tree.root.find(estPressable).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('grise SANS couper l appui quand le quota est epuise', async () => {
    const onPress = jest.fn();
    const tree = await renderCard({ locked: true, onPress, premiumScope: 'team' });

    expect(rootStyle(tree).opacity).toBe(0.55);
    // C'est tout l'objet du lot : l'appui doit encore ouvrir la feuille de vente.
    expect(tree.root.find(estPressable).props.disabled).toBe(false);

    await act(async () => { tree.root.find(estPressable).props.onPress(); });
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
    expect(tree.root.find(estPressable).props.disabled).toBe(true);
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
    const halos = halosDe(tree);

    // Deux disques concentriques : c'est la retombee qui fait lire un halo
    // plutot qu'une pastille. Ils partagent donc le meme centre.
    expect(halos).toHaveLength(2);
    halos.forEach((/** @type {any} */ halo) => {
      const {
        bottom, height, right, width,
      } = halo.props.style;
      expect(height).toBe(width);
      expect(bottom + (height / 2)).toBe(43);
      expect(right + (width / 2)).toBe(49);
    });
  });

  it('avec une illustration, elle reprend sa place et le halo disparait', async () => {
    // ⛔ Le mecanisme n'est PAS supprime : depuis D75 il sert les 39 cartes du
    // hub, et le halo reste le repli de toute carte sans dessin.
    const tree = await renderCard({ illustration: { uri: 'card-match-glow' } });

    expect(tree.root.findAllByType(Image)).toHaveLength(USEFUL_IMAGE_COUNT + 1);
    expect(
      tree.root.findAllByType(Image).some(
        (/** @type {any} */ node) => node.props.source?.uri === 'card-match-glow',
      ),
    ).toBe(true);
    // D75 — LES DEUX NE COHABITENT JAMAIS. Un halo sous une illustration ferait
    // une tache de couleur derriere le trait, exactement ce que le halo devait
    // remplacer. Le titre de ce test le promettait sans le mesurer.
    expect(halosDe(tree)).toHaveLength(0);
  });
});

// D75 — L'OPACITE EST APPLIQUEE PAR L'APP, PAS GRAVEE DANS LES PNG.
// Le pack livre les 13 illustrations a pleine intensite pour que le reglage
// reste changeable sans relivrer d'image. Ces deux tests figent les valeurs
// retenues : en dessous de 0.14 les alphas internes des fichiers seraient a
// revoir, au-dessus de 0.24 le trait passe devant le sous-titre gris.
describe('HomeActionCard — l intensite de l illustration de fond (D75)', () => {
  /**
   * L'image de fond de la carte, reconnue par sa source.
   * @param {any} tree
   * @returns {any} - Le noeud Image qui porte l'illustration de fond.
   */
  const fondDe = (tree) => tree.root.findAllByType(Image).find(
    (/** @type {any} */ node) => node.props.source?.uri === 'card-match-glow',
  );

  it('attenue l illustration a 0.16 sur une carte ordinaire', async () => {
    const tree = await renderCard({ illustration: { uri: 'card-match-glow' } });

    expect(fondDe(tree).props.style.opacity).toBe(0.16);
  });

  it('descend a 0.14 sur la carte primaire, dont la bordure porte deja l accent', async () => {
    const tree = await renderCard({
      emphasis: 'primary',
      illustration: { uri: 'card-match-glow' },
    });

    expect(fondDe(tree).props.style.opacity).toBe(0.14);
  });

  it('ne touche NI au placement NI au cadrage livres par le pack', async () => {
    // 138/138, debord de 20 a droite et 26 en bas : c'est sur ce cadrage que le
    // studio a dessine la zone de securite. Le changer tronquerait les sujets.
    // ⚠️ UN SEUL montage : deux arbres vivants dans le meme test font sortir
    // jest en 1 avec tous les tests verts (defaut ferme par D68).
    const fond = fondDe(await renderCard({ illustration: { uri: 'card-match-glow' } }));

    expect(fond.props.style).toMatchObject({
      bottom: -26, height: 138, right: -20, width: 138,
    });
    expect(fond.props.resizeMode).toBe('contain');
  });
});
