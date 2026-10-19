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
    // c est LA couture, et elle ne réécrit pas `userData`.
    // PAR-L12 (13/10) : la ligne unique d'avant (`isPlayerMode ? 'player' : …`) devient trois
    // lignes, parce que le mode parent s'y ajoute ; la couture « joueur » est la même.
    expect(SOURCE).toContain("if (isPlayerMode) modeActif = 'player';");
    expect(SOURCE).toContain('const roleKey = modeActif || getUserRoleKey(roleName);');
  });

  it('le bandeau d entrée et de retour est rendu EN TÊTE, avant la bannière d accueil', () => {
    const bandeau = SOURCE.indexOf('<PlayerModeBanner');
    const banniere = SOURCE.indexOf('<HomeHeadBanner');
    expect(bandeau).toBeGreaterThan(-1);
    expect(bandeau).toBeLessThan(banniere);
    // PAR-L12 : le bandeau rend un MODE (joueur, parent, ou rien) ; `setDisplayMode` le garde.
    expect(SOURCE).toContain('onChange={setDisplayMode}');
  });
});

// PAR-L12 (13/10, design parent §2 bis / E25 / E27, décision D6 A d'Adel du 12/10) — le MODE
// PARENT à l'accueil : le rôle de l'accueil suit le mode ACTIF (joueur ou parent), le bandeau
// reçoit les trois positions, et la feuille « Tu pratiques aussi un sport ? » est câblée.
describe('PAR-L12 — l accueil suit aussi le mode parent', () => {
  it('le rôle de l accueil devient « parent » en mode parent, « joueur » en mode joueur', () => {
    expect(SOURCE).toContain("if (isPlayerMode) modeActif = 'player';");
    expect(SOURCE).toContain("else if (isParentMode) modeActif = 'parent';");
    expect(SOURCE).toContain('const roleKey = modeActif || getUserRoleKey(roleName);');
  });

  it('le bandeau reçoit le mode actif, les prénoms, et le mode parent si enfants', () => {
    const debut = SOURCE.indexOf('<PlayerModeBanner');
    const bandeau = SOURCE.slice(debut, SOURCE.indexOf('/>', debut));
    expect(bandeau)
      .toContain('canUseParentMode={canUseParentMode === true && mesEnfants.total > 0}');
    expect(bandeau).toContain('displayMode={modeActif}');
    expect(bandeau).toContain('onChange={setDisplayMode}');
    expect(bandeau).toContain('onPratiqueAussi={ouvrirLaFeuillePratique}');
    expect(bandeau).toContain('prenoms={prenomsDesEnfants}');
  });

  it('la feuille « Tu pratiques aussi un sport ? » est rendue, et son succès est dit', () => {
    expect(SOURCE).toContain('<FeuillePratiqueAussi');
    expect(SOURCE).toContain('isVisible={feuillePratiqueOuverte}');
    expect(SOURCE).toContain("title: t('playerMode.sheet.done')");
  });
});
