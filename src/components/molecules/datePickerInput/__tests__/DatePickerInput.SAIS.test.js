/* eslint-disable max-len -- des montages entiers, lus d une traite */
import { createElement } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import DatePickerInput from '../DatePickerInput';

// 📅 SAIS (08/10/2026, tournée T20 lot 1) — UNE DATE VIDE SE DIT PAREIL PARTOUT. Au téléphone,
// « Fermer » et « Bloquer » montraient une boîte VIDE, sans indication ni icône (captures T04a,
// T06a) ; « Demander un créneau » disait « Choisis un jour » (T08a) : c'est le modèle, désormais
// par défaut, avec une icône calendrier. Et la boîte a un CADRE : posée sur une feuille de sa
// couleur (« Attribuer », T07b), elle disparaissait.

const mockSelecteurs = [];
jest.mock('@react-native-community/datetimepicker', () => function SelecteurMock(
  /** @type {any} */ props,
) {
  mockSelecteurs.push(props);
  return null;
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

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

const monter = (/** @type {any} */ props) => {
  act(() => {
    arbre = renderer.create(createElement(DatePickerInput, {
      label: 'Jour', onChange: jest.fn(), ...props,
    }));
  });
};
const textes = () => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));
const styleAplati = (/** @type {any} */ style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
  : (style || {}));

beforeEach(() => {
  mockSelecteurs.length = 0;
});

afterEach(() => {
  Platform.OS = osDOrigine;
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
});

test('SAIS lot 1 — au site, la boîte du champ de date a le même cadre', () => {
  Platform.OS = 'web';
  monter({ value: '07/10/2026' });
  const boite = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.type !== 'string'
      && noeud.findAll((/** @type {any} */ n) => n.type === 'input', { deep: true }).length > 0
      && noeud.props.style,
  ).pop();
  expect(styleAplati(boite.props.style).borderWidth).toBe(1);
});

describe.each(['ios', 'android'])('SAIS lot 1 — la date vide, au téléphone (%s)', (os) => {
  beforeEach(() => {
    Platform.OS = os;
  });

  test('sans valeur ni texte d’invite : « Choisis un jour »', () => {
    monter({});
    expect(textes()).toEqual(['Jour', 'Choisis un jour']);
  });

  test('un texte d’invite de l’écran l’emporte (« Fin de la saison »)', () => {
    monter({ placeholder: 'Fin de la saison' });
    expect(textes()).toEqual(['Jour', 'Fin de la saison']);
  });

  test('une icône calendrier dans le champ, vide ou rempli', () => {
    monter({});
    expect(arbre.root.findAllByType(SvgIcon).map((icone) => icone.props.name))
      .toEqual(['calendar-days']);
    act(() => {
      arbre.update(createElement(DatePickerInput, { label: 'Jour', onChange: jest.fn(), value: '07/10/2026' }));
    });
    expect(arbre.root.findAllByType(SvgIcon)).toHaveLength(1);
    expect(textes()).toContain('mercredi 7 octobre 2026');
  });

  test('le champ a un CADRE (visible sur une feuille de la même couleur) ; rouge en erreur', () => {
    monter({});
    const cadre = styleAplati(arbre.root.findAllByType(TouchableOpacity)[0].props.style);
    expect(cadre.borderWidth).toBe(1);
    expect(cadre.borderColor).toBeTruthy();
    act(() => {
      arbre.update(createElement(DatePickerInput, { error: 'Choisis une date', label: 'Jour', onChange: jest.fn() }));
    });
    const enErreur = styleAplati(arbre.root.findAllByType(TouchableOpacity)[0].props.style);
    expect(enErreur.borderColor).not.toBe(cadre.borderColor);
  });
});
