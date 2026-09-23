import { fitTacticalFieldInBox, getTacticalFieldAspectRatio } from '@/utils/tacticalField';

// COMPOMSG — le terrain le plus grand qui tient dans une boîte, AUX PROPORTIONS
// de son sport. Sur le site, la surface du terrain du plein écran (un ratio,
// ni largeur ni hauteur) valait 0 px : le plateau calcule désormais sa taille.

describe('COMPOMSG — fitTacticalFieldInBox', () => {
  test('🥇 boîte haute : le terrain prend toute la LARGEUR utile, la hauteur suit le ratio', () => {
    const taille = fitTacticalFieldInBox({ height: 900, width: 390 }, 'football', 14);

    expect(taille).toEqual({ height: 543, width: 362 });
    expect(taille.height / taille.width).toBeCloseTo(getTacticalFieldAspectRatio('football'), 2);
  });

  test('🥇 boîte basse : le terrain prend toute la HAUTEUR, la largeur suit le ratio', () => {
    const taille = fitTacticalFieldInBox({ height: 450, width: 1000 }, 'football', 14);

    expect(taille).toEqual({ height: 450, width: 300 });
  });

  test('le ratio vient du sport (le basket est plus haut que le football)', () => {
    const basket = fitTacticalFieldInBox({ height: 340, width: 1000 }, 'basketball', 0);

    expect(basket).toEqual({ height: 340, width: 200 });
  });

  test('🔒 une boîte vide ou absente ne rend rien — jamais un terrain de 0 × 0', () => {
    expect(fitTacticalFieldInBox(null, 'football')).toBeNull();
    expect(fitTacticalFieldInBox({ height: 0, width: 390 }, 'football')).toBeNull();
    expect(fitTacticalFieldInBox({ height: 500, width: 20 }, 'football', 14)).toBeNull();
  });
});
