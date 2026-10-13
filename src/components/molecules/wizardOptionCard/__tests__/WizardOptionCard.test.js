import { createElement } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardOptionCard from '../WizardOptionCard';

// PAR-L4 (13/10) — la carte de choix des tunnels n'avait AUCUN temoin (9 ecrans
// l'emploient : creation de club et d'equipe). Ce fichier decrit d'abord ce qu'elle
// fait AVANT le lot (E6), puis ce que le lot lui ajoute pour la feuille « Demander
// une place pour un enfant » (design parent E11 / E12).

// Le VRAI theme, jamais un Proxy.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
    }),
  };
});

/** @type {any[]} */
const arbres = [];

/**
 * Monte la carte.
 * @param {any} props - Ses proprietes.
 * @returns {any} L'arbre.
 */
const monter = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(WizardOptionCard, { title: 'U11 Filles', ...props }));
  });
  arbres.push(arbre);
  return arbre;
};

/**
 * Le pressable racine de la carte.
 * @param {any} arbre - L'arbre.
 * @returns {any} Le noeud.
 */
const carte = (arbre) => arbre.root.findByType(TouchableOpacity);

/**
 * Les textes rendus, dans l'ordre.
 * @param {any} arbre - L'arbre.
 * @returns {any[]} Les noeuds Text.
 */
const textes = (arbre) => arbre.root.findAllByType(Text);

/**
 * Le style aplati d'un noeud.
 * @param {any} noeud - Le noeud.
 * @returns {Record<string, any>} Le style.
 */
const style = (noeud) => Object.assign({}, ...[noeud.props.style].flat(Infinity).filter(Boolean));

afterEach(() => {
  arbres.forEach((arbre) => act(() => arbre.unmount()));
  arbres.length = 0;
});

describe('WizardOptionCard — caracterisation (avant PAR-L4)', () => {
  it('un bouton qui porte son titre, son sous-titre et sa pastille', () => {
    const onPress = jest.fn();
    const arbre = monter({ onPress, subtitle: 'Football · U11', tag: 'Toi' });

    expect(carte(arbre).props.accessibilityRole).toBe('button');
    const lus = textes(arbre).map((noeud) => noeud.props.children);
    expect(lus).toEqual(['U11 Filles', 'Toi', 'Football · U11']);

    act(() => carte(arbre).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('titre et sous-titre tiennent sur UNE ligne', () => {
    const arbre = monter({ subtitle: 'Football · U11' });
    const [titre, sousTitre] = textes(arbre);
    expect(titre.props.numberOfLines).toBe(1);
    expect(sousTitre.props.numberOfLines).toBe(1);
  });

  it('l etat choisi se dit par « selected », et teinte la carte en cyan', () => {
    const libre = monter({});
    const choisie = monter({ selected: true });

    expect(carte(libre).props.accessibilityState).toEqual({ selected: false });
    expect(carte(choisie).props.accessibilityState).toEqual({ selected: true });
    expect(style(carte(libre)).borderColor).toMatch(/^rgba\(255, ?255, ?255, ?0\.10?\)$/);
    expect(style(carte(choisie)).borderColor).toBe('#01b3f4');
    expect(style(carte(choisie)).backgroundColor).toMatch(/^rgba\(1, ?179, ?244, ?0\.08\)$/);
  });

  it('l avatar montre les initiales', () => {
    const arbre = monter({ avatar: { firstname: 'Anissa', lastname: 'Dubelloy' } });
    expect(textes(arbre).map((noeud) => noeud.props.children)).toContain('AD');
  });

  it('la variante pointillee (action) n a pas de marqueur de choix', () => {
    const avecMarqueur = monter({});
    const pointillee = monter({ dashed: true });
    // Le marqueur rond est la derniere vue enfant directe de la carte.
    expect(carte(avecMarqueur).props.children.filter(Boolean)).toHaveLength(2);
    expect(carte(pointillee).props.children.filter(Boolean)).toHaveLength(1);
  });
});
