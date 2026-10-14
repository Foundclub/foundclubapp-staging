import { Pressable, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import HomeActionCard from '../HomeActionCard';

// PAR-L7 (14/10, design parent E01 validé : « une ligne d'enfant → sa fiche », chef d'orchestre
// le 14/10) — LES LIGNES QUI S'OUVRENT CHACUNE. La carte « Mes enfants » de l'accueil nomme les
// enfants ; chaque ligne ouvre SA fiche, et un appui AILLEURS sur la carte ouvre toujours
// « Mes enfants ». La propriété `lignes` est FACULTATIVE : sans elle, la carte est exactement
// celle d'avant (cinq écrans s'en servent : accueil, événement, tableau tactique, abonnement,
// console du super admin). Écrit ROUGE (la propriété n'existait pas).

jest.mock('@/theme/themeContext', () => {
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
        primary500: 'cyan',
        primary700: 'surface',
      },
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

/**
 * Un nœud est-il un Pressable (RN 0.78 comme 0.81) ?
 * @param {any} noeud - Un nœud de l'arbre de test.
 * @returns {boolean} - Vrai pour un Pressable.
 */
const estPressable = (noeud) => noeud.type === Pressable
  || noeud.type === /** @type {any} */ (Pressable).type;

/** @type {renderer.ReactTestRenderer[]} */
const arbres = [];
afterEach(() => { arbres.splice(0).forEach((arbre) => act(() => { arbre.unmount(); })); });

/**
 * Monte la carte « Mes enfants ».
 * @param {any} [lignes] - Les lignes, ou rien.
 * @returns {{ arbre: any, onPress: jest.Mock }} - Le rendu et l'appui de la carte.
 */
const monter = (lignes) => {
  const onPress = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <HomeActionCard
        lignes={lignes}
        onPress={onPress}
        subtitle={'Anissa · U11 Filles\nMartin · Demande en attente'}
        subtitleLines={2}
        title="Mes enfants"
      />,
    );
  });
  arbres.push(arbre);
  return { arbre, onPress };
};

const ouvrirAnissa = jest.fn();
const ouvrirMartin = jest.fn();
const LIGNES = [
  {
    accessibilityLabel: 'Anissa, U11 Filles',
    cle: 'a',
    onPress: ouvrirAnissa,
    texte: 'Anissa · U11 Filles',
  },
  {
    accessibilityLabel: 'Martin, Demande en attente',
    cle: 'm',
    onPress: ouvrirMartin,
    texte: 'Martin · Demande en attente',
  },
  { cle: 'reste', texte: '+ 2 autres' },
];

beforeEach(() => jest.clearAllMocks());

const ligne = (/** @type {any} */ arbre, /** @type {string} */ cle) => arbre.root
  .findAll((/** @type {any} */ n) => estPressable(n)
    && n.props.testID === `home-card-line-${cle}`)[0];

test('appui sur la ligne d Anissa : SA fiche s ouvre, pas « Mes enfants »', () => {
  const { arbre, onPress } = monter(LIGNES);

  act(() => ligne(arbre, 'a').props.onPress());

  expect(ouvrirAnissa).toHaveBeenCalledTimes(1);
  expect(ouvrirMartin).not.toHaveBeenCalled();
  expect(onPress).not.toHaveBeenCalled();
});

test('appui AILLEURS sur la carte : « Mes enfants », comme avant', () => {
  const { arbre, onPress } = monter(LIGNES);
  const carte = arbre.root.findAll(estPressable)[0];

  act(() => carte.props.onPress());

  expect(onPress).toHaveBeenCalledTimes(1);
  expect(ouvrirAnissa).not.toHaveBeenCalled();
});

test('chaque ligne est un bouton NOMMÉ pour le lecteur d écran, haut d au moins 44 px', () => {
  const { arbre } = monter(LIGNES);

  ['a', 'm'].forEach((cle) => {
    const bouton = ligne(arbre, cle);
    const brut = bouton.props.style;
    const style = StyleSheet.flatten(typeof brut === 'function' ? brut({ pressed: false }) : brut);
    expect(bouton.props.accessibilityRole).toBe('button');
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
  expect(ligne(arbre, 'a').props.accessibilityLabel).toBe('Anissa, U11 Filles');
});

test('avec des lignes, le lecteur d écran atteint chacune ; le titre ouvre la carte', () => {
  const { arbre, onPress } = monter(LIGNES);
  const carte = arbre.root.findAll(estPressable)[0];
  const titre = arbre.root.findAllByType(Text).find((t) => t.props.children === 'Mes enfants');

  expect(carte.props.accessible).toBe(false);
  expect(titre.props.accessibilityRole).toBe('button');
  act(() => titre.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('« + 2 autres » n est pas un bouton : un appui y ouvre la carte', () => {
  const { arbre } = monter(LIGNES);

  expect(ligne(arbre, 'reste')).toBeUndefined();
  const textes = arbre.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
  expect(textes).toContain('+ 2 autres');
});

test('SANS lignes : la carte d avant — le sous-titre, un seul bouton, lisible d un bloc', () => {
  const { arbre } = monter(undefined);
  const textes = arbre.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

  expect(arbre.root.findAll(estPressable)).toHaveLength(1);
  expect(arbre.root.findAll(estPressable)[0].props.accessible).not.toBe(false);
  expect(textes).toContain('Anissa · U11 Filles\nMartin · Demande en attente');
});
