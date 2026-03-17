import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

const normalizeText = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export const toPlanningApiDate = (value) => format(value, 'yyyy-MM-dd');

export const getPlanningRange = (currentDate, viewMode = 'week') => {
  if (viewMode === 'month') {
    return {
      from: toPlanningApiDate(startOfMonth(currentDate)),
      to: toPlanningApiDate(endOfMonth(currentDate)),
    };
  }

  if (viewMode === '3days') {
    return {
      from: toPlanningApiDate(currentDate),
      to: toPlanningApiDate(addDays(currentDate, 2)),
    };
  }

  return {
    from: toPlanningApiDate(startOfWeek(currentDate, { weekStartsOn: 1 })),
    to: toPlanningApiDate(endOfWeek(currentDate, { weekStartsOn: 1 })),
  };
};

const inferPlanningKind = (item, typeLabel) => {
  if (item?.kind) return item.kind;
  if (item?.leagueMatch || item?.league_match) return 'match';

  const normalized = normalizeText(typeLabel);
  if (normalized.includes('reservation')) return 'reservation';
  if (normalized.includes('match')) return 'match';
  return 'event';
};

const normalizeFacility = (facility) => {
  if (!facility) return null;

  return {
    color: facility.color || facility.planningColor || null,
    documentId: facility.documentId || facility.id || null,
    name: facility.name || null,
    planningColor: facility.planningColor || facility.color || null,
  };
};

const normalizeTeam = (team) => {
  if (!team) return null;

  return {
    documentId: team.documentId || team.id || null,
    name: team.name || null,
  };
};

export const getPlanningDisplayTitle = (item) => (
  item?.title
  || item?.name
  || item?.eventName
  || item?.team?.name
  || item?.club?.name
  || item?.facility?.name
  || 'Événement'
);

export const getPlanningTypeLabel = (item) => {
  if (typeof item?.typeLabel === 'string' && item.typeLabel.trim()) {
    return item.typeLabel.trim();
  }

  if (typeof item?.type === 'string' && item.type.trim()) {
    return item.type.trim();
  }

  if (typeof item?.type?.name === 'string' && item.type.name.trim()) {
    return item.type.name.trim();
  }

  return null;
};

export const normalizePlanningItem = (item) => {
  if (!item || typeof item !== 'object') return null;

  const title = getPlanningDisplayTitle(item);
  const typeLabel = getPlanningTypeLabel(item);
  const team = normalizeTeam(item.team);
  const facility = normalizeFacility(item.facility || item.installation);

  return {
    club: item.club
      ? {
        documentId: item.club.documentId || item.club.id || null,
        name: item.club.name || null,
      }
      : null,
    date: item.startAt || item.date || null,
    documentId: item.documentId || item.eventId || item.id || null,
    endAt: item.endAt || item.endDate || item.startAt || item.date || null,
    endTime: item.endTime || null,
    facility,
    hasExplicitTime: item.hasExplicitTime ?? Boolean(item.startTime && item.endTime),
    id: item.documentId || item.eventId || item.id || null,
    isSharedFacility: Boolean(item.isSharedFacility),
    kind: inferPlanningKind(item, typeLabel),
    league_match: Boolean(item.leagueMatch || item.league_match),
    leagueMatch: Boolean(item.leagueMatch || item.league_match),
    locationDetails: item.locationDetails || null,
    name: item.name || item.eventName || null,
    raw: item,
    startAt: item.startAt || item.date || null,
    startTime: item.startTime || null,
    team,
    title,
    type: typeLabel ? { name: typeLabel } : null,
    typeLabel,
  };
};

export const normalizePlanningItems = (items) => (
  Array.isArray(items)
    ? items.map((item) => normalizePlanningItem(item)).filter(Boolean)
    : []
);

export const getPlanningItemDate = (item) => {
  const rawDate = item?.startAt || item?.date || null;
  if (!rawDate) return null;

  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getPlanningItemSecondaryLabel = (item) => {
  const teamName = item?.team?.name || null;
  const facilityName = item?.facility?.name || null;
  const title = getPlanningDisplayTitle(item);

  if (teamName && teamName !== title) return teamName;
  if (facilityName && facilityName !== title) return facilityName;
  return null;
};
