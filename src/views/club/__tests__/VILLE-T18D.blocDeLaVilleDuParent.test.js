import { readFileSync } from 'fs';
import { join } from 'path';

import { showsCityNewsBlock } from '../clubDetailsActionMatrix';

// 👪 VILLE-T18D 6 (08/10/2026) — décision d'Adel « parent prévenu B » (relayée par le chef
// d'orchestre) : le bloc « De la Ville » de la fiche du club, et son interrupteur D68 « Me
// prévenir », s'affichent pour le PARENT d'un joueur mineur de CE club. La serrure du serveur
// (can-read-club-news) est le juge : la fiche ne fait qu'ouvrir la porte.
//
// Cause : ClubDetails posait le bloc sur `isMember` seul ; un parent (Papa Test) n'est membre
// d'aucun club, ses clubs sont ceux de ses enfants.
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   - un membre : le bloc, comme avant ; un visiteur sans enfant : rien ;
//   - un compte au rôle Parent : le bloc est posé, le serveur juge (refus ⇒ le bloc, qui attend
//     sa réponse, ne s'affiche pas) ;
//   - un compte d'un autre rôle qui a déclaré un enfant MINEUR dans CE club : le bloc ; un enfant
//     majeur, ou dans un autre club : rien ;
//   - la fiche du club passe par ce juge.

const CLUB = 'as-montrivage';

describe('VILLE-T18D 6 — la porte du bloc « De la Ville » sur la fiche du club', () => {
  it('un membre : le bloc, comme avant ; sans club, rien', () => {
    expect(showsCityNewsBlock({ clubId: CLUB, isMember: true })).toBe(true);
    expect(showsCityNewsBlock({ clubId: CLUB, isMember: false })).toBe(false);
    expect(showsCityNewsBlock({ clubId: null, isMember: true })).toBe(false);
  });

  it('un compte au rôle Parent : le bloc est posé, le serveur juge', () => {
    expect(showsCityNewsBlock({ clubId: CLUB, isMember: false, isParentRole: true })).toBe(true);
  });

  it('un enfant MINEUR déclaré dans CE club : le bloc ; majeur ou ailleurs : rien', () => {
    const enfant = (club, age) => ({
      age, club: { documentId: club }, documentId: `e-${club}-${age}`,
    });
    const porte = (enfants) => showsCityNewsBlock({ clubId: CLUB, enfants, isMember: false });
    expect(porte([enfant(CLUB, 11)])).toBe(true);
    expect(porte([enfant(CLUB, 19)])).toBe(false);
    expect(porte([enfant('autre-club', 11)])).toBe(false);
    expect(porte(undefined)).toBe(false);
  });

  it('la fiche du club passe par ce juge (membre, rôle Parent, enfants déclarés)', () => {
    const source = readFileSync(join(__dirname, '..', 'ClubDetails.js'), 'utf8');
    expect(source).toMatch(/afficheLeBlocDeLaVille = showsCityNewsBlock\(\{[\s\S]{0,200}isMember,/);
    expect(source).toMatch(/\{afficheLeBlocDeLaVille \? \(\s*<BlocDeLaVille/);
    expect(source).toMatch(/isParentRole: [^,\n]*USER_ROLES\.parent/);
    expect(source).not.toMatch(/isMember && clubId \? \(\s*<BlocDeLaVille/);
  });
});
