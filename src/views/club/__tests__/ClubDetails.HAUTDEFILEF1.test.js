import fs from 'fs';
import path from 'path';

// HAUT-DEFILE-F1 (12/11/2026, décision d'Adel « 245 B » : « le haut défile ») — la fiche d'un Club.
// Témoin CARACTÉRISANT (vert avant le lot, E6) : la fiche fait déjà défiler tout son haut (le
// choix du club, la carte d'identité ou l'en-tête compact de l'ordinateur) ; seule la barre de la
// flèche reste réservée (modèle : Installations, 10/11), et le pied flottant des actions reste
// posé en bas (barre d'action, exception BOUTONS-FLOTTANTS). Part figée en haut : la barre seule
// (~106 px sur 844, dont ~50 de barre système), avant comme après. Ce témoin empêche qu'un ajout
// futur se pose AU-DESSUS du défilement.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'ClubDetails.js'), 'utf8');

describe('HAUT-DEFILE-F1 — fiche Club : le haut défile déjà', () => {
  it('le premier enfant du cadre de la fiche est son défilement', () => {
    const rendu = SOURCE.slice(SOURCE.lastIndexOf('<CadreDeLaFiche'));
    const ouverture = rendu.indexOf('>') + 1;
    const premierEnfant = rendu.slice(ouverture).trimStart();
    expect(premierEnfant.startsWith('<DefilementDeLaFiche')).toBe(true);
  });

  it('le choix du club et la carte d identité sont DANS le défilement', () => {
    const rendu = SOURCE.slice(SOURCE.lastIndexOf('<CadreDeLaFiche'));
    const liste = rendu.slice(0, rendu.indexOf('</DefilementDeLaFiche>'));
    expect(liste).toContain('<ClubSelector');
    expect(liste).toContain('<TourTarget id="club.card">');
  });

  it('au téléphone, le défilement est une vraie liste (ScrollView), le guide la suit', () => {
    const defilement = SOURCE.slice(SOURCE.indexOf('function DefilementDeLaFiche('));
    expect(defilement).toContain('<ScrollView');
    expect(defilement).toContain('onScroll={tourScroll.onScroll}');
  });
});
