import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PollCreationModal from '../PollCreationModal';

// MSG1A (§3.4) — E6 : LE TEMOIN CARACTERISANT DE « CREER UN SONDAGE », ECRIT AVANT LE RESTYLE.
//
// La feuille n'avait AUCUN temoin. Ce qui doit survivre au dessin du pack : les trois
// refus (question vide, moins de deux options, options en double), l'envoi avec les deux
// reglages, 2 a 6 options, et la fermeture. Les libelles sont ceux du code (le pack les a
// repris mot pour mot).

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const texte = typeof repli === 'string' ? repli : repli?.defaultValue || cle;
      return texte.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ m, /** @type {string} */ nom) => (
        repli?.[nom] !== undefined ? String(repli[nom]) : m));
    },
  }),
}));

jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true, Circle: VueRN, default: VueRN, Line: VueRN, Path: VueRN, Polyline: VueRN, Rect: VueRN, Svg: VueRN,
  };
});

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments, Colors, Fonts: generateFonts(Colors), Images: new Proxy({}, { get: () => 1 }), Spaces,
    }),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  (/** @type {any} */ { children }) => children
));

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: Texte, TouchableOpacity: Touchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <Touchable disabled={props.disabled} onPress={props.onPress} testID={`bouton-${props.title}`}>
        <Texte>{props.title}</Texte>
      </Touchable>
    ),
  };
});

/**
 * @param {any} [props]
 * @returns {{arbre: any, onClose: jest.Mock, onSubmit: jest.Mock}} Le banc.
 */
const monter = (props = {}) => {
  const onClose = jest.fn();
  const onSubmit = jest.fn(() => Promise.resolve());
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PollCreationModal isVisible onClose={props.onClose || onClose} onSubmit={props.onSubmit || onSubmit} />,
    );
  });
  return { arbre, onClose, onSubmit };
};

const champs = (arbre) => arbre.root.findAllByType(TextInput);
const textes = (arbre) => arbre.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const toucherLeTexte = (arbre, texte) => {
  const bouton = arbre.root.findAllByType(TouchableOpacity).reverse()
    .find((n) => n.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === texte).length > 0);
  if (!bouton) throw new Error(`bouton introuvable : ${texte}`);
  return act(async () => { await bouton.props.onPress(); });
};
const ecrire = (champ, valeur) => act(() => { champ.props.onChangeText(valeur); });

describe('MSG1A — PollCreationModal (caracterisation)', () => {
  test('S1 — question vide : refus, et rien n est envoye', async () => {
    const { arbre, onSubmit } = monter();
    await toucherLeTexte(arbre, 'Envoyer le sondage');

    expect(textes(arbre)).toContain('Ajoute une question pour ton sondage.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('S2 — une seule option remplie : refus', async () => {
    const { arbre, onSubmit } = monter();
    ecrire(champs(arbre)[0], 'Quel creneau ?');
    ecrire(champs(arbre)[1], 'Mardi');
    await toucherLeTexte(arbre, 'Envoyer le sondage');

    expect(textes(arbre)).toContain('Ajoute au moins deux options.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('S3 — deux options identiques : refus', async () => {
    const { arbre, onSubmit } = monter();
    ecrire(champs(arbre)[0], 'Quel creneau ?');
    ecrire(champs(arbre)[1], 'Mardi');
    ecrire(champs(arbre)[2], 'mardi');
    await toucherLeTexte(arbre, 'Envoyer le sondage');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textes(arbre).join(' ')).toMatch(/Chaque option doit être diff/);
  });

  test('S4 — envoi : question, options et les deux reglages', async () => {
    const { arbre, onSubmit } = monter();
    ecrire(champs(arbre)[0], '  Quel creneau ? ');
    ecrire(champs(arbre)[1], 'Mardi');
    ecrire(champs(arbre)[2], 'Jeudi');
    const interrupteurs = arbre.root.findAll((n) => n.props?.accessibilityRole === 'switch'
      && typeof n.props.onPress === 'function' && typeof n.type !== 'string', { deep: false });
    act(() => { interrupteurs[0].props.onPress(); });
    act(() => { interrupteurs[1].props.onPress(); });
    await toucherLeTexte(arbre, 'Envoyer le sondage');

    expect(onSubmit).toHaveBeenCalledWith({
      allowMultipleVotes: true, isAnonymous: true, options: ['Mardi', 'Jeudi'], question: 'Quel creneau ?',
    });
  });

  test('S5 — on monte jusqu a 6 options, pas une de plus', async () => {
    const { arbre } = monter();
    // Le pack (MSG1A) retire le lien « + Ajouter une option » a 6 ; avant, il etait grise.
    // Dans les deux cas : on appuie tant qu'on peut, et on ne depasse jamais 6.
    const lienPresent = () => arbre.root.findAll((n) => n.type === Text
      && [].concat(n.props.children).join('') === '+ Ajouter une option').length > 0;
    for (let i = 0; i < 8 && lienPresent(); i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await toucherLeTexte(arbre, '+ Ajouter une option');
    }

    expect(champs(arbre)).toHaveLength(1 + 6);
    expect(textes(arbre).join(' ')).toMatch(/6.*6/);
  });

  test('S6 — on peut fermer la feuille', async () => {
    const { arbre, onClose } = monter();
    const fermer = arbre.root.findAll((n) => typeof n.props?.onPress === 'function'
      && /Fermer|Annuler/.test(String(n.props?.accessibilityLabel || n.props?.title || '')))[0]
      || arbre.root.findAll((n) => n.props?.testID === 'bouton-Annuler')[0];
    await act(async () => { await fermer.props.onPress(); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
