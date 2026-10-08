import { createElement } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TimePickerInput from '../TimePickerInput';

// ⏰ SAIS (08/10/2026, tournée T20 lot 1) — LE CHAMP D'HEURE A UN CADRE. Dans la feuille
// « Attribuer un créneau » (capture T07b), la boîte avait la couleur de la feuille : l'exemple
// « 17:30 » flottait comme du texte, sans rien qui dise « ici, on choisit ». Même cadre que le
// sélecteur de date, au téléphone comme au site.

const mockRoues = [];
jest.mock('@react-native-community/datetimepicker', () => function RoueMock(
  /** @type {any} */ props,
) {
  mockRoues.push(props);
  return null;
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

const osDOrigine = Platform.OS;
/** @type {any} */
let arbre = null;

const styleAplati = (/** @type {any} */ style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
  : (style || {}));
const monter = (/** @type {any} */ props = {}) => {
  mockRoues.length = 0;
  act(() => {
    arbre = renderer.create(createElement(TimePickerInput, {
      label: 'Début', onChange: jest.fn(), ...props,
    }));
  });
};

afterEach(() => {
  Platform.OS = osDOrigine;
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
});

describe.each(['ios', 'android'])('SAIS lot 1 — le cadre du champ d heure (%s)', (os) => {
  test('le champ a un CADRE ; rouge en erreur', () => {
    Platform.OS = os;
    monter({});
    const cadre = styleAplati(arbre.root.findAllByType(TouchableOpacity)[0].props.style);
    expect(cadre.borderWidth).toBe(1);
    expect(cadre.borderColor).toBeTruthy();
    monter({ error: 'Choisis une heure' });
    const enErreur = styleAplati(arbre.root.findAllByType(TouchableOpacity)[0].props.style);
    expect(enErreur.borderColor).not.toBe(cadre.borderColor);
  });
});

test('SAIS lot 1 — au site, la boîte du champ d heure a le même cadre', () => {
  Platform.OS = 'web';
  monter({ value: '18:00' });
  const boite = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.type === View
      && noeud.findAll((/** @type {any} */ n) => n.type === 'input', { deep: true }).length > 0,
  ).pop();
  expect(styleAplati(boite.props.style).borderWidth).toBe(1);
});
