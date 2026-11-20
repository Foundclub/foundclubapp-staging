/* eslint-disable max-len -- titres de témoins en phrases */
import { ImageBackground, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/theme/themeContext', () => {
  const vide = {};
  const rampe = () => new Proxy({}, { get: () => vide });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: new Proxy({}, { get: (_c, cle) => `couleur-${String(cle)}` }),
      Fonts: new Proxy({}, { get: () => vide }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// DESIGN-DENSITE (20/11/2026, GO d'Adel d1 + d2) — la photo du tournoi en tête de fiche :
// maquette 6b = bord à bord sur le téléphone (toute la largeur, 236 px de haut) ; 6d = largeur de
// la colonne, 280 px, coins de 20. Recette 51 b à 375 px : 290 px de large sur 375, 184 de haut,
// dans un cadre. L'écran qui affiche la fiche dit au bandeau la marge de sa page (`bandeau.marge`).

const TOURNOI = {
  club: { name: 'AR Soccer' },
  date: '2099-12-19T18:00:00.000Z',
  documentId: 'event-1',
  name: 'FoundClub x AR Soccer',
  startTime: '19:00:00',
  type: { name: 'Tournoi' },
};

const styleDuFond = (/** @type {any} */ tournamentHero) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<EventHeader event={TOURNOI} tournamentHero={tournamentHero} />);
  });
  const style = StyleSheet.flatten(arbre.root.findAllByType(ImageBackground)[0].props.style);
  act(() => arbre.unmount());
  return style;
};

describe('DESIGN-DENSITE · la photo du tournoi', () => {
  test('🔴 téléphone : bord à bord (la marge de la page en négatif), sans coins, 236 px', () => {
    const style = styleDuFond({ bandeau: { hauteur: 236, marge: 16, rayon: 0 }, statusLabel: null });
    expect(style).toMatchObject({ borderRadius: 0, marginHorizontal: -16, minHeight: 236 });
  });

  test('🔴 ordinateur : largeur de la colonne, 280 px, coins de 20', () => {
    const style = styleDuFond({ bandeau: { hauteur: 280, marge: 0, rayon: 20 }, statusLabel: null });
    expect(style).toMatchObject({ borderRadius: 20, minHeight: 280 });
    expect(style.marginHorizontal ?? 0).toBe(0);
  });

  test('🔒 sans consigne (fiche de l app) : comme avant, 184 px', () => {
    const style = styleDuFond({ statusLabel: null });
    expect(style.minHeight).toBe(184);
    expect(style.marginHorizontal ?? 0).toBe(0);
  });
});
