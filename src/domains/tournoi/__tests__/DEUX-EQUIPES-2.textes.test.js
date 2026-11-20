/* eslint-disable max-len -- les phrases se lisent en entier. */
import { PARAGRAPHES_DES_CONDITIONS, VERSION_DES_CONDITIONS } from '../conditionsTournoi';
import { EN_TETE_DU_REGLEMENT, SECTIONS_DU_REGLEMENT } from '../reglementTournoi';

// ==========================================================================
// DEUX-EQUIPES-2 (19/11/2026) — LES TEXTES DU TOURNOI SUIVENT LE CODE, livrés avec lui :
//   D282 « A » (Adel) : la place payée suit le joueur qui change d'équipe, sans remboursement ;
//   D63 « A » (Adel) : une équipe validée ne redescend pas sous 5 joueurs payés ;
//   chef du tournoi (19/11) : « La même règle vaut quand le capitaine retire un joueur payé. »,
//   conditions en « Version du 19 novembre 2026 ».
// Phrases exactes : pilotage/tournoi-mtp/CGV_INSCRIPTION.md § 3 et § 5, REGLEMENT.md § 1 (553caf43).
// ==========================================================================

const REGLE_DU_JOUEUR = 'La place payée suit le joueur. S\'il change d\'équipe dans le même tournoi, il ne repaie pas : sa place passe dans la nouvelle équipe, et l\'ancienne équipe compte un joueur payé de moins';
const REGLE_D63 = 'Une équipe validée ne redescend pas : un joueur payé ne peut pas la quitter si elle passe ainsi sous 5 joueurs payés. Il peut partir dès qu\'un 6ᵉ joueur a payé. La même règle vaut quand le capitaine retire un joueur payé.';

describe('DEUX-EQUIPES-2 — conditions d’inscription', () => {
  test('🔴 § 3 : la place payée suit le joueur, puis la règle D63 (phrase du chef du tournoi)', () => {
    // DEUX-EQUIPES-3 (20/11, D65 = B) : l'exception de l'organisateur suit dans le même paragraphe ; avant : toContain exact.
    expect(PARAGRAPHES_DES_CONDITIONS.some((p) => p.startsWith(`${REGLE_DU_JOUEUR}. ${REGLE_D63}`))).toBe(true);
  });

  test('🔴 § 5 : changer d’équipe ne rembourse plus, la place passe dans la nouvelle équipe', () => {
    expect(PARAGRAPHES_DES_CONDITIONS).toContain('Le joueur change d\'équipe dans le même tournoi (§ 3) : aucun remboursement ; sa place payée passe dans la nouvelle équipe.');
  });

  test('🔴 l’ancienne règle (place attachée à l’équipe, accord de Found Club, remboursement de l’ancienne place) a disparu', () => {
    const tout = PARAGRAPHES_DES_CONDITIONS.join('\n');
    expect(tout).not.toContain('attachée à l\'équipe');
    expect(tout).not.toContain('avec l\'accord de Found Club');
  });

  test('🔴 nouvelle date (convention D247 : la date suit le dernier changement)', () => {
    expect(VERSION_DES_CONDITIONS).toBe('Version du 20 novembre 2026'); // DEUX-EQUIPES-3 (20/11) : D65 = B, avant : 'Version du 19 novembre 2026'
    expect(PARAGRAPHES_DES_CONDITIONS[1]).toBe(VERSION_DES_CONDITIONS);
  });
});

describe('DEUX-EQUIPES-2 — règlement', () => {
  const equipe = SECTIONS_DU_REGLEMENT.find((section) => section.titre === '1. L\'équipe');

  test('🔴 § 1 : même règle, renvoi au § 3 des conditions, puis D63', () => {
    // DEUX-EQUIPES-3 (20/11, D65 = B) : l'exception suit dans le même paragraphe ; avant : toContain exact.
    expect(equipe.paragraphes.some((p) => p.startsWith(`${REGLE_DU_JOUEUR} (conditions d'inscription, § 3). ${REGLE_D63}`))).toBe(true);
    expect(equipe.paragraphes.join('\n')).not.toContain('attachée à l\'équipe');
  });

  test('l’en-tête du règlement ne change pas (le chef du tournoi n’a pas changé sa version)', () => {
    expect(EN_TETE_DU_REGLEMENT.endsWith('(v6, 20/11)')).toBe(true); // DEUX-EQUIPES-3 (20/11) : avant '(v4, 18/11)'
  });
});
