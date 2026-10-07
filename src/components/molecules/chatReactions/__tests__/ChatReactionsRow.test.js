import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors } from '@/theme/colors';

import ChatReactionsRow from '../ChatReactionsRow';

// MSG1A (§3.1) — LES REACTIONS, A CHEVAL SUR LE BAS DE LA BULLE (SPECS.md §1).
//
// Avant MSG1A : une pilule PAR emoji, chacune avec son compte, posee SOUS la bulle.
// Le pack : UNE pilule, les 3 emojis les plus donnes, puis le TOTAL (s'il depasse 1),
// liseree de cyan quand ma reaction en fait partie. Un appui ouvre toujours « qui a
// reagi » (la meme fonction qu'avant).
// 🔴 ROUGE avant MSG1A : R1 et R2 (plusieurs pilules, comptes separes).

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const texte = typeof repli === 'string' ? repli : repli?.defaultValue || cle;
      return texte.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ m, /** @type {string} */ nom) => (valeurs?.[nom] !== undefined ? String(valeurs[nom]) : repli?.[nom] ?? m));
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      Colors,
      Fonts: generateFonts(Colors),
      Spaces,
    }),
  };
});

const REACTIONS = [
  { count: 1, emoji: '😂', users: [{ documentId: 'b' }] },
  {
    count: 4,
    emoji: '👍',
    users: [{ documentId: 'moi' }, { documentId: 'a' }, { documentId: 'c' }, { documentId: 'd' }],
  },
  { count: 2, emoji: '❤️', users: [{ documentId: 'e' }, { documentId: 'f' }] },
  { count: 1, emoji: '🙏', users: [{ documentId: 'g' }] },
];

/**
 * Aide du temoin : `rendre`.
 * @param {any} props
 * @returns {any} L'arbre rendu.
 */
const rendre = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ChatReactionsRow
        isMine={props.isMine}
        myUserId={props.myUserId}
        onPress={props.onPress}
        reactions={props.reactions}
      />,
    );
  });
  return arbre;
};

const textes = (arbre) => arbre.root.findAllByType(Text).map((n) => String(n.props.children));

describe('MSG1A — la pilule de reactions', () => {
  test('R1 — UNE seule pilule, touchable, qui ouvre « qui a reagi »', () => {
    const onPress = jest.fn();
    const arbre = rendre({ myUserId: 'moi', onPress, reactions: REACTIONS });

    const boutons = arbre.root.findAllByType(TouchableOpacity);
    expect(boutons).toHaveLength(1);
    act(() => {
      boutons[0].props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('R2 — les 3 emojis les plus donnes, dans l ordre, puis le total (8)', () => {
    const arbre = rendre({ myUserId: 'moi', reactions: REACTIONS });

    expect(textes(arbre)).toEqual(['👍', '❤️', '😂', '8']);
  });

  test('R3 — une seule reaction, un seul vote : pas de total', () => {
    const arbre = rendre({ myUserId: 'x', reactions: [REACTIONS[0]] });

    expect(textes(arbre)).toEqual(['😂']);
  });

  test('R4 — ma reaction en fait partie : la pilule porte le liseré cyan', () => {
    const avecMoi = rendre({ myUserId: 'moi', reactions: REACTIONS });
    const sansMoi = rendre({ myUserId: 'personne', reactions: REACTIONS });

    const interieur = (arbre) => arbre.root.findByProps({ testID: 'reactions-pilule-interieur' });
    const liseré = (arbre) => interieur(arbre).props.style.flat?.() ?? interieur(arbre).props.style;
    const couleur = (arbre) => [].concat(liseré(arbre))
      .reduce((acc, s) => ({ ...acc, ...(s || {}) }), {}).borderColor;

    expect(couleur(avecMoi)).toBe(colors.primary500);
    expect(couleur(sansMoi)).toBe('transparent');
  });

  test('R5 — le lecteur d ecran entend les reactions et le total', () => {
    const arbre = rendre({ myUserId: 'moi', reactions: REACTIONS });

    const bouton = arbre.root.findByType(TouchableOpacity);
    expect(bouton.props.accessibilityLabel).toBe('Réactions : 👍 4, ❤️ 2, 😂 1, 🙏 1');
  });

  test('R6 — aucune reaction : rien du tout (la bulle garde sa hauteur)', () => {
    const arbre = rendre({ myUserId: 'moi', reactions: [] });

    expect(arbre.toJSON()).toBeNull();
  });
});
