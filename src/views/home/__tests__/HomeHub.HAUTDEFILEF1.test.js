import fs from 'fs';
import path from 'path';

// HAUT-DEFILE-F1 (12/11/2026, décision d'Adel « 245 B » : « le haut défile ») — l'Accueil (et la
// racine de l'onglet Rechercher, `SearchHome`, même écran). La rangée du haut (logo, cloche,
// profil, ~80 px + la barre système) restait FIGÉE au-dessus de la liste : ~130 px sur 844 sur un
// iPhone (15 %). Elle passe en tête de ce qui défile, comme l'en-tête de Rechercher depuis le
// 30/10 (CORR-RECHERCHE) ; seule la barre système reste réservée (~50 px, 6 %).
// HomeHub fait 3 200 lignes et dépend d'une vingtaine de contextes : le témoin lit son rendu
// principal (même méthode que accueilParRole.test.js et l'essai T3-BANDEAU-HAUT du 03/11).

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

/**
 * Le rendu principal de l'accueil, découpé autour de sa liste.
 * @returns {{ avant: string, liste: string, apres: string }} Les trois tranches.
 */
const decouper = () => {
  const rendu = SOURCE.slice(SOURCE.lastIndexOf('<ScreenContainerView'));
  const debut = rendu.indexOf('<ScrollView');
  const fin = rendu.indexOf('</ScrollView>');
  if (debut === -1 || fin === -1) throw new Error('HomeHub n a plus sa liste principale');
  return {
    apres: rendu.slice(fin),
    avant: rendu.slice(0, debut),
    liste: rendu.slice(debut, fin),
  };
};

describe('HAUT-DEFILE-F1 — Accueil : le haut défile', () => {
  it('logo, cloche et profil sont DANS la liste qui défile', () => {
    const { liste } = decouper();
    expect(liste).toContain('<LeagueHeaderSwitch onPress={scrollToTop} />');
    expect(liste).toContain('<NotificationBadge />');
    expect(liste).toContain('<ProfileButton hasAlert={cotisationAPayer} />');
  });

  it('rien du haut ne reste posé au-dessus de la liste', () => {
    const { avant } = decouper();
    expect(avant).not.toContain('LeagueHeaderSwitch');
    expect(avant).not.toContain('NotificationBadge');
    expect(avant).not.toContain('ProfileButton');
  });

  it('la rangée garde son ancre du guide et passe en tête, avant le bandeau de la Ville', () => {
    const { liste } = decouper();
    const ancre = liste.indexOf('<TourTarget id="screen.header">');
    expect(ancre).toBeGreaterThan(-1);
    expect(ancre).toBeLessThan(liste.indexOf('<LeagueHeaderSwitch'));
    expect(ancre).toBeLessThan(liste.indexOf('<BandeauActualiteMembre'));
  });
});
