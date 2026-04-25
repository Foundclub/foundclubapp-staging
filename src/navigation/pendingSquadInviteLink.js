import { storage } from '@/store/appContext';

const STORAGE_KEY = 'pendingLeagueSquadInviteLink';
const MAX_PENDING_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const parsePendingInvite = (rawValue) => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    const teamId = String(parsed?.teamId || '').trim();
    const createdAt = Number(parsed?.createdAt || 0);
    if (!teamId || !Number.isFinite(createdAt)) return null;
    if (Date.now() - createdAt > MAX_PENDING_AGE_MS) return null;

    return {
      createdAt,
      teamId,
    };
  } catch (_error) {
    return null;
  }
};

export const savePendingSquadInviteLink = (teamId) => {
  const normalizedTeamId = String(teamId || '').trim();
  if (!normalizedTeamId) return;

  storage.set(STORAGE_KEY, JSON.stringify({
    createdAt: Date.now(),
    teamId: normalizedTeamId,
  }));
};

export const readPendingSquadInviteLink = () => {
  const pendingInvite = parsePendingInvite(storage.getString(STORAGE_KEY));
  if (!pendingInvite) {
    storage.delete(STORAGE_KEY);
  }
  return pendingInvite;
};

export const clearPendingSquadInviteLink = () => {
  storage.delete(STORAGE_KEY);
};
