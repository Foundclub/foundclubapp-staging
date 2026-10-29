import { createElement } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Input from '../Input';

// RW-PARENT (29/10, recette du site) — LA CASE DE L'ANNÉE DÉBORDAIT. Sur le site, un champ
// garde sa largeur naturelle (~20 caractères, 203 px) tant qu'on ne lui permet pas de
// rétrécir : « AAAA » (case de 80 px) poussait « Qui es-tu ? » et « Ajouter un enfant » de
// 95 et 59 px hors de l'écran d'un téléphone (390 px). `minWidth: 0` le laisse tenir dans sa
// case ; sur le téléphone, la mise en page native le faisait déjà.

jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: jest.requireActual('@/theme/fonts').default(Colors),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

test('🔴 RW-PARENT le champ peut rétrécir dans sa case (minWidth 0)', () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(Input, { placeholder: 'AAAA', wrapperStyle: { width: 80 } }));
  });
  const style = StyleSheet.flatten(arbre.root.findByType(TextInput).props.style);
  act(() => arbre.unmount());

  expect(style.minWidth).toBe(0);
});
