import { createElement } from 'react';
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchSlotEditor from '../FriendlyMatchSlotEditor';

// CORR-ROBUSTESSE point 57 (recette du site, 30/10) — la ligne d'une date (un bouton, « Modifier »)
// contenait la croix « Retirer la date » (un autre bouton) : sur le site, un <button> dans un
// <button>, que React signale et qui peut faire partir le mauvais geste.
// Caractérisation : appuyer sur la ligne remet la date dans le formulaire, la croix la retire.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ k, /** @type {any} */ r) => {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object' && typeof r.defaultValue === 'string') return r.defaultValue;
      return k;
    },
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const p = new Proxy(() => p, { get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : p) });
  const couleurs = jest.requireActual('@/theme/colors').default();
  return () => ({
    Alignments: p, Colors: couleurs, Fonts: p, Spaces: p,
  });
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function Jour({ value }) {
  // eslint-disable-next-line global-require
  const { Text } = require('react-native');
  return <Text testID="jour">{value}</Text>;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => () => null);
jest.mock('@/components/atoms/button/Button', () => () => null);

const SLOT = { date: '2026-11-14', end: '12:00', start: '10:00' };

/** @type {any[]} */
const montes = [];
afterEach(() => { montes.splice(0).forEach((a) => act(() => a.unmount())); });

const monter = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(FriendlyMatchSlotEditor, {
      onAdd: jest.fn(), onRemove: jest.fn(), slots: [SLOT], ...props,
    }));
  });
  montes.push(arbre);
  return arbre;
};

const parNom = (/** @type {any} */ arbre, /** @type {RegExp} */ motif) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity
    && motif.test(String(n.props.accessibilityLabel || '')),
)[0];

test('CORR57/1 — 🔒 la croix retire la date', () => {
  const onRemove = jest.fn();
  const arbre = monter({ onRemove });
  act(() => { parNom(arbre, /^Retirer la date/).props.onPress(); });
  expect(onRemove).toHaveBeenCalledWith('2026-11-14');
});

test('CORR57/2 — 🔒 appuyer sur la ligne remet la date dans le formulaire', () => {
  const arbre = monter();
  const avant = arbre.root.findByProps({ testID: 'jour' }).props.children;
  act(() => { parNom(arbre, /\d/).props.onPress(); });
  expect(arbre.root.findByProps({ testID: 'jour' }).props.children).not.toBe(avant);
});

test('CORR57/3 — aucun bouton dans un autre bouton', () => {
  const arbre = monter();
  const imbriques = arbre.root.findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ bouton) => bouton.findAllByType(TouchableOpacity).length > 1);
  expect(imbriques).toHaveLength(0);
});
