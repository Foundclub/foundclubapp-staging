import fs from 'fs';
import path from 'path';

// T-INVITATION-ACCUEIL (18/11/2026, Adel D237 ; constat M1357 de la recette 46) — l'invitation à
// rejoindre une équipe de tournoi se montre, en attente, en haut de l'accueil (téléphone et site :
// même HomeHub.js). HomeHub fait 3 200 lignes et dépend d'une vingtaine de contextes : le témoin
// lit son rendu principal (même méthode que HomeHub.HAUTDEFILEF1.test.js). La carte elle-même a son
// témoin monté : InvitationsTournoiAccueil.test.js.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');

/**
 * La liste qui défile du rendu principal de l'accueil.
 * @returns {string} Le texte entre `<ScrollView` et `</ScrollView>`.
 */
const liste = () => {
  const rendu = SOURCE.slice(SOURCE.lastIndexOf('<ScreenContainerView'));
  const debut = rendu.indexOf('<ScrollView');
  const fin = rendu.indexOf('</ScrollView>');
  if (debut === -1 || fin === -1) throw new Error('HomeHub n a plus sa liste principale');
  return rendu.slice(debut, fin);
};

// E6 — l'ordre des blocs du haut de l'accueil AVANT ce lot : aucun ne disparaît, aucun ne change de
// place.
const BLOCS_EXISTANTS = [
  '<TourTarget id="screen.header">',
  '<BandeauActualiteMembre',
  '<CollectivitePorteRow />',
  '<CollectiviteInvitationRow navigation={navigation} />',
  '<BasculeComplexe',
  '<PlayerModeBanner',
  '<FeuillePratiqueAussi',
  '<HomeHeadBanner',
  '<OnboardingWrapper',
  '<TourResumePill',
  '<TourOfferCard />',
  '<CarteProchaineReservation navigation={navigation} />',
];

describe('T-INVITATION-ACCUEIL — la carte d’invitation de tournoi en haut de l’accueil', () => {
  it('E6 : les blocs du haut de l’accueil restent tous là, dans le même ordre', () => {
    const texte = liste();
    const positions = BLOCS_EXISTANTS.map((bloc) => texte.indexOf(bloc));
    BLOCS_EXISTANTS.forEach((bloc, rang) => {
      expect([bloc, positions[rang]]).not.toEqual([bloc, -1]);
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('la carte se pose une fois, sous l’invitation de la Ville et avant la bascule de mode', () => {
    const texte = liste();
    const carte = '<InvitationsTournoiAccueil navigation={navigation} />';
    expect(texte.split(carte)).toHaveLength(2);
    expect(texte.indexOf(carte))
      .toBeGreaterThan(texte.indexOf('<CollectiviteInvitationRow navigation={navigation} />'));
    expect(texte.indexOf(carte)).toBeLessThan(texte.indexOf('<BasculeComplexe'));
    expect(SOURCE).toMatch(/import InvitationsTournoiAccueil from '@\/views\/home\/InvitationsTournoiAccueil';/);
  });
});
