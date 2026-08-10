import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import OnboardingChoiceChip from '../OnboardingChoiceChip';

// D56 — la grammaire des GRILLES du pack d'inscription.
//
// Ce que ces cas tiennent :
//   1. la chip choisie SE REMPLIT de cyan (le pack ne veut qu'un seul signal,
//      pas un fond pale + un texte cyan + une coche),
//   2. 🎨 l'encre sur cyan est `primary900` — `primary100` sur `primary500`
//      vaut 2,18:1 et echoue au WCAG AA (decision Adel du 2026-07-14),
//   3. ⛔ la chip ne descend jamais sous 48 pt,
//   4. une grille multiple s'annonce en case a cocher, une grille simple en
//      bouton radio.

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
      <OnboardingChoiceChip
        checked={false}
        label="U15"
        onPress={() => {}}
        // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
        {...props}
      />,
    );
  });
  return /** @type {any} */ (arbre);
};

const chip = (/** @type {any} */ tree) => tree.root.findByType(TouchableOpacity);
const styleDe = (/** @type {any} */ tree) => StyleSheet.flatten(chip(tree).props.style) || {};
const encre = (/** @type {any} */ tree) => StyleSheet.flatten(
  tree.root.findByType(Text).props.style,
)?.color;

describe('OnboardingChoiceChip — la grammaire des grilles (D56)', () => {
  it('la chip choisie SE REMPLIT de cyan, l autre reste sombre', () => {
    expect(styleDe(rendre({ checked: true })).backgroundColor).toBe('couleur-primary500');
    expect(styleDe(rendre({})).backgroundColor).toBe('couleur-neutral800');
  });

  it('🎨 sur fond cyan, l encre est primary900 — jamais du clair', () => {
    expect(encre(rendre({ checked: true }))).toBe('couleur-primary900');
    expect(encre(rendre({}))).toBe('couleur-neutral00');
  });

  it('⛔ la chip ne descend jamais sous 48 pt', () => {
    expect(styleDe(rendre({})).minHeight).toBeGreaterThanOrEqual(48);
  });

  it('grille multiple : case a cocher ; grille simple : bouton radio', () => {
    expect(chip(rendre({ multi: true })).props.accessibilityRole).toBe('checkbox');
    expect(chip(rendre({})).props.accessibilityRole).toBe('radio');
    expect(chip(rendre({ checked: true })).props.accessibilityState).toEqual({ checked: true });
  });

  it('toucher la chip la selectionne', () => {
    const onPress = jest.fn();
    const tree = rendre({ onPress });
    act(() => { chip(tree).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
