import { createElement, useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SearchComponent from '../searchComponent';

// C04 Q3-16 (BUGHUNT phase 2, 25/10) — taper « ab » puis effacer le « b » effaçait aussi le « a ».
// « a » (une lettre) est envoyé comme « » ; la liste renvoie « » comme valeur par défaut, et la
// barre, qui comparait « a » à « », se vidait. 8 listes partagent cette barre.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));
jest.mock('@/theme/themeContext', () => {
  const vide = new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({
      Alignments: vide, ApplicationStyle: vide, Colors: {}, Fonts: vide, Images: {}, Spaces: vide,
    }),
  };
});
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/input/Input', () => {
  const { createElement: ce } = jest.requireActual('react');
  const { TextInput: Champ } = jest.requireActual('react-native');
  return (/** @type {any} */ { onChangeText, value }) => ce(Champ, { onChangeText, value });
});

/**
 * La liste, comme ClubListContent : la recherche envoyée revient en valeur par défaut.
 * @returns {import('react').ReactElement}
 */
function Liste() {
  const [nom, setNom] = useState('');
  const recevoir = useCallback((/** @type {string} */ texte) => setNom(texte), []);
  return createElement(SearchComponent, {
    handleSearchField: recevoir, openFilters: () => {}, searchDefaultValue: nom,
  });
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test('🔴 C04 Q3-16 — « ab » puis effacer le « b » laisse « a » dans la barre', () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(createElement(Liste)); });
  const champ = () => arbre.root.findByType(TextInput);

  act(() => { champ().props.onChangeText('a'); });
  act(() => { champ().props.onChangeText('ab'); });
  act(() => { jest.advanceTimersByTime(400); });
  act(() => { champ().props.onChangeText('a'); });
  act(() => { jest.advanceTimersByTime(400); });

  expect(champ().props.value).toBe('a');
  act(() => arbre.unmount());
});
