import {
  doitFermer,
  OPACITE_MINIMALE_DU_FOND,
  opaciteDuFond,
} from '../gesteDeFermeture';

// MSGIMG — la regle du « glisser vers le bas pour fermer », partagee par le telephone et
// le site. Un ecran de 844 px de haut (iPhone 14) : le seuil tombe a ≈ 152 px.

const HAUTEUR = 844;

describe('MSGIMG — doitFermer', () => {
  test('au-dela de 18 % de l ecran, l image se ferme ; en deca, elle revient', () => {
    expect(doitFermer(160, 0, HAUTEUR)).toBe(true);
    expect(doitFermer(140, 0, HAUTEUR)).toBe(false);
  });

  test('un coup sec vers le bas ferme meme court, mais pas un simple appui', () => {
    expect(doitFermer(60, 1500, HAUTEUR)).toBe(true);
    expect(doitFermer(10, 3000, HAUTEUR)).toBe(false);
  });

  test('vers le haut, ou sans mesure, rien ne se ferme', () => {
    expect(doitFermer(-400, -3000, HAUTEUR)).toBe(false);
    expect(doitFermer(Number.NaN, 0, HAUTEUR)).toBe(false);
    expect(doitFermer(/** @type {any} */ (undefined), 0, HAUTEUR)).toBe(false);
  });
});

describe('MSGIMG — opaciteDuFond', () => {
  test('opaque au repos, il s eclaircit a mesure que l image descend', () => {
    expect(opaciteDuFond(0, HAUTEUR)).toBe(1);
    expect(opaciteDuFond(-50, HAUTEUR)).toBe(1);
    const aMiChemin = opaciteDuFond(200, HAUTEUR);
    expect(aMiChemin).toBeLessThan(1);
    expect(opaciteDuFond(300, HAUTEUR)).toBeLessThan(aMiChemin);
  });

  test('jamais sous son plancher, et jamais NaN si la hauteur manque', () => {
    expect(opaciteDuFond(5000, HAUTEUR)).toBe(OPACITE_MINIMALE_DU_FOND);
    expect(opaciteDuFond(200, 0)).toBe(1);
  });
});
