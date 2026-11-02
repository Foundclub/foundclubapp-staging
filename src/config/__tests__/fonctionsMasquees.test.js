const fs = require('fs');
const path = require('path');

// 🙈 LE REGISTRE DES FONCTIONS MASQUÉES — lot ACCUEIL (audit V1, décisions
// d'Adel du 30/09 : A02 option A, A07 option A).
//
// Ce témoin ROUGIT quand quelqu'un rallume un interrupteur. C'est voulu : rallumer
// la League ou les Réservations est une décision d'Adel, pas un effet de bord
// d'un lot. Celui qui la reçoit met ce témoin à jour, et le registre
// `D:/App/fc/FONCTIONS_MASQUEES.md` avec lui.

const {
  CARTES_ACCUEIL_MASQUEES,
  COMPLEXES_GERANT,
  COMPLEXES_JOUEUR,
  LEAGUE_SUR_ACCUEIL,
  RESERVATIONS_SUR_ACCUEIL,
} = require('../fonctionsMasquees');

describe('les interrupteurs de l accueil (décisions d Adel du 30/09)', () => {
  it('A02 — FoundClub League est ÉTEINTE sur l accueil', () => {
    expect(LEAGUE_SUR_ACCUEIL).toBe(false);
  });

  it('A07 — la case « Réservations » est ALLUMÉE sur l accueil, RESA-OUVERTURE', () => {
    expect(RESERVATIONS_SUR_ACCUEIL).toBe(true);
  });

  it('RESA-L5A1 — l espace du gérant de complexe est ALLUMÉ, RESA-OUVERTURE', () => {
    expect(COMPLEXES_GERANT).toBe(true);
  });

  it('RESA-L6A — la réservation côté joueur est ALLUMÉE, RESA-OUVERTURE', () => {
    expect(COMPLEXES_JOUEUR).toBe(true);
  });

  it('la case retirée de l accueil, par sa clef', () => {
    expect(CARTES_ACCUEIL_MASQUEES).toEqual(['league-entry']);
  });

  it('LE CODE EST GARDÉ : la case masquée existe toujours dans l accueil', () => {
    // « Rien n'est supprimé » (A02, A07) : rallumer ne doit pas obliger à réécrire.
    const chemin = path.resolve(__dirname, '..', '..', 'views', 'home', 'HomeHub.js');
    const accueil = fs.readFileSync(chemin, 'utf8');

    CARTES_ACCUEIL_MASQUEES.forEach((clef) => {
      expect(accueil).toContain(`key: '${clef}'`);
    });
  });
});
