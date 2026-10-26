import { createElement } from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Input from '../Input';

// C04 Q1-15 (BUGHUNT phase 2, 25/10) — le clavier demandé (prix, e-mail, téléphone) ne s'affichait
// jamais : `Input` passait `inputMode="text"` par défaut, et React Native 0.81 donne la priorité à
// `inputMode` sur `keyboardType` (TextInput.js : `inputMode ? map[inputMode] : keyboardType`).
// Les 113 `keyboardType=` du code étaient ignorés. Sans `inputMode` demandé, rien n'est passé.

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

const champ = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(createElement(Input, props)); });
  const rendu = arbre.root.findByType(TextInput).props;
  act(() => arbre.unmount());
  return rendu;
};

describe('🔴 C04 Q1-15 — le clavier demandé par `keyboardType` n est plus écrasé', () => {
  test.each(['decimal-pad', 'email-address', 'phone-pad', 'number-pad'])(
    'keyboardType=%s : aucun inputMode imposé',
    (keyboardType) => {
      const rendu = champ({ keyboardType, value: '' });

      expect(rendu.keyboardType).toBe(keyboardType);
      expect(rendu.inputMode).toBeUndefined();
    },
  );

  test('un inputMode demandé est toujours transmis', () => {
    expect(champ({ inputMode: 'numeric', value: '' }).inputMode).toBe('numeric');
  });
});
