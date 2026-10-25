import { createElement, useState } from 'react';
import renderer, { act } from 'react-test-renderer';

import PhoneInput from '../PhoneInput';

// C04 Q2-01 (BUGHUNT phase 2, 25/10) — changer d'indicatif APRÈS avoir tapé le numéro : le champ
// affichait « BE +32 », mais le formulaire gardait le numéro en +33 (le SMS partait vers un autre
// numéro). Connexion, AddCoach, devenir gérant d'un complexe.

const mockSelect = [];
const mockInput = [];

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.forwardRef((/** @type {any} */ props, ref) => {
    mockSelect.push(props);
    return reactActuel.createElement(TexteRN, { ref }, props.displayValue);
  });
});
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.forwardRef((/** @type {any} */ props, ref) => {
    mockInput.push(props);
    return reactActuel.createElement(TexteRN, { ref }, props.value);
  });
});
jest.mock('@/theme/themeContext', () => {
  const vide = new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({ Alignments: vide, ApplicationStyle: vide, Spaces: vide }),
  };
});

const dernierSelect = () => mockSelect[mockSelect.length - 1];
const dernierInput = () => mockInput[mockInput.length - 1];

/** @type {string[]} */
let envoyes = [];
/**
 * Le formulaire : la valeur rendue revient au champ, comme avec react-hook-form.
 * @returns {import('react').ReactElement}
 */
function Formulaire() {
  const [valeur, setValeur] = useState('');
  return createElement(PhoneInput, {
    onBlur: jest.fn(),
    onChange: (/** @type {string} */ v) => { envoyes.push(v); setValeur(v); },
    value: valeur,
  });
}

beforeEach(() => {
  mockSelect.length = 0;
  mockInput.length = 0;
  envoyes = [];
});

describe('🔴 C04 Q2-01 — changer d indicatif après le numéro', () => {
  it('0470123456 tapé en +33, puis +32 choisi : le formulaire reçoit +32470123456', () => {
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(createElement(Formulaire)); });
    act(() => dernierInput().onChangeText('0470123456'));
    act(() => dernierInput().onEndEditing({ nativeEvent: { text: dernierInput().value } }));
    expect(envoyes[envoyes.length - 1]).toBe('+33470123456');

    const belgique = dernierSelect().options.find((/** @type {any} */ o) => o.value === '+32');
    act(() => dernierSelect().setValue(belgique));

    expect(envoyes[envoyes.length - 1]).toBe('+32470123456');
    expect(dernierSelect().value).toBe('+32');
    act(() => arbre.unmount());
  });

  it('changer d indicatif sans numéro tapé n envoie rien', () => {
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(createElement(Formulaire)); });
    const belgique = dernierSelect().options.find((/** @type {any} */ o) => o.value === '+32');
    act(() => dernierSelect().setValue(belgique));

    expect(envoyes).toEqual([]);
    expect(dernierSelect().value).toBe('+32');
    act(() => arbre.unmount());
  });
});
