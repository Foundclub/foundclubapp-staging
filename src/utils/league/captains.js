import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';

export const getLeagueCaptainMembers = (team) => {
  const seenIds = new Set();
  return [
    team?.captain,
    ...(Array.isArray(team?.co_captains) ? team.co_captains : []),
  ].filter(Boolean).filter((captain) => {
    const captainId = getEntityDocumentId(captain);
    if (!captainId || seenIds.has(captainId)) return false;
    seenIds.add(captainId);
    return true;
  });
};

export const isLeagueCaptain = (team, userOrId) => {
  const userId = typeof userOrId === 'string' || typeof userOrId === 'number'
    ? String(userOrId)
    : getEntityDocumentId(userOrId);
  if (!userId) return false;
  return getLeagueCaptainMembers(team).some((captain) => (
    areSameEntityId(getEntityDocumentId(captain), userId)
  ));
};

export const isLeagueMember = (team, userOrId) => {
  if (isLeagueCaptain(team, userOrId)) return true;
  const userId = typeof userOrId === 'string' || typeof userOrId === 'number'
    ? String(userOrId)
    : getEntityDocumentId(userOrId);
  if (!userId) return false;
  return Array.isArray(team?.roster) && team.roster.some((member) => (
    areSameEntityId(getEntityDocumentId(member), userId)
  ));
};
