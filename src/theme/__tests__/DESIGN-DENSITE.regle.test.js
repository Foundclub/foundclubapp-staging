import { StyleSheet } from 'react-native';

import { BREAKPOINTS } from '@/responsive/breakpoints';
import generateApplicationStyle from '@/theme/applicationStyle';
import generateColors from '@/theme/colors';
import { DENSITE, margeDePage } from '@/theme/densite';
import generateFonts from '@/theme/fonts';
import Spaces from '@/theme/spaces';
import { createTournamentDesignSystem } from '@/views/event/tournamentDesignSystem';

// ==========================================================================
// DESIGN-DENSITE (20/11/2026) — la règle de densité, validée par Adel (densite_go d1 = A,
// GO daté du cliquet du thème). Mesuré sur la recette 51 b : deux ou trois cadres emboîtés,
// chacun avec 22 à 24 px de marge ; maquette : un cadre, 16 px. Ces témoins fixent les chiffres
// pour qu'un lot ne les reperde pas (garde-fou G1).
// ==========================================================================

const Colors = generateColors();
const ds = createTournamentDesignSystem({
  ApplicationStyle: generateApplicationStyle(Colors),
  Colors,
  Fonts: generateFonts(Colors),
  Spaces,
});
const aplatir = (/** @type {any} */ style) => StyleSheet.flatten(style);

describe('DESIGN-DENSITE · les chiffres de la règle', () => {
  test('marges de page : 16 téléphone, 24 tablette, 40 ordinateur, sur les points de rupture du site', () => {
    expect(margeDePage(375)).toBe(16);
    expect(margeDePage(BREAKPOINTS.tablet - 1)).toBe(16);
    expect(margeDePage(BREAKPOINTS.tablet)).toBe(24);
    expect(margeDePage(BREAKPOINTS.desktop - 1)).toBe(24);
    expect(margeDePage(BREAKPOINTS.desktop)).toBe(40);
    expect(margeDePage(1440)).toBe(40);
  });

  test('cartes, listes, écarts, boutons, photo, largeur', () => {
    expect(DENSITE).toMatchObject({
      boutonMin: 44,
      boutonPrincipal: 47,
      carteMiseEnAvantRayon: 20,
      cartePadding: 16,
      carteRayon: 16,
      colonneLaterale: 380,
      contenuMax: 1200,
      ecartBlocs: 12,
      ecartColonnes: 28,
      ecartSection: 24,
      ecartSousTitre: 12,
      ligneMin: 56,
      photoHauteurOrdinateur: 280,
      photoHauteurTelephone: 236,
      photoRayonOrdinateur: 20,
    });
  });
});

describe('DESIGN-DENSITE · le style partagé du tournoi', () => {
  test('🔴 le contenu d écran n ajoute plus de marge latérale (avant : 24 + 24 du conteneur)', () => {
    const style = aplatir(ds.styles.screenContent);
    expect(style.paddingHorizontal ?? 0).toBe(0);
    expect(style.paddingLeft ?? 0).toBe(0);
  });

  test('🔴 12 px entre deux blocs (avant : 24)', () => {
    expect(aplatir(ds.styles.screenContent).gap).toBe(DENSITE.ecartBlocs);
  });

  test('🔴 les cartes du tournoi ont des coins de 16 (avant : 24)', () => {
    expect(aplatir(ds.styles.panelCard).borderRadius).toBe(DENSITE.carteRayon);
    expect(aplatir(ds.styles.compactPanelCard).borderRadius).toBeLessThanOrEqual(DENSITE.carteRayon);
  });

  test('🔴 une sous-partie dans une carte : un trait fin, pas un deuxième cadre', () => {
    const style = aplatir(ds.styles.nestedSection);
    expect(style.backgroundColor ?? 'transparent').toBe('transparent');
    expect(style.borderWidth ?? 0).toBe(0);
    expect(style.borderTopWidth).toBe(1);
    expect(style.paddingHorizontal ?? 0).toBe(0);
  });
});
