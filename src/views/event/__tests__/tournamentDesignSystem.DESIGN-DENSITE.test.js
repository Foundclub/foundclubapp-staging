import { StyleSheet } from 'react-native';

import generateApplicationStyle from '@/theme/applicationStyle';
import generateColors from '@/theme/colors';
import generateFonts from '@/theme/fonts';
import Spaces from '@/theme/spaces';

import { createTournamentDesignSystem } from '../tournamentDesignSystem';

// ==========================================================================
// DESIGN-DENSITE (20/11/2026, Adel densite_go d1 + d2) — le style partagé des écrans du tournoi
// suit la règle de densité (src/theme/densite.js) : le contenu n'ajoute pas de marge latérale
// (le conteneur la pose : 16 / 24 / 40), 12 px entre deux blocs, coins de 16, une sous-partie se
// sépare par un trait fin. Recette 51 b, page d'équipe à 375 px : 24 + 24 = 48 px avant la
// première carte, une carte dans la carte, texte à 78 px du bord.
// ==========================================================================

const Colors = generateColors();
const ds = createTournamentDesignSystem({
  ApplicationStyle: generateApplicationStyle(Colors),
  Colors,
  Fonts: generateFonts(Colors),
  Spaces,
});
const aplatir = (/** @type {any} */ style) => StyleSheet.flatten(style);

describe('DESIGN-DENSITE · le style partagé du tournoi', () => {
  test('🔴 le contenu d écran n ajoute plus de marge latérale (avant : 24 + 24 du conteneur)', () => {
    const style = aplatir(ds.styles.screenContent);
    expect(style.paddingHorizontal ?? 0).toBe(0);
    expect(style.paddingLeft ?? 0).toBe(0);
  });

  test('🔴 12 px entre deux blocs (avant : 24)', () => {
    expect(aplatir(ds.styles.screenContent).gap).toBe(12);
  });

  test('🔴 les cartes du tournoi ont des coins de 16 (avant : 24)', () => {
    expect(aplatir(ds.styles.panelCard).borderRadius).toBe(16);
    expect(aplatir(ds.styles.compactPanelCard).borderRadius).toBeLessThanOrEqual(16);
  });

  test('🔴 une sous-partie dans une carte : un trait fin, pas un deuxième cadre', () => {
    const style = aplatir(ds.styles.nestedSection);
    expect(style.backgroundColor ?? 'transparent').toBe('transparent');
    expect(style.borderWidth ?? 0).toBe(0);
    expect(style.borderTopWidth).toBe(1);
    expect(style.paddingHorizontal ?? 0).toBe(0);
  });
});
