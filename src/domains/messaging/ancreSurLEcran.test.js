import { ancreSurLEcran } from './reactionPillPlacement';

// MSG1A (§3.2) — la decoupe du voile de l'appui long doit encadrer LA bulle touchee.
// Constate sur l'emulateur (07/10) : 142 px trop haut sur Android = la barre d'etat.

const MESURE = {
  height: 87, width: 860, x: 21, y: 2004,
};

describe('ancreSurLEcran', () => {
  test('AE1 — Android : la mesure descend de la hauteur de la barre d etat', () => {
    expect(ancreSurLEcran(MESURE, { hauteurBarreDEtat: 142, os: 'android' }))
      .toEqual({ ...MESURE, y: 2146 });
  });

  test('AE2 — iPhone : la mesure est deja celle de l ecran, rien ne bouge', () => {
    expect(ancreSurLEcran(MESURE, { hauteurBarreDEtat: 47, os: 'ios' })).toEqual(MESURE);
  });

  test('AE3 — hauteur inconnue : rien ne bouge, plutot qu un decalage invente', () => {
    expect(ancreSurLEcran(MESURE, { hauteurBarreDEtat: undefined, os: 'android' }))
      .toEqual(MESURE);
  });
});
