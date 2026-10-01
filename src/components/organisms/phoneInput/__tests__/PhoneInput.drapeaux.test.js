import renderer, { act } from 'react-test-renderer';

import PhoneInput from '../PhoneInput';

// SANS-EMOJI — le sélecteur d'indicatif, côté téléphone.
//
// Jusqu'au 01/10/2026, chaque pays de `utils/dial_codes.js` portait son drapeau
// en EMOJI au début de son libellé (« 🇫🇷  France »), et le code pays (« FR »)
// se DEVINAIT en décodant ce drapeau. Ce code pays sert au formatage du numéro
// (libphonenumber) : le retirer sans le remplacer casserait la saisie hors
// de France sans qu'aucun écran ne le montre.
//
// Ce témoin fige donc deux choses à la fois :
// - ce qui NE DOIT PAS bouger : France par défaut, le code pays de chaque
//   option, le numéro rendu au format international, pour la France ET pour
//   un pays choisi dans la liste ;
// - ce qui change : plus aucun drapeau en emoji, ni sur le bouton fermé, ni
//   dans la liste (le site, lui, montre déjà des images de drapeaux).

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

// Le thème réel n est pas monté ici : chaque jeton de mise en page rend un style vide.
jest.mock('@/theme/themeContext', () => {
  const vide = new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({ Alignments: vide, ApplicationStyle: vide, Spaces: vide }),
  };
});

const DRAPEAU = /[\u{1F1E6}-\u{1F1FF}]/u;

const monter = () => {
  const onChange = jest.fn();
  act(() => {
    renderer.create(<PhoneInput onBlur={jest.fn()} onChange={onChange} value="" />);
  });
  return onChange;
};

const dernierSelect = () => mockSelect[mockSelect.length - 1];
const dernierInput = () => mockInput[mockInput.length - 1];

beforeEach(() => {
  mockSelect.length = 0;
  mockInput.length = 0;
});

describe('PhoneInput — l indicatif sans drapeau en emoji', () => {
  it('part de la France (+33) et formate un numéro français', () => {
    const onChange = monter();
    expect(dernierSelect().value).toBe('+33');
    act(() => dernierInput().onChangeText('06 12 34 56 78'));
    expect(onChange).toHaveBeenLastCalledWith('+33612345678');
  });

  it('garde le code pays de chaque option de la liste', () => {
    monter();
    const { options } = dernierSelect();
    expect(options.length).toBeGreaterThan(200);
    expect(options.every((option) => /^[a-z]{2}$/.test(option.countryCode))).toBe(true);
    expect(options.find((option) => option.value === '+33').countryCode).toBe('fr');
    expect(options.find((option) => option.value === '+32').countryCode).toBe('be');
  });

  it('formate encore le numéro d un pays choisi dans la liste', () => {
    const onChange = monter();
    const belgique = dernierSelect().options.find((option) => option.value === '+32');
    act(() => dernierSelect().setValue(belgique));
    act(() => dernierInput().onChangeText('0470 12 34 56'));
    expect(onChange).toHaveBeenLastCalledWith('+32470123456');
  });

  it('n affiche plus de drapeau en emoji, ni fermé ni dans la liste', () => {
    monter();
    expect(dernierSelect().displayValue).toBe('FR +33');
    const libelles = dernierSelect().options.map((option) => option.label);
    expect(libelles.filter((libelle) => DRAPEAU.test(libelle))).toEqual([]);
    expect(dernierSelect().options.find((option) => option.value === '+33').label).toBe('France');
  });
});
