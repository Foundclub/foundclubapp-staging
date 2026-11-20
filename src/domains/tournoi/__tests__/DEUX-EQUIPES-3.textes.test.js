/* eslint-disable max-len -- les phrases se lisent en entier. */
import { PARAGRAPHES_DES_CONDITIONS, VERSION_DES_CONDITIONS } from '../conditionsTournoi';
import { EN_TETE_DU_REGLEMENT, SECTIONS_DU_REGLEMENT } from '../reglementTournoi';

// ==========================================================================
// DEUX-EQUIPES-3 (20/11/2026, Adel « 65- oui », D65 = B) — L'ORGANISATEUR PEUT RETIRER UN JOUEUR PAYÉ même si
// l'équipe passe sous 5 joueurs payés. Phrases du chef du tournoi recopiées à l'octet (BRIEF du banc
// .local/bancs/DEUX-EQUIPES-3-2011), chacune juste après « La même règle vaut quand le capitaine retire un joueur
// payé. » ; une seule date par texte publié, celle du dernier changement.
// ==========================================================================

const D63 = 'La même règle vaut quand le capitaine retire un joueur payé.';
const EXCEPTION_CONDITIONS = "Cette règle ne s'applique pas quand l'organisateur retire un joueur, dans trois cas : retrait remboursé demandé au plus tard le 5 décembre 2026 (§ 5), exclusion prévue au règlement (§ 3), autorisation parentale manquante (§ 9). L'équipe peut alors passer sous 5 joueurs payés. Avant la clôture, elle a jusqu'au 10 décembre 2026 à 23 h 59 pour se compléter ; à défaut, elle n'est pas validée et ses places sont remboursées (§ 5). Après la clôture, elle joue avec les joueurs qui restent.";
const EXCEPTION_REGLEMENT = "Exception : l'organisateur peut retirer un joueur payé, même si l'équipe passe sous 5, pour un retrait remboursé (conditions § 5), une exclusion (§ 3) ou une autorisation parentale manquante. Après la clôture, l'équipe joue avec les joueurs qui restent.";

describe('DEUX-EQUIPES-3 — conditions d’inscription', () => {
  test('🔴 § 3 : l’exception de l’organisateur, juste après la règle du capitaine', () => {
    const paragraphe = PARAGRAPHES_DES_CONDITIONS.find((p) => p.includes(D63));
    expect(paragraphe.endsWith(`${D63} ${EXCEPTION_CONDITIONS}`)).toBe(true);
  });

  test('🔴 « Version du 20 novembre 2026 », affichée sous le titre', () => {
    expect(VERSION_DES_CONDITIONS).toBe('Version du 20 novembre 2026');
    expect(PARAGRAPHES_DES_CONDITIONS[1]).toBe(VERSION_DES_CONDITIONS);
  });
});

describe('DEUX-EQUIPES-3 — règlement', () => {
  test('🔴 § 1 : l’exception, juste après la même phrase', () => {
    const equipe = SECTIONS_DU_REGLEMENT.find((section) => section.titre === '1. L\'équipe');
    const paragraphe = equipe.paragraphes.find((p) => p.includes(D63));
    expect(paragraphe.endsWith(`${D63} ${EXCEPTION_REGLEMENT}`)).toBe(true);
  });

  test('🔴 en-tête « v6, 20/11 »', () => {
    expect(EN_TETE_DU_REGLEMENT.endsWith('(v6, 20/11)')).toBe(true);
  });
});
