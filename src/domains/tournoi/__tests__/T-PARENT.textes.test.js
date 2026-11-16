/* eslint-disable max-len -- les témoins se lisent en entier. */
import { createHash } from 'crypto';

import { TEXTE_DE_L_AUTORISATION, VERSION_DE_L_AUTORISATION } from '../autorisationParentale';
import { PARAGRAPHES_DES_CONDITIONS, VERSION_DES_CONDITIONS } from '../conditionsTournoi';

// T-PARENT (15/11/2026) — les deux textes légaux du tournoi du 19/12.
// - L'autorisation parentale : son empreinte sha256 est celle que le serveur garde sous sa version (admin
//   `tournament-payment.js`, PARENTAL_CONSENT_VERSIONS ; témoin admin T-PARENT/P3 sur la même valeur). Changer une
//   virgule du texte sans nouvelle version rougit ici.
// - Les conditions d'inscription (CGV_INSCRIPTION partie II) : nom légal « Found Club », aucun passage encore entre
//   crochets, les 10 parties dans l'ordre.

const EMPREINTE_DU_SERVEUR = '2fcbffe15d0d24377e35a2e5eeb1c2a4a82c455eefb6e2fd5269e78f8fccb93f';

describe('T-PARENT — les textes du tournoi', () => {
  test('🔴 l autorisation : version v1 du 15/11 et empreinte égale à celle du serveur', () => {
    expect(VERSION_DE_L_AUTORISATION).toBe('tournament-parental-consent-v1-2026-11-15');
    expect(createHash('sha256').update(TEXTE_DE_L_AUTORISATION, 'utf8').digest('hex')).toBe(EMPREINTE_DU_SERVEUR);
  });

  test('🔴 l autorisation reprend les points de MINEURS.md (événement, santé, urgence, retour, conditions)', () => {
    ['19 décembre 2026', 'AR Soccer', '1 h au plus tard', 'sport de contact', 'joueurs majeurs', 'contre-indication', 'appeler les secours', 'rentre', 'conditions d\'inscription'].forEach((morceau) => expect(TEXTE_DE_L_AUTORISATION).toContain(morceau));
  });

  test('🔴 les conditions : 10 parties dans l ordre, « Found Club », aucun crochet, aucun gras restant', () => {
    const titres = PARAGRAPHES_DES_CONDITIONS.filter((p) => /^\d+\. /.test(p)).map((p) => Number(p.split('.')[0]));
    expect(titres).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const tout = PARAGRAPHES_DES_CONDITIONS.join('\n');
    expect(tout).toContain('organisé par Found Club (SIREN 940 032 253');
    expect(tout).not.toMatch(/\[|\]|\*\*/);
    expect(PARAGRAPHES_DES_CONDITIONS[1]).toBe(VERSION_DES_CONDITIONS);
  });

  // « conditions- A » (Adel, 16/11 ~15:00) : nouvelle date, et la conservation cite les noms et numéros de maillot.
  test('🔴 conditions- A : version du 16 novembre 2026, conservation « coordonnées, tailles, noms et numéros de maillot »', () => {
    expect(VERSION_DES_CONDITIONS).toBe('Version du 16 novembre 2026');
    const conservation = PARAGRAPHES_DES_CONDITIONS.find((p) => p.startsWith('Combien de temps : '));
    expect(conservation).toBe("Combien de temps : coordonnées, tailles, noms et numéros de maillot jusqu'au 31 mars 2027, puis effacés ; l'autorisation parentale, archivée 10 ans, à accès restreint, comme preuve en cas d'accident ; le nom de l'équipe et les résultats restent publiés comme palmarès ; les pièces comptables 10 ans (article L123-22 du Code de commerce) ; les images, la durée du § 7.");
    expect(PARAGRAPHES_DES_CONDITIONS.join(' ')).toContain('nom et numéro à imprimer sur le maillot (facultatifs)');
  });

  // Révision de D23 (Adel, 16/11 ~15:50) : Found Club a adhéré au médiateur CM2C ; texte du médiateur gardé tel quel.
  test('🔴 § 10 : médiation de la consommation CM2C (texte du médiateur), plus de conciliateur de justice, tribunal gardé', () => {
    const tout = PARAGRAPHES_DES_CONDITIONS.join('\n');
    expect(tout).toContain('Conformément aux dispositions du Code de la consommation concernant le processus de médiation des litiges de la consommation, après nous avoir sollicités et à défaut de réponse vous satisfaisant, vous avez la possibilité de recourir gratuitement à une procédure de médiation de la consommation auprès de : CM2C, 49 rue de Ponthieu, 75008 Paris. Tél : 01 89 47 00 14. Site internet : https://www.cm2c.net/declarer-un-litige.php. Mail : litiges@cm2c.net.');
    expect(tout).toContain('Le joueur peut aussi saisir le tribunal compétent.');
    expect(tout).toContain("Toute réclamation s'adresse par écrit à contact@foundclubpro.com");
    expect(tout).not.toMatch(/conciliateur/i);
    expect(tout).not.toMatch(/ec\.europa\.eu|odr|RLL/);
    expect(VERSION_DES_CONDITIONS).toBe('Version du 16 novembre 2026');
  });
});
