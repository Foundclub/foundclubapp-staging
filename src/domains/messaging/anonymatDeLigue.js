import { isLeagueCaptain } from '@/utils/league/captains';

/**
 * Q4-06 (P6-05 persistant) — QUI EST CETTE PERSONNE DANS UN FIL DE MATCH DE LIGUE ?
 *
 * La règle vivait dans `Conversation.js` (`getAnonymizedName`) et ne servait qu'à la bulle :
 * la frappe (« Karim écrit… »), les votants d'un sondage, leurs photos et les citations
 * donnaient encore le vrai nom de l'adversaire avant le match. Elle rend un DRAPEAU
 * (`anonyme`), pour qu'aucun appelant n'ait à comparer un texte (décision B du chef, 25/10).
 *
 * Avant la date du match, un adversaire (ni moi, ni un coéquipier) s'appelle « Capitaine
 * Adverse » ou « Joueur Adverse » ; tout autre fil, ou après le match, garde le vrai nom.
 * @param {{ chat: any, moiId?: string, personne: any, maintenant?: Date }} faits - Le fil, mon
 *   identifiant, la personne (`documentId`, `firstname`, `lastname`), et l'heure.
 * @returns {{ anonyme: boolean, nom: string }} Le nom à afficher, et s'il est masqué.
 */
const identiteDansLeFil = ({
  chat, maintenant = new Date(), moiId = '', personne,
}) => {
  const vraiNom = `${personne?.firstname || ''} ${personne?.lastname || ''}`;
  if (chat?.type !== 'league_match') return { anonyme: false, nom: vraiNom };
  if (personne?.documentId === moiId) return { anonyme: false, nom: vraiNom };
  const dateDuMatch = chat?.league_match?.date;
  if (dateDuMatch && new Date(dateDuMatch) < maintenant) return { anonyme: false, nom: vraiNom };
  const coequipiers = Array.isArray(chat?.myTeamMembers) ? chat.myTeamMembers : [];
  if (coequipiers.some((/** @type {any} */ m) => m.documentId === personne?.documentId)) {
    return { anonyme: false, nom: vraiNom };
  }
  const capitaine = isLeagueCaptain(chat?.league_match?.team_a, personne)
    || isLeagueCaptain(chat?.league_match?.team_b, personne);
  return { anonyme: true, nom: capitaine ? 'Capitaine Adverse' : 'Joueur Adverse' };
};

export default identiteDansLeFil;
