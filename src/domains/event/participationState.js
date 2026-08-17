const getUserEntityKey = (user) => {
  if (!user || typeof user !== 'object') return null;
  if (user.documentId) return `doc:${String(user.documentId).trim()}`;
  if (user.id != null) return `id:${String(user.id)}`;
  return null;
};

const doesEntityBelongToUser = (entityUser, targetUser) => {
  const entityKey = getUserEntityKey(entityUser);
  const targetKey = getUserEntityKey(targetUser);
  return Boolean(entityKey && targetKey && entityKey === targetKey);
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isActiveParticipation = (participation) => participation?.isActive !== false;

const compareParticipationsByRecency = (left, right) => {
  const activeDelta = Number(isActiveParticipation(right)) - Number(isActiveParticipation(left));
  if (activeDelta !== 0) return activeDelta;

  const updatedAtDelta = toTimestamp(right?.updatedAt) - toTimestamp(left?.updatedAt);
  if (updatedAtDelta !== 0) return updatedAtDelta;

  const createdAtDelta = toTimestamp(right?.createdAt) - toTimestamp(left?.createdAt);
  if (createdAtDelta !== 0) return createdAtDelta;

  return String(right?.documentId || right?.id || '').localeCompare(
    String(left?.documentId || left?.id || ''),
  );
};

const normalizeParticipationStatus = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'accepted' || status === 'pending' || status === 'missing' || status === 'declined') {
    return status;
  }
  return null;
};

export const getLatestActiveParticipationForUser = ({
  participationRequests = [],
  user,
}) => {
  const relevantRequests = (participationRequests || [])
    .filter((request) => doesEntityBelongToUser(request?.user, user))
    .filter(isActiveParticipation)
    .sort(compareParticipationsByRecency);

  return relevantRequests[0] || null;
};

export const getCurrentUserEventParticipationState = ({
  missings = [],
  participationRequests = [],
  participations = [],
  user,
}) => {
  const activeRequest = getLatestActiveParticipationForUser({
    participationRequests,
    user,
  });
  const requestStatus = normalizeParticipationStatus(activeRequest?.participationStatus);

  const isParticipating = (participations || []).some((participant) => doesEntityBelongToUser(participant, user));
  const isMissing = (missings || []).some((missing) => doesEntityBelongToUser(missing, user));
  const effectiveStatus = requestStatus
    || (isParticipating ? 'accepted' : null)
    || (isMissing ? 'missing' : null);

  return {
    activeRequest,
    effectiveStatus,
    hasAcceptedRequest: requestStatus === 'accepted',
    hasPendingRequest: requestStatus === 'pending',
    isMissing,
    isParticipating,
    requestStatus,
  };
};

/**
 * Les trois etats qu'un joueur peut voir sur SA propre reponse a un evenement.
 * @type {Readonly<Record<string, string>>}
 */
export const RsvpAnswer = Object.freeze({
  absent: 'absent',
  pending: 'pending',
  present: 'present',
});

/**
 * MA reponse a un evenement, telle qu'un bouton doit l'afficher.
 *
 * T02 — cette echelle existait deja, ecrite a la main dans `EventAnswerButtons`
 * (le composant des deux cartes et de la fiche d'evenement). Le bandeau de
 * l'accueil devait la relire : au lieu d'en ecrire une seconde — « deux regles
 * qui divergent, c'est le defaut le plus cher a retrouver » — elle est nommee ici,
 * a cote de `getCurrentUserEventParticipationState` qui produit son entree, et les
 * DEUX lecteurs l'appellent. C'est ce qui rend impossible que le bandeau et la
 * fiche affichent des etats differents.
 *
 * ⚠️ L'ORDRE EST LE DEFAUT, PAS UN DETAIL : `isMissing` passe en premier. Un
 * joueur peut rester liste dans `participations` alors qu'il vient de repondre
 * « absent » (les relations de l'evenement sont resynchronisees apres coup cote
 * serveur) — sa derniere reponse doit gagner.
 * @param {{
 *   hasAcceptedRequest?: boolean;
 *   hasPendingRequest?: boolean;
 *   isMissing?: boolean;
 *   isParticipating?: boolean;
 * }} [participationState] - La sortie de `getCurrentUserEventParticipationState`.
 * @returns {string | null} `absent`, `present`, `pending`, ou `null` si rien n'a
 *   ete repondu.
 */
export const resolveRsvpAnswer = (participationState) => {
  if (!participationState) return null;
  const {
    hasAcceptedRequest, hasPendingRequest, isMissing, isParticipating,
  } = participationState;

  if (isMissing) return RsvpAnswer.absent;
  if (isParticipating || hasAcceptedRequest) return RsvpAnswer.present;
  if (hasPendingRequest) return RsvpAnswer.pending;
  return null;
};

export {
  compareParticipationsByRecency,
  doesEntityBelongToUser,
  getUserEntityKey,
  isActiveParticipation,
  normalizeParticipationStatus,
};
