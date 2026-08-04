import { getUserEntityKey, normalizeParticipationStatus } from '@/domains/event/participationState';

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

  if (myParticipation?.documentId) {
    return {
      kind: OwnAnswerAction.deleteParticipation,
      participationId: String(myParticipation.documentId),
    };
  }

  const isListedAsParticipant = (event?.participations || []).some(
    (participant) => getUserEntityKey(participant) === currentUserKey,
  );

  if (isListedAsParticipant && event?.documentId) {
    return { kind: OwnAnswerAction.declareMissing, participationId: '' };
  }

  return { kind: OwnAnswerAction.notFound, participationId: '' };
};

export default resolveOwnAnswerAction;
