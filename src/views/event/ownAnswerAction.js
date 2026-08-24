import { getUserEntityKey, normalizeParticipationStatus } from '@/domains/event/participationState';
import { resolveClientSourceTeamForUser } from '@/domains/participation/participationFlow';

/**
 * Les quatre suites possibles quand le joueur appuie sur le bouton qui porte sa
 * propre reponse — « Modifier ma reponse » (il avait dit absent) ou « Annuler ma
 * participation » (il avait dit present, ou sa demande est en attente).
 * @type {Readonly<Record<string, string>>}
 */
export const OwnAnswerAction = Object.freeze({
  declareMissing: 'declare-missing',
  deleteParticipation: 'delete-participation',
  none: 'none',
  notFound: 'not-found',
  switchToPresent: 'switch-to-present',
});

/**
 * Decide ce que fait le bouton qui porte la reponse du joueur sur EventDetails.
 *
 * Extrait de `handleDeleteParticipation` (EventDetails.js), qui n'avait aucun
 * filet sur 6 000 lignes (E6) : la decision est pure et testee ici, l'Alert reste
 * dans l'ecran. Meme motif que `eventAttendanceGate.js`.
 * @param {{
 *   activeEventParticipations?: any[];
 *   event?: any;
 *   user?: any;
 * }} input
 * @returns {{ kind: string; participationId: string }}
 */
export const resolveOwnAnswerAction = ({ activeEventParticipations = [], event, user }) => {
  const currentUserKey = getUserEntityKey(user);
  if (!currentUserKey) return { kind: OwnAnswerAction.none, participationId: '' };

  const myParticipation = (activeEventParticipations || []).find(
    (participation) => participation?.documentId
      && getUserEntityKey(participation?.user) === currentUserKey,
  );

  // La REPONSE deja donnee departage les deux libelles — jamais la simple presence
  // d'une ligne. Une reponse « absent » EST une participation active : tester
  // « une ligne existe » d'abord rendait la bascule absent -> present
  // inatteignable, et « Modifier ma reponse » supprimait la reponse.
  const answeredMissing = normalizeParticipationStatus(myParticipation?.participationStatus) === 'missing'
    || (event?.missings || []).some((missing) => getUserEntityKey(missing) === currentUserKey);

  if (answeredMissing) {
    return { kind: OwnAnswerAction.switchToPresent, participationId: '' };
  }

  const isListedAsParticipant = (event?.participations || []).some(
    (participant) => getUserEntityKey(participant) === currentUserKey,
  );

  // R4 (DECISION D ADEL DU 2026-08-24) — « ANNULER MA PARTICIPATION » MARQUE
  // ABSENT, il n efface plus.
  //
  // La vue joueur offrait DEUX boutons pour un seul geste ; il n en reste qu un,
  // et c est ICI que se decide ce qu il fait — pas dans le composant. Un seul
  // endroit, teste, que la fiche et la carte de liste consultent toutes deux.
  //
  // 🔒 LA LIGNE DE PARTAGE EST CELLE DU SERVEUR : `POST /events/:id/missing`
  // EXIGE une equipe source (`event.ts:3068`). On reutilise donc la fonction qui
  // fait deja apparaitre ce bouton dans `EventAnswerButtons`
  // (`resolveClientSourceTeamForUser`) : meme predicat des deux cotes, le
  // libelle ne peut pas diverger du geste.
  //
  // ⛔ JAMAIS UNE DEMANDE EN ATTENTE : personne ne l a acceptee, donc personne
  // ne l attendait. La ranger chez les absents fausserait le compteur. Un statut
  // inconnu s en remet a `event.participations`, que le serveur tient.
  const rowStatus = normalizeParticipationStatus(myParticipation?.participationStatus);
  const answeredPresent = rowStatus === 'accepted' || (!rowStatus && isListedAsParticipant);
  const isConvenedMember = Boolean(resolveClientSourceTeamForUser(event, user));

  if (myParticipation?.documentId) {
    if (isConvenedMember && answeredPresent && event?.documentId) {
      return { kind: OwnAnswerAction.declareMissing, participationId: '' };
    }

    return {
      kind: OwnAnswerAction.deleteParticipation,
      participationId: String(myParticipation.documentId),
    };
  }

  if (isListedAsParticipant && event?.documentId) {
    return { kind: OwnAnswerAction.declareMissing, participationId: '' };
  }

  return { kind: OwnAnswerAction.notFound, participationId: '' };
};

export default resolveOwnAnswerAction;
