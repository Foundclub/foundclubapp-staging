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
  LEAGUE_SUR_ACCUEIL,
  RESERVATIONS_SUR_ACCUEIL,
} = require('../fonctionsMasquees');

describe('les interrupteurs de l accueil (décisions d Adel du 30/09)', () => {
  it('A02 — FoundClub League est ÉTEINTE sur l accueil', () => {
    expect(LEAGUE_SUR_ACCUEIL).toBe(false);
  });

  it('A07 — la case « Réservations » est ÉTEINTE sur l accueil', () => {
    expect(RESERVATIONS_SUR_ACCUEIL).toBe(false);
  });

  it('RESA-L5A1 (13/10) — l espace du gérant de complexe est ÉTEINT (serveur non livré)', () => {
    expect(COMPLEXES_GERANT).toBe(false);
  });

  it('les deux cases retirées de l accueil, par leur clef', () => {
    expect(CARTES_ACCUEIL_MASQUEES).toEqual(['league-entry', 'search-reservations']);
  });

  it('LE CODE EST GARDÉ : les deux cases existent toujours dans l accueil', () => {
    // « Rien n'est supprimé » (A02, A07) : rallumer ne doit pas obliger à réécrire.
    const chemin = path.resolve(__dirname, '..', '..', 'views', 'home', 'HomeHub.js');
    const accueil = fs.readFileSync(chemin, 'utf8');

    CARTES_ACCUEIL_MASQUEES.forEach((clef) => {
      expect(accueil).toContain(`key: '${clef}'`);
    });
  });
});
