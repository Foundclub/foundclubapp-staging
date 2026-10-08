/* eslint-disable max-len -- des titres de témoins entiers, lus d une traite */
import { createElement } from 'react';
import {
  Platform, Text, TouchableOpacity, View,
} from 'react-native';
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

// ⏰ SAIS — DÉCISION D'ADEL « heure A » (08/10 ~16h15) : la roue / le cadran s'ouvre sur la valeur,
// sinon sur l'EXEMPLE HH:mm affiché (« 17:30 »), sinon sur une heure ronde ; « OK » ÉCRIT la
// valeur affichée (iPhone : il ne faisait que fermer, la valeur ne s'écrivait qu'au cran de roue —
// « OK direct, ça ne s'enregistre pas », TestFlight 2.6.71) ; « Annuler » (iPhone) n'écrit rien.
// Android : le cadran natif rend « set » avec la valeur montrée au OK sans geste. ROUGES avant.
describe('SAIS heure A — « OK » sans toucher écrit la valeur affichée', () => {
  /** @type {string[]} */
  let ecrites = [];
  const ouvrir = (/** @type {any} */ props) => {
    ecrites = [];
    monter({ onChange: (/** @type {string} */ heure) => ecrites.push(heure), ...props });
    act(() => { arbre.root.findAllByType(TouchableOpacity)[0].props.onPress(); });
  };
  const roue = () => mockRoues[mockRoues.length - 1];
  const presser = (/** @type {string} */ libelle) => {
    // Le bouton le plus INTÉRIEUR qui porte ce texte (le voile de la feuille le contient aussi).
    const cible = arbre.root.findAllByType(TouchableOpacity).filter(
      (/** @type {any} */ noeud) => noeud.findAllByType(Text)
        .some((/** @type {any} */ texte) => [].concat(texte.props.children).join('') === libelle),
    ).pop();
    if (!cible) throw new Error(`aucun bouton « ${libelle} »`);
    act(() => { cible.props.onPress(); });
  };
  const heureDe = (/** @type {Date} */ date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  describe('iPhone', () => {
    beforeEach(() => { Platform.OS = 'ios'; });

    test('vide avec un exemple « 17:30 » : la roue s’ouvre sur 17:30, « OK » écrit 17:30', () => {
      ouvrir({ placeholder: '17:30', value: '' });
      expect(heureDe(roue().value)).toBe('17:30');
      presser('OK');
      expect(ecrites).toEqual(['17:30']);
    });

    test('vide sans exemple (« HH:mm ») : une heure RONDE, « OK » l’écrit', () => {
      ouvrir({ value: '' });
      expect(roue().value.getMinutes()).toBe(0);
      const montree = heureDe(roue().value);
      presser('OK');
      expect(ecrites).toEqual([montree]);
    });

    test('tourner n écrit rien tant qu’on n’a pas dit « OK » ; « OK » écrit l’heure tournée', () => {
      ouvrir({ value: '09:30' });
      act(() => { roue().onChange({ type: 'set' }, new Date(2026, 9, 8, 7, 5)); });
      expect(ecrites).toEqual([]);
      presser('OK');
      expect(ecrites).toEqual(['07:05']);
    });

    test('« Annuler » après avoir tourné : rien n’est écrit, la valeur d’avant reste', () => {
      ouvrir({ value: '09:30' });
      act(() => { roue().onChange({ type: 'set' }, new Date(2026, 9, 8, 7, 5)); });
      presser('Annuler');
      expect(ecrites).toEqual([]);
      act(() => { arbre.root.findAllByType(TouchableOpacity)[0].props.onPress(); });
      expect(heureDe(roue().value)).toBe('09:30');
    });

    test('toucher le voile, c’est annuler', () => {
      ouvrir({ placeholder: '17:30', value: '' });
      const voile = arbre.root.findAllByType(TouchableOpacity)
        .find((/** @type {any} */ noeud) => noeud.props.activeOpacity === 1);
      act(() => { voile.props.onPress(); });
      expect(ecrites).toEqual([]);
    });
  });

  describe('Android', () => {
    beforeEach(() => { Platform.OS = 'android'; });

    test('vide avec un exemple « 18:00 » : le cadran s’ouvre sur 18:00, « OK » sans geste l’écrit', () => {
      ouvrir({ placeholder: '18:00', value: '' });
      expect(heureDe(roue().value)).toBe('18:00');
      act(() => { roue().onChange({ type: 'set' }, roue().value); });
      expect(ecrites).toEqual(['18:00']);
    });

    test('vide sans exemple : une heure ronde', () => {
      ouvrir({ value: '' });
      expect(roue().value.getMinutes()).toBe(0);
    });
  });
});
