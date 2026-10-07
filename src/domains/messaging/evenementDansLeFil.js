/**
 * MSG1A (§3.8 et §3.9) — CE QUE LA BULLE D'UN EVENEMENT PARTAGE SAIT DE CET EVENEMENT.
 *
 * Deux questions, et AUCUNE regle neuve : chacune est une composition des regles que
 * la fiche de l'evenement applique deja.
 *
 * 1. « Est-ce que je vois Present | Absent sous cette bulle, et qu'ai-je repondu ? »
 * 2. « Combien de presents, d'absents, de sans-reponse ? »
 */

import {
  buildParticipationsByStatus,
  countAnonymousUsers,
  getEventTrainerKeys,
} from '@/domains/event/eventParticipantSections';
import {
  getCurrentUserEventParticipationState,
  resolveRsvpAnswer,
  RsvpAnswer,
} from '@/domains/event/participationState';
import { isRsvpEnabled } from '@/domains/event/presenceRule';
import { resolveClientSourceTeamForUser } from '@/domains/participation/participationFlow';

import { getLocationCoordinates, normalizeLocationInput } from '@/utils/location';

/**
 * 1. LE SELECTEUR DE PRESENCE de la bulle (README §3.8 : « si l'evenement demande une
 * reponse, selecteur Present | Absent toujours visible »).
 *
 * Il ne s'offre qu'a qui la fiche offre DEJA la meme rangee (`EventAnswerButtons`) :
 * - MEMBRE d'une equipe conviee (`resolveClientSourceTeamForUser`, la definition que le
 *   serveur applique) — le joueur exterieur DEMANDE sa place, il ne repond pas : il
 *   passe par « Ouvrir l'evenement » ;
 * - reponses ouvertes par l'organisateur (`isRsvpEnabled`) ;
 * - evenement actif et pas encore commence : meme borne que `isFutureDatedEntity`
 *   (`participationFlow.js`), le serveur refusant toute reponse apres coup.
 *
 * La reponse se lit sur l'EVENEMENT (README : « rattachee a l'evenement, pas au
 * message ») : deux bulles du meme evenement montrent la meme.
 * @param {{ evenement: any, maintenantMs?: number, utilisateur: any }} params
 * @returns {{ reponse: 'present' | 'absent' | null } | null} `null` : pas de selecteur.
 */
export const presenceDansLeFil = ({ evenement, maintenantMs = Date.now(), utilisateur }) => {
  if (!evenement || !utilisateur) return null;
  if (evenement.isActive === false || !isRsvpEnabled(evenement)) return null;
  if (evenement.date) {
    const debut = new Date(evenement.date).getTime();
    if (!Number.isFinite(debut) || debut <= maintenantMs) return null;
  }
  if (!resolveClientSourceTeamForUser(evenement, utilisateur)) return null;

  const reponse = resolveRsvpAnswer(getCurrentUserEventParticipationState({
    missings: evenement.missings,
    participationRequests: evenement.participationRequests,
    participations: evenement.participations,
    user: utilisateur,
  }));
  return {
    reponse: reponse === RsvpAnswer.present || reponse === RsvpAnswer.absent
      ? /** @type {'present' | 'absent'} */ (reponse)
      : null,
  };
};

/**
 * 2. LA LIGNE « PARTICIPANTS » (README §3.9) : les trois nombres de la fiche, joueurs
 * seulement (les encadrants sont ecartes comme sur la fiche), comptes masques compris.
 *
 * 🔒 Les noms ne sortent pas d'ici : seuls les deux premiers PRESENTS (`visages`) sont
 * rendus, et la fiche montre deja la liste des presents a tout lecteur. Sous identites
 * masquees, la liste est vide et seuls les nombres restent.
 * ponytail: les demandes en attente comptent ici parmi les « sans reponse » (la fiche
 * les en retire) — le chiffre exact demande la requete des demandes, une de plus par bulle.
 * @param {any} evenement
 * @returns {{ absents: number, presents: number, sansReponse: number, visages: any[] } | null}
 *   `null` quand il n'y a rien a compter.
 */
export const resumeDesParticipants = (evenement) => {
  if (!evenement) return null;
  const { missing, notAnswered, participating } = buildParticipationsByStatus({
    canEdit: true,
    event: evenement,
    pendingParticipations: [],
    trainerKeys: getEventTrainerKeys(evenement),
  });
  const presentsMasques = countAnonymousUsers(evenement.participations);
  const absentsMasques = countAnonymousUsers(evenement.missings);
  const joueursMasques = [evenement.team, ...(evenement.invitedTeams || [])]
    .reduce((total, equipe) => total + countAnonymousUsers(equipe?.players), 0);

  const presents = participating.length + presentsMasques;
  const absents = missing.length + absentsMasques;
  const sansReponse = notAnswered.length
    + Math.max(0, joueursMasques - presentsMasques - absentsMasques);
  if (!presents && !absents && !sansReponse) return null;

  return {
    absents,
    presents,
    sansReponse,
    visages: participating.slice(0, 2),
  };
};

/**
 * 3. LE LIEU A OUVRIR DANS UNE APPLI DE CARTES (README §3.18) : l'adresse COMPLETE et ses
 * coordonnees quand l'evenement les porte — la bulle n'en affiche que la forme courte.
 * Meme lecture que la fiche de l'evenement (`EventHeader.js`, `handleOpenLocationInGps`).
 * @param {any} evenement
 * @param {string} libelleCourt - Ce que la bulle affiche, en repli.
 * @returns {{ label: string, latitude?: number, longitude?: number }}
 */
export const lieuAOuvrir = (evenement, libelleCourt) => {
  const lieu = normalizeLocationInput(evenement?.locationDetails)
    || normalizeLocationInput(evenement?.location);
  const coordonnees = getLocationCoordinates(evenement?.locationDetails)
    || getLocationCoordinates(evenement?.location);
  return {
    label: lieu?.label || libelleCourt,
    latitude: coordonnees?.lat ?? undefined,
    longitude: coordonnees?.lng ?? undefined,
  };
};
