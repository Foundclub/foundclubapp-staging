/**
 * D48 A (17/11/2026, Adel) — LE RÈGLEMENT DU TOURNOI, SUR LA PAGE PUBLIQUE DES CONDITIONS
 * (`/conditions-tournoi#reglement`) : un seul lien donne tout.
 * Source : pilotage/tournoi-mtp/REGLEMENT.md (v3, dépôt méthode ace3971c). Aucun crochet ne reste.
 */
import { PARAGRAPHES_DES_CONDITIONS, VERSION_DES_CONDITIONS } from '../conditionsTournoi';
import { EN_TETE_DU_REGLEMENT, SECTIONS_DU_REGLEMENT } from '../reglementTournoi';

const texteDuReglement = () => [
  EN_TETE_DU_REGLEMENT,
  ...SECTIONS_DU_REGLEMENT.flatMap((section) => [section.titre || '', ...section.paragraphes]),
].join('\n');

describe('D48 A — le règlement du tournoi', () => {
  test('les 9 parties, dans l\'ordre, et l\'introduction', () => {
    expect(SECTIONS_DU_REGLEMENT.map((section) => section.titre)).toEqual([
      null,
      '1. L\'équipe',
      '2. Le jeu',
      '3. Cartons',
      '4. Le classement (phase de ligue)',
      '4 bis. La phase finale',
      '5. Forfaits et retards',
      '6. Réclamations',
      '7. Le reste',
    ]);
    expect(EN_TETE_DU_REGLEMENT).toMatch(/^Règlement du tournoi FoundClub x AR Soccer/);
  });

  test('aucun crochet, aucun gras Markdown, aucune puce : la recherche de « [ » vaut 0', () => {
    const texte = texteDuReglement();
    expect(texte.split('[').length - 1).toBe(0);
    expect(texte).not.toMatch(/\]|\*\*|^- /m);
    expect(texte).not.toMatch(/points entre crochets/);
  });

  test('les 2 retouches du chef du tournoi', () => {
    expect(texteDuReglement()).toContain(
      'Murs, rentrées et hauteur du ballon : selon les règles d\'AR Soccer, rappelées au briefing'
      + ' des capitaines.',
    );
  });

  test('les conditions ne bougent pas : même version, article 10 et CM2C en place', () => {
    expect(VERSION_DES_CONDITIONS).toBe('Version du 16 novembre 2026');
    expect(PARAGRAPHES_DES_CONDITIONS).toContain('10. Réclamations et litiges');
    const conditions = PARAGRAPHES_DES_CONDITIONS.join('\n');
    expect(conditions).toContain('CM2C, 49 rue de Ponthieu, 75008 Paris');
  });
});
