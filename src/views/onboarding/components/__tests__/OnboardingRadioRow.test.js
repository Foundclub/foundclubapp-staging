import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import OnboardingRadioRow from '../OnboardingRadioRow';

// D56 — la grammaire de selection UNIQUE du pack d'inscription.
//
// Ce que ces cas tiennent, et qui se perd sans eux :
//   1. le role et l'etat sont ANNONCES (VoiceOver / TalkBack lisent « bouton
//      radio, coche »), exigence explicite du pack,
//   2. le point plein n'apparait QUE sur la rangee choisie,
//   3. ⛔ la rangee ne descend jamais sous 56 pt — le pack dit 56-64, et une
//      rangee ecrasee redevient la « carte » que le pack retire.

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

const rendre = (/** @type {any} */ props) => {
  let arbre;
  act(() => {
    arbre = renderer.create(
      <OnboardingRadioRow
        checked={false}
        label="Joueur·se"
        onPress={() => {}}
        // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
        {...props}
      />,
    );
  });
  return /** @type {any} */ (arbre);
};

const rangee = (/** @type {any} */ tree) => tree.root.findByType(TouchableOpacity);

// Le point du radio. On ne garde que les elements HOTES (`type` est une
// chaine) : sinon chaque vue compte deux fois, une pour le composant React et
// une pour l'element natif qu'il rend.
const pastilles = (/** @type {any} */ tree) => tree.root
  .findAll((/** @type {any} */ node) => {
    if (typeof node.type !== 'string') return false;
    const style = StyleSheet.flatten(node.props?.style) || {};
    return style.borderRadius === 6 && style.height === 12 && style.width === 12;
  });

describe('OnboardingRadioRow — la grammaire de selection du pack (D56)', () => {
  it('affiche le libelle, et le sous-titre seulement s il existe', () => {
    const textes = (/** @type {any} */ tree) => tree.root
      .findAllByType(Text)
      .map((/** @type {any} */ node) => node.props.children)
      .flat()
      .filter((/** @type {any} */ v) => typeof v === 'string');

    expect(textes(rendre({}))).toEqual(['Joueur·se']);
    expect(textes(rendre({ subtitle: 'Tu joues en club' })))
      .toEqual(['Joueur·se', 'Tu joues en club']);
  });

  it('s annonce comme un bouton radio, avec son etat', () => {
    expect(rangee(rendre({})).props.accessibilityRole).toBe('radio');
    expect(rangee(rendre({})).props.accessibilityState).toEqual({ checked: false });
    expect(rangee(rendre({ checked: true })).props.accessibilityState).toEqual({ checked: true });
  });

  it('le point plein n apparait QUE sur la rangee choisie', () => {
    expect(pastilles(rendre({}))).toHaveLength(0);
    expect(pastilles(rendre({ checked: true }))).toHaveLength(1);
  });

  it('⛔ la rangee ne descend jamais sous 56 pt', () => {
    const style = StyleSheet.flatten(rangee(rendre({})).props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(56);
  });

  it('toucher la rangee la selectionne', () => {
    const onPress = jest.fn();
    const tree = rendre({ onPress });
    act(() => { rangee(tree).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
