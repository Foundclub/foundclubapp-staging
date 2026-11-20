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
    // D247 (T-SANS-PLAFOND) : texte changé le 18/11
    // Avant : 'Version du 18 novembre 2026' (D247) ;
    // DEUX-EQUIPES-2 (19/11) : D282 et D63, nouvelle date (chef du tournoi).
    // DEUX-EQUIPES-3 (20/11) : D65 = B, avant : 'Version du 19 novembre 2026'
    expect(VERSION_DES_CONDITIONS).toBe('Version du 20 novembre 2026');
    expect(PARAGRAPHES_DES_CONDITIONS).toContain('10. Réclamations et litiges');
    const conditions = PARAGRAPHES_DES_CONDITIONS.join('\n');
    expect(conditions).toContain('CM2C, 49 rue de Ponthieu, 75008 Paris');
  });
});

// D48, 3e tache (17/11, chef FoundClub) — LE MODÈLE D'AUTORISATION PARENTALE PAPIER, sous le
// règlement (`#autorisation`) ; l'adresse du complexe en UN seul endroit du code.
describe('D48 — le modèle d\'autorisation parentale', () => {
  // eslint-disable-next-line global-require
  const modele = () => require('../modeleAutorisationParentale');
  // eslint-disable-next-line global-require
  const conditions = () => require('../conditionsTournoi');
  // (PARAGRAPHES_DES_CONDITIONS : l'import du haut, le même module.)

  test('le titre, et rien de pré-rempli ni de commentaire pour le lot', () => {
    const { BLOCS_DE_L_AUTORISATION, TITRE_DE_L_AUTORISATION } = modele();
    expect(TITRE_DE_L_AUTORISATION)
      .toBe('Autorisation parentale — Tournoi FoundClub x AR Soccer du 19 décembre 2026');
    const texte = BLOCS_DE_L_AUTORISATION.map((bloc) => bloc.texte || '').join('\n');
    expect(texte).not.toMatch(/<!--|-->|Note pour le lot|<br>|\*\*/);
    expect(texte).toContain('Signature du parent ou du représentant légal :');
    expect(BLOCS_DE_L_AUTORISATION.filter((bloc) => bloc.genre === 'signature')).toHaveLength(1);
  });

  test('l\'adresse du complexe vient de la constante unique, dans les trois textes', () => {
    const { ADRESSE_DU_COMPLEXE } = conditions();
    expect(ADRESSE_DU_COMPLEXE).toBe('119 rue de la Rauze basse, 34070 Montpellier');
    const textes = {
      autorisation: modele().BLOCS_DE_L_AUTORISATION.map((bloc) => bloc.texte || '').join('\n'),
      conditions: PARAGRAPHES_DES_CONDITIONS.join('\n'),
      reglement: SECTIONS_DU_REGLEMENT.flatMap((section) => section.paragraphes).join('\n'),
    };
    Object.values(textes).forEach((texte) => expect(texte).toContain(ADRESSE_DU_COMPLEXE));
    // Écrite une seule fois dans le code : les trois fichiers la lisent.
    const fs = jest.requireActual('fs');
    const path = jest.requireActual('path');
    const ecrite = ['conditionsTournoi.js', 'reglementTournoi.js', 'modeleAutorisationParentale.js']
      .map((fichier) => fs.readFileSync(path.join(__dirname, '..', fichier), 'utf8'))
      .join('\n')
      .split(ADRESSE_DU_COMPLEXE).length - 1;
    expect(ecrite).toBe(1);
  });
});

describe('D48 — les cases à cocher de l\'autorisation', () => {
  test('13 cases, marquées et dessinées par la page, sans pictogramme dans le texte', () => {
    // eslint-disable-next-line global-require
    const { BLOCS_DE_L_AUTORISATION, MARQUE_DE_CASE } = require('../modeleAutorisationParentale');
    const texte = BLOCS_DE_L_AUTORISATION.map((bloc) => bloc.texte || '').join('\n');
    expect(texte.split(MARQUE_DE_CASE).length - 1).toBe(13);
    expect(texte).not.toMatch(/\u2610/);
  });
});
