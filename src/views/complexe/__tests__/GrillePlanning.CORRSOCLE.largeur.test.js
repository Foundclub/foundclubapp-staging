import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import GrillePlanning from '../components/GrillePlanning';

// CORR-SOCLE (30/10, point 8 de la recette du site, décision d'Adel « A ») — sur ordinateur, la
// semaine du complexe défilait de côté : samedi coupé, dimanche invisible. Les colonnes se
// calculaient sur la largeur de la FENÊTRE (1 440 px → 194 px par jour) alors que la grille n'a
// que la place laissée par le menu et le cadre. Elles se calculent sur la place mesurée.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: 1440,
  }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const colonnes = JOURS.map((jour, index) => ({
  cle: jour,
  creneaux: [{
    date: `2026-11-0${index + 2}`,
    from: '18:00',
    startsAt: `2026-11-0${index + 2}T17:00:00.000Z`,
    state: 'free',
    terrainId: 't1',
    terrainNom: 'Terrain 1',
    to: '19:00',
  }],
  titre: jour,
}));

const largeursDesJours = (/** @type {any} */ arbre) => arbre.root.findAllByType(View)
  .map((/** @type {any} */ v) => StyleSheet.flatten(v.props.style) || {})
  .filter((/** @type {any} */ s) => typeof s.width === 'number' && s.width !== 44)
  .map((/** @type {any} */ s) => s.width);

/**
 * Monte la grille, puis lui donne sa largeur mesurée.
 * @param {number} largeur - La place de la grille.
 * @returns {number[]} Les largeurs des colonnes de jour.
 */
const largeursPour = (largeur) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(GrillePlanning, {
      colonnes, estActif: () => true, onAppuiLong: () => {}, onToucher: () => {},
    }));
  });
  const grille = arbre.root
    .findAll((/** @type {any} */ n) => n.props.testID === 'grille-planning')[0];
  const layout = {
    height: 600, width: largeur, x: 0, y: 0,
  };
  act(() => grille.props.onLayout({ nativeEvent: { layout } }));
  return largeursDesJours(arbre);
};

describe('CORR-SOCLE point 8 — les 7 jours tiennent dans la place de la grille', () => {
  test('grille de 900 px (menu et cadre déduits) : 7 colonnes de 122 px, rien de côté', () => {
    const largeurs = largeursPour(900);
    expect(largeurs).toHaveLength(7);
    expect(new Set(largeurs)).toEqual(new Set([122]));
    expect(44 + 7 * 122).toBeLessThanOrEqual(900);
  });

  test('place étroite (téléphone) : 104 px au moins, la grille défile de côté comme avant', () => {
    expect(new Set(largeursPour(342))).toEqual(new Set([104]));
  });
});
