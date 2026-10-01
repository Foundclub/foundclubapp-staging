import {
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors } from '@/theme/colors';

import HomeHeadBanner from '../HomeHeadBanner';

// D72 — LE BANDEAU DE TETE (pack accueil, tache 2 + critere de recette 2).
//
// Ce qui compte le plus ici n'est pas ce qu'il affiche, c'est ce qu'il
// N'AFFICHE PAS : un bandeau sans contenu doit disparaitre ENTIEREMENT,
// etiquette comprise. Un cadre vide ou un « rien a signaler » serait un defaut.
//
// ⚠️ CETTE MISE EN GARDE A EXPIRE le 2026-08-12 (lot D78). Elle disait que ce
// composant ne se rendait JAMAIS faute d'endpoint : `GET /app/home-summary` est
// livre (D76) et l'accueil le lit. Le bandeau se rend donc pour de vrai, et ces
// tests ne sont plus sa seule preuve — voir `views/home/__tests__/compteursAccueil`.

jest.mock('@/theme/themeContext', () => {
  const { colors: vraiesCouleurs } = jest.requireActual('@/theme/colors');
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: vraiesCouleurs,
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (/** @type {any} */ _t, /** @type {any} */ k) => `image-${String(k)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

// Doublure de bouton : un simple porteur de titre. Le vrai Button tire
// ApplicationStyle et Images, qui n'apprendraient rien de plus ici.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => <RNText onPress={onPress}>{title}</RNText>,
  };
});

/**
 * @param {any} props
 * @returns {Promise<any>}
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

const monter = async (props) => {
  let tree;
  await act(async () => {
    // eslint-disable-next-line react/jsx-props-no-spreading
    tree = renderer.create(<HomeHeadBanner {...props} />);
  });
  return tree;
};

/**
 * @param {any} node
 * @returns {string[]}
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};

describe('D72 — un bandeau vide DISPARAIT (critere de recette 2)', () => {
  it('LE TEMOIN : aucune ligne ⇒ rien du tout, pas meme l etiquette', async () => {
    const tree = await monter({ label: "Aujourd'hui", lines: [], variant: 'list' });

    expect(tree.toJSON()).toBeNull();
  });

  it('aucun evenement ⇒ rien du tout non plus', async () => {
    const tree = await monter({ label: 'Ma semaine', variant: 'event' });

    expect(tree.toJSON()).toBeNull();
  });

  it('sans aucune propriete de contenu, il ne rend rien', async () => {
    expect((await monter({ label: 'Ma semaine' })).toJSON()).toBeNull();
  });
});

describe('D72 — la variante « liste » (dirigeant, super admin)', () => {
  const LIGNES = [
    {
      hasAlert: true, icon: 'bell', key: 'demandes', label: 'Demandes en attente', value: '3',
    },
    {
      hasAlert: true, icon: 'euroCircle', key: 'impayes', label: 'Cotisations impayées', value: '620 €',
    },
  ];

  it('affiche l etiquette en majuscules, puis chaque ligne avec sa valeur', async () => {
    const tree = await monter({ label: "Aujourd'hui", lines: LIGNES, variant: 'list' });
    const textes = collecterTexte(tree.toJSON());

    expect(textes).toContain("AUJOURD'HUI");
    expect(textes).toContain('Demandes en attente');
    expect(textes).toContain('620 €');
  });

  it('une ligne en retard porte un point du rouge d alerte du theme', async () => {
    const tree = await monter({ label: "Aujourd'hui", lines: LIGNES, variant: 'list' });
    const points = tree.root.findAllByType(View).filter(
      (/** @type {any} */ node) => node.props?.style?.backgroundColor === colors.error500,
    );

    expect(points).toHaveLength(2);
  });

  it('une ligne sans retard n a pas de point', async () => {
    const tree = await monter({
      label: 'À traiter',
      lines: [{
        hasAlert: false, icon: 'bell', key: 'aLaUne', label: 'À la une', value: '2',
      }],
      variant: 'list',
    });
    const points = tree.root.findAllByType(View).filter(
      (/** @type {any} */ node) => node.props?.style?.backgroundColor === colors.error500,
    );

    expect(points).toHaveLength(0);
  });

  it('chaque ligne tappable mene quelque part', async () => {
    const onPress = jest.fn();
    const tree = await monter({
      label: "Aujourd'hui",
      lines: [{
        icon: 'bell', key: 'demandes', label: 'Demandes', onPress, value: '3',
      }],
      variant: 'list',
    });

    const rangees = tree.root.findAll(estPressable)
      .filter((/** @type {any} */ node) => node.props.accessibilityRole === 'button');

    expect(rangees).toHaveLength(1);
    await act(async () => { rangees[0].props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('D72 — la variante « evenement » (entraineur, joueur)', () => {
  it('l entraineur voit sa seance, ses deux tuiles et le bouton de compo', async () => {
    const tree = await monter({
      actions: [{ key: 'compo', label: 'Ouvrir la compo', onPress: jest.fn() }],
      label: 'Ma prochaine séance',
      subtitle: 'Istres Provence HB — déplacement, départ 13:15',
      tiles: [
        { key: 'convoques', label: 'convoquées', value: '16' },
        {
          key: 'sansReponse', label: 'réponses manquantes', tone: colors.warning500, value: '7',
        },
      ],
      title: 'Samedi 15 · 15:00',
      titleSuffix: 'U17 F',
      variant: 'event',
    });
    const textes = collecterTexte(tree.toJSON());

    expect(textes).toContain('Samedi 15 · 15:00');
    expect(textes).toContain('16');
    expect(textes).toContain('réponses manquantes');
    expect(textes).toContain('Ouvrir la compo');
  });

  it('le joueur voit ses deux reponses possibles', async () => {
    const present = jest.fn();
    const tree = await monter({
      actions: [
        { key: 'present', label: 'Présent', onPress: present },
        {
          key: 'absent', label: 'Absent', onPress: jest.fn(), variant: 'secondary',
        },
      ],
      label: 'Ma semaine',
      subtitle: 'SMUC – Aubagne HB · RDV 13:00',
      title: 'Samedi 15 · 14:00',
      titleSuffix: 'Séniors 1 M',
      variant: 'event',
    });
    const textes = collecterTexte(tree.toJSON());

    expect(textes).toContain('Présent');
    expect(textes).toContain('Absent');

    await act(async () => {
      tree.root.findAllByType(Text)
        .find((/** @type {any} */ n) => n.props.children === 'Présent')
        .props.onPress();
    });
    expect(present).toHaveBeenCalledTimes(1);
  });

  it('sans tuiles ni boutons, le bandeau se reduit a son echeance', async () => {
    const tree = await monter({
      label: 'Ma semaine', title: 'Samedi 15 · 14:00', variant: 'event',
    });
    const textes = collecterTexte(tree.toJSON());

    expect(textes).toContain('Samedi 15 · 14:00');
    expect(tree.toJSON()).not.toBeNull();
  });
});

// A05 (audit V1, decision d'Adel du 30/09) : apres Present comme apres Absent, une
// ligne « ✓ Réponse envoyée : X » sous les boutons. « La coche et le texte gardent
// leur couleur verte ; apres Absent, le MOT « Absent » est en ROUGE. » Les deux
// couleurs sont celles de la charte que les ecrans de convocation emploient deja
// pour present / absent (`MatchConvocationPublished.js`, `PlayerConvocationScreen.js`).
describe('A05 — la ligne « Réponse envoyée : X » et ses couleurs', () => {
  const EVENEMENT = {
    actions: [
      { key: 'present', label: 'Présent', onPress: jest.fn() },
      {
        key: 'absent', label: 'Absent', onPress: jest.fn(), variant: 'secondary',
      },
    ],
    label: 'Ma semaine',
    subtitle: 'Entraînement U15 · Gymnase des Tilleuls',
    title: 'Jeu. 01/10 · 18:00',
    variant: 'event',
  };

  /**
   * La ligne de confirmation : le texte annonce aux lecteurs d'ecran (region vivante).
   * @param {any} tree
   * @returns {any[]}
   */
  const lignes = (tree) => tree.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
    && n.props.accessibilityLiveRegion === 'polite');

  /**
   * Le mot de la réponse : le texte imbriqué dans la ligne.
   * @param {any} ligne
   * @returns {any}
   */
  const motDe = (ligne) => ligne.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && n !== ligne
  ))[0];

  /**
   * La couleur de texte d'un nœud, styles aplatis.
   * @param {any} noeud
   * @returns {string | undefined}
   */
  const couleur = (noeud) => StyleSheet.flatten(noeud.props.style)?.color;

  it('sans confirmation, aucune ligne', async () => {
    const tree = await monter(EVENEMENT);

    expect(lignes(tree)).toHaveLength(0);
  });

  it('LE TEMOIN : apres Présent, « Réponse envoyée : Présent », tout en vert', async () => {
    const tree = await monter({
      ...EVENEMENT,
      confirmation: { answer: 'present', answerLabel: 'Présent', label: 'Réponse envoyée\u00a0:' },
    });
    const [ligne] = lignes(tree);
    const mot = motDe(ligne);

    expect(collecterTexte(ligne).join('')).toBe('Réponse envoyée\u00a0: Présent');
    expect(couleur(ligne)).toBe(colors.success500);
    expect(couleur(mot)).toBe(colors.success500);
  });

  it('apres Absent, coche et texte restent VERTS, le MOT « Absent » passe en ROUGE', async () => {
    const tree = await monter({
      ...EVENEMENT,
      confirmation: { answer: 'absent', answerLabel: 'Absent', label: 'Réponse envoyée\u00a0:' },
    });
    const [ligne] = lignes(tree);
    const mot = motDe(ligne);

    expect(collecterTexte(ligne).join('')).toBe('Réponse envoyée\u00a0: Absent');
    expect(couleur(ligne)).toBe(colors.success500);
    expect(collecterTexte(mot).join('')).toBe('Absent');
    expect(couleur(mot)).toBe(colors.error500);
  });
});
