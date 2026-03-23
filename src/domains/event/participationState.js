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

export {
  compareParticipationsByRecency,
  doesEntityBelongToUser,
  getUserEntityKey,
  isActiveParticipation,
  normalizeParticipationStatus,
};
