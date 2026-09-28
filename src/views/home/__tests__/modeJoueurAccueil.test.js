const fs = require('fs');
const path = require('path');

// LOT RÔLES (2026-09-28) — écran 3 : l'ACCUEIL en mode joueur.
//
// Même méthode que ses voisins (`accueilParRole.test.js`) : HomeHub fait près
// de 3 000 lignes et dépend d'une vingtaine de contextes — le contrôle se fait
// sur la SOURCE. Il vérifie les deux coutures qui font le mode joueur à
// l'accueil ; le comportement lui-même est mesuré par le vrai hook
// (`useAuth.ROLES.modeJoueur.test.js`) et par le bandeau (`PlayerModeBanner`).
// Écrit ROUGE (aucune des deux coutures n'existait).

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

describe('RÔLES — l accueil suit le mode joueur', () => {
  it('le rôle de l accueil devient « joueur » quand le mode est actif', () => {
    // Tout l accueil (section Gérer, bandeau, cartes) se déduit de `roleKey` :
    // c est LA couture, une seule ligne, et elle ne réécrit pas `userData`.
    expect(SOURCE).toContain("const roleKey = isPlayerMode ? 'player' : getUserRoleKey(roleName);");
  });

  it('le bandeau d entrée et de retour est rendu EN TÊTE, avant la bannière d accueil', () => {
    const bandeau = SOURCE.indexOf('<PlayerModeBanner');
    const banniere = SOURCE.indexOf('<HomeHeadBanner');
    expect(bandeau).toBeGreaterThan(-1);
    expect(bandeau).toBeLessThan(banniere);
    expect(SOURCE).toContain('onChange={setPlayerMode}');
  });
});
