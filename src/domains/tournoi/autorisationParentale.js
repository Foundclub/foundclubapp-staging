/* eslint-disable max-len */
/**
 * T-PARENT (15/11/2026, Adel D20 A) — LE TEXTE de l'autorisation parentale que le parent d'un joueur de 16 ou 17 ans
 * coche sur la page de paiement de la place (`/licenses/pay/:token`). Il reprend les 9 points de
 * `pilotage/tournoi-mtp/MINEURS.md` § 1 : le parent, l'ado (nommé par la page), l'événement, l'autorisation, la
 * santé, l'urgence, le retour (champ de la page), l'image (case SÉPARÉE, `TEXTE_DE_L_IMAGE`), la lecture des
 * conditions.
 *
 * ⛔ Une virgule changée ici = un autre texte : le serveur garde l'empreinte (sha256) de `TEXTE_DE_L_AUTORISATION`
 * sous `VERSION_DE_L_AUTORISATION` (admin `tournament-payment.js`, `PARENTAL_CONSENT_VERSIONS`). Changer le texte,
 * c'est une nouvelle version, ici ET côté serveur ; les témoins des deux côtés rougissent sinon.
 * ponytail: le texte nomme le tournoi du 19/12 (seul tournoi avec un âge minimum) ; un autre tournoi pour mineurs
 * demandera sa propre version.
 */

/** La version que la case fait accepter (`parentalConsent.legalVersion`). */
export const VERSION_DE_L_AUTORISATION = 'tournament-parental-consent-v1-2026-11-15';

/** @type {ReadonlyArray<string>} Les phrases, dans l'ordre où la page les montre. */
export const PHRASES_DE_L_AUTORISATION = Object.freeze([
  'Je suis le parent ou le représentant légal de ce joueur, et j\'autorise mon enfant à s\'inscrire et à participer au tournoi de football à 5 du samedi 19 décembre 2026, au complexe AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier, de 19 h (accueil) à 1 h au plus tard. C\'est un sport de contact, avec des joueurs majeurs.',
  'À ma connaissance, mon enfant n\'a pas de contre-indication à la pratique du football.',
  'J\'autorise l\'organisateur à appeler les secours et à faire transporter mon enfant à l\'hôpital ; je serai prévenu sans délai au numéro indiqué ci-dessus.',
  'Mon enfant rentre comme je l\'ai indiqué ci-dessus.',
  'J\'ai lu le règlement et les conditions d\'inscription du tournoi.',
]);

/** Le texte archivé (les phrases séparées par une ligne vide) : c'est lui que l'empreinte du serveur couvre. */
export const TEXTE_DE_L_AUTORISATION = PHRASES_DE_L_AUTORISATION.join('\n\n');

/** La case FACULTATIVE de l'image (C. civ. art. 372-1 : les deux parents, et l'ado). Non cochée par défaut. */
export const TEXTE_DE_L_IMAGE = 'Mon enfant et ses deux parents (ou moi seul, si j\'exerce seul l\'autorité parentale) acceptent qu\'il soit filmé et photographié pendant le tournoi, et que ces images soient publiées par Found Club et AR Soccer sur leurs réseaux, sites et applications, pendant 2 ans.';

/** Le lien du parent avec le joueur (valeurs envoyées au serveur). */
export const LIENS_DU_PARENT = Object.freeze(['father', 'mother', 'legal_guardian']);

/** Comment l'ado rentre (valeurs envoyées au serveur). */
export const RETOURS = Object.freeze(['alone', 'picked_up']);
