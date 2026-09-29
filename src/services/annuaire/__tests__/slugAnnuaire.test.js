import { cheminFicheAnnuaire, slugAnnuaire } from '../slugAnnuaire';

// ANNUAIRE-E1 (29/09) — le slug d'un nom et l'adresse PUBLIQUE d'une fiche club.
//
// Le serveur nomme chaque fiche `/annuaire/clubs/<documentId>/<slugify(nom) || documentId>/`
// (admin public-directory.ts : `slug: slugify(name) || documentId`, puis buildSeoClubPath).
// Caddy ne sert une fiche que si SA coquille existe : un slug calculé autrement donnerait, au
// rechargement ou à Google, la page vide (/seo-not-found.html). Le calcul doit donc être le MÊME.

describe('slugAnnuaire — caractérisation (comportement déjà en service)', () => {
  test.each([
    ['Football', 'football'],
    ["L'Étoile Sportive", 'l-etoile-sportive'],
    ['Ping-Pong Club', 'ping-pong-club'],
    ['  AS   Mazargues  ', 'as-mazargues'],
    ['', ''],
    [null, ''],
  ])('%p → %p', (nom, attendu) => {
    expect(slugAnnuaire(nom)).toBe(attendu);
  });
});

// Serveur : admin search/services/normalize.ts (APOSTROPHE_AND_DASH_REGEX).
describe('slugAnnuaire — les apostrophes du registre, comme le serveur', () => {
  // Le serveur change en ESPACE toute apostrophe ou tout tiret AVANT de retirer les accents :
  // l'accent aigu isolé (U+00B4) et l'accent grave (U+0060) sont eux-mêmes des « diacritiques »,
  // ils seraient sinon EFFACÉS et recolleraient les deux mots (« letoile », pas « l-etoile »).
  test.each([
    ['L`ETOILE', 'l-etoile'],
    ['L´ETOILE', 'l-etoile'],
    ['L‘ETOILE', 'l-etoile'],
    ['SAINT–JEAN', 'saint-jean'],
  ])('%p → %p', (nom, attendu) => {
    expect(slugAnnuaire(nom)).toBe(attendu);
  });
});

describe('cheminFicheAnnuaire — l adresse publique de la fiche, celle que Google connaît', () => {
  test('✅ un club : /annuaire/clubs/<documentId>/<slug du nom>/', () => {
    const smuc = {
      documentId: 'ic7d3061tukho4e36rpgv7c6', name: 'STADE MARSEILLAIS UNIVERSITE CLUB (SMUC)',
    };
    expect(cheminFicheAnnuaire(smuc))
      .toBe('/annuaire/clubs/ic7d3061tukho4e36rpgv7c6/stade-marseillais-universite-club-smuc/');
  });

  test('📌 un nom sans lettre ni chiffre : le slug est le documentId (règle du serveur)', () => {
    expect(cheminFicheAnnuaire({ documentId: 'abc123', name: '***' }))
      .toBe('/annuaire/clubs/abc123/abc123/');
  });

  test('⛔ sans documentId : aucun lien (rien à ouvrir)', () => {
    expect(cheminFicheAnnuaire({ name: 'Club' })).toBeNull();
    expect(cheminFicheAnnuaire(null)).toBeNull();
  });

  test('⛔ un club multisport n a pas de fiche d annuaire : aucun lien', () => {
    const omnisport = { _type: 'multisport', documentId: 'cm-1', name: 'Omnisport' };
    expect(cheminFicheAnnuaire(omnisport)).toBeNull();
  });
});
