import { Pressable, Text, View } from 'react-native';
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

    const rangees = tree.root.findAllByType(Pressable)
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
