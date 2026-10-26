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
  // ANONSERVEUR — le serveur a déjà masqué cette personne pour moi (drapeau, pas un texte
  // comparé) : son nom masqué fait foi, « Capitaine Adverse » compris, que la liste des fils
  // (sans les équipes du match) ne saurait pas recalculer.
  if (personne?.anonyme === true) return { anonyme: true, nom: vraiNom.trim() };
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

/**
 * ANONSERVEUR — le prénom devant l'aperçu d'un fil (« Prénom : dernier message »), colonne
 * « Messages » et aperçu du fil : un adversaire avant le match y reste « Joueur Adverse ».
 * @param {{ chat: any, moiId?: string, personne: any, maintenant?: Date }} faits - Comme
 *   {@link identiteDansLeFil}.
 * @returns {string} Le prénom à écrire.
 */
export const prenomDansLeFil = (faits) => {
  const identite = identiteDansLeFil(faits);
  return identite.anonyme ? identite.nom : String(faits.personne?.firstname || '').trim();
};

/**
 * ANONSERVEUR — « Partager un contact » : les membres du fil, sauf moi et les adversaires
 * masqués. Une carte de contact porte l'identifiant de la personne : elle ouvrirait son profil.
 * @param {{ chat: any, moiId?: string, personnes: any[] }} faits - Le fil, mon identifiant et
 *   ses membres.
 * @returns {any[]} Les personnes que je peux partager.
 */
export const contactsPartageables = ({ chat, moiId = '', personnes }) => (
  Array.isArray(personnes) ? personnes : []
).filter((/** @type {any} */ personne) => (
  personne?.documentId
  && personne.documentId !== moiId
  && !identiteDansLeFil({ chat, moiId, personne }).anonyme
));

/**
 * ANONSITE — LA PERSONNE À DESSINER dans un fil de ligue : elle-même, ou, pour un adversaire
 * avant le match, une personne sans photo dont le prénom est « Joueur Adverse » (ou « Capitaine
 * Adverse »). Les écrans qui lisent `firstname`, `lastname` et `avatar` (bulle, initiales,
 * frappe, votants, citations) n'ont rien d'autre à changer.
 * @param {{ chat: any, moiId?: string, personne: any, maintenant?: Date }} faits - Comme
 *   {@link identiteDansLeFil}.
 * @returns {any} La personne à montrer (`anonyme: true` quand elle est masquée).
 */
export const personneDansLeFil = (faits) => {
  const identite = identiteDansLeFil(faits);
  if (!identite.anonyme) return faits.personne;
  return {
    anonyme: true,
    avatar: null,
    documentId: faits.personne?.documentId,
    firstname: identite.nom,
    lastname: '',
  };
};
