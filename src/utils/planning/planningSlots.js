import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';

import {
  getShortAddress,
  normalizeLocationInput,
} from '@/utils/location';
import {
  getParisNowAsDeviceDate,
  toDeviceDateFromParisInstant,
} from '@/utils/parisTime';

const normalizeText = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const formatClock = (value) => String(value || '').split(':').slice(0, 2).join(':');
const formatDateClock = (value) => {
  if (!value) return '';

  const resolvedDate = toDeviceDateFromParisInstant(value);
  if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) {
    return '';
  }

  const hours = String(resolvedDate.getHours()).padStart(2, '0');
  const minutes = String(resolvedDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const resolvePlanningStartTime = (item) => (
  formatClock(item?.startTime) || formatDateClock(item?.startAt || item?.date)
);

const resolvePlanningEndTime = (item) => (
  formatClock(item?.endTime) || formatDateClock(item?.endAt || item?.endDate)
);

const buildTimeLabel = (item) => {
  const start = resolvePlanningStartTime(item);
  const end = resolvePlanningEndTime(item);

  if (start && end && start !== end) {
    return `${start} - ${end}`;
  }

  return start || end || '';
};

export const getPlanningTimeLabel = (item) => buildTimeLabel(item);

const buildWindowFromTimes = (startAt, endTime) => {
  if (!startAt || !endTime) return null;

  const [hours, minutes] = String(endTime || '')
    .split(':')
    .slice(0, 2)
    .map((value) => Number.parseInt(value, 10));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const resolvedEnd = new Date(startAt);
  resolvedEnd.setHours(hours, minutes, 0, 0);
  if (resolvedEnd.getTime() <= startAt.getTime()) {
    resolvedEnd.setDate(resolvedEnd.getDate() + 1);
  }
  return resolvedEnd;
};

const normalizeMatchContext = (matchContext) => {
  if (!matchContext || typeof matchContext !== 'object') return null;

  const homeAway = matchContext.homeAway === 'home' || matchContext.homeAway === 'away'
    ? matchContext.homeAway
    : null;

  return {
    homeAway,
    isMatch: Boolean(matchContext.isMatch),
    myTeamName: typeof matchContext.myTeamName === 'string' ? matchContext.myTeamName : null,
    opponentName: typeof matchContext.opponentName === 'string' ? matchContext.opponentName : null,
  };
};

export const toPlanningApiDate = (value) => format(value, 'yyyy-MM-dd');
export const getPlanningDefaultDate = () => getParisNowAsDeviceDate();

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
    externalTeamName: team.externalTeamName || null,
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
  const matchContext = normalizeMatchContext(item.matchContext);
  const startTime = resolvePlanningStartTime(item) || null;
  const endTime = resolvePlanningEndTime(item) || null;

  return {
    club: item.club
      ? {
        documentId: item.club.documentId || item.club.id || null,
        name: item.club.name || null,
      }
      : null,
    date: item.startAt || item.date || null,
    documentId: item.documentId || item.eventId || item.id || null,
    endAt: item.endAt || item.endDate || null,
    endTime,
    facility,
    hasExplicitTime: Boolean(item.hasExplicitTime || startTime),
    id: item.documentId || item.eventId || item.id || null,
    isSharedFacility: Boolean(item.isSharedFacility),
    kind: inferPlanningKind(item, typeLabel),
    league_match: Boolean(item.leagueMatch || item.league_match),
    leagueMatch: Boolean(item.leagueMatch || item.league_match),
    location: item.location || null,
    locationDetails: item.locationDetails || null,
    matchContext,
    name: item.name || item.eventName || null,
    participationStatus: typeof item.participationStatus === 'string'
      ? item.participationStatus.trim().toLowerCase()
      : null,
    raw: item,
    startAt: item.startAt || item.date || null,
    startTime,
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

export const getPlanningParticipationStatus = (item) => {
  let rawStatus = '';

  if (typeof item?.participationStatus === 'string') {
    rawStatus = item.participationStatus;
  } else if (typeof item?.raw?.participationStatus === 'string') {
    rawStatus = item.raw.participationStatus;
  }

  const normalizedStatus = String(rawStatus || '').trim().toLowerCase();
  return normalizedStatus || null;
};

export const isPlanningPendingParticipation = (item) => (
  getPlanningParticipationStatus(item) === 'pending'
);

export const getPlanningItemDate = (item) => {
  const rawDate = item?.startAt || item?.date || null;
  if (!rawDate) return null;

  const date = toDeviceDateFromParisInstant(rawDate);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export const getPlanningItemWindow = (item) => {
  const startAt = getPlanningItemDate(item);
  if (!startAt) return null;

  let endAt = item?.endAt ? toDeviceDateFromParisInstant(item.endAt) : null;
  if (!endAt || Number.isNaN(endAt.getTime()) || endAt.getTime() <= startAt.getTime()) {
    endAt = buildWindowFromTimes(startAt, item?.endTime);
  }

  if (!endAt || Number.isNaN(endAt.getTime())) {
    endAt = new Date(startAt.getTime() + (90 * 60 * 1000));
  }

  return {
    endAt,
    startAt,
  };
};

export const getPlanningPeakOccupancy = (items = []) => {
  const markers = [];

  items.forEach((item) => {
    const window = getPlanningItemWindow(item);
    if (!window?.startAt || !window?.endAt) return;

    markers.push({ delta: 1, time: window.startAt.getTime() });
    markers.push({ delta: -1, time: window.endAt.getTime() });
  });

  markers.sort((left, right) => {
    if (left.time !== right.time) return left.time - right.time;
    return left.delta - right.delta;
  });

  let current = 0;
  let maxConcurrent = 0;

  markers.forEach((marker) => {
    current += marker.delta;
    maxConcurrent = Math.max(maxConcurrent, current);
  });

  return {
    itemCount: Math.floor(markers.length / 2),
    maxConcurrent,
  };
};

export const getPlanningItemSecondaryLabel = (item) => {
  const teamName = item?.team?.name || null;
  const facilityName = item?.facility?.name || null;
  const title = getPlanningDisplayTitle(item);

  if (teamName && teamName !== title) return teamName;
  if (facilityName && facilityName !== title) return facilityName;
  return null;
};

export const getPlanningLocationLabel = (item) => {
  const facilityName = String(item?.facility?.name || '').trim();
  if (facilityName) return facilityName;

  const shortAddress = getShortAddress(item?.locationDetails);
  if (shortAddress) return shortAddress;

  const normalizedLocation = normalizeLocationInput(item?.location || item?.raw?.location);
  if (normalizedLocation?.label) return normalizedLocation.label;
  if (normalizedLocation?.address) return normalizedLocation.address;
  if (normalizedLocation?.city) return normalizedLocation.city;
  return '';
};

export const resolvePlanningCardContent = (item, { profile = 'default' } = {}) => {
  const title = getPlanningDisplayTitle(item);
  const typeLabel = getPlanningTypeLabel(item);
  const teamName = String(item?.team?.name || '').trim();
  const locationLabel = getPlanningLocationLabel(item);
  const matchContext = normalizeMatchContext(item?.matchContext || item?.raw?.matchContext);
  const planningDate = getPlanningItemDate(item);
  const dateLabel = planningDate ? format(planningDate, 'EEE d MMM', { locale: fr }) : '';
  const timeLabel = buildTimeLabel(item);
  const secondaryDateTimeLabel = [dateLabel, timeLabel].filter(Boolean).join(' • ');
  const compactDateTimeLabel = timeLabel || dateLabel || '';

  const defaultPrimaryLabel = typeLabel || title || 'Evenement';
  const defaultContextLabel = (() => {
    const secondaryLabel = getPlanningItemSecondaryLabel(item);

    if (secondaryLabel && secondaryLabel !== defaultPrimaryLabel) {
      return secondaryLabel;
    }

    if (title && title !== defaultPrimaryLabel) {
      return title;
    }

    return null;
  })();
  const defaultMetaLabel = [title]
    .filter(
      (value) => value
        && value !== defaultPrimaryLabel
        && value !== defaultContextLabel
        && value !== locationLabel,
    )
    .join(' - ');

  const focusedTeamName = String(matchContext?.myTeamName || teamName || '').trim();
  if (profile === 'teamFocused' && focusedTeamName) {
    const isMatchCard = Boolean(matchContext?.isMatch || item?.leagueMatch || item?.league_match);
    const primaryLabel = isMatchCard
      ? String(matchContext?.opponentName || focusedTeamName || title || 'Match').trim()
      : focusedTeamName;
    const quaternaryMetaLabel = [
      typeLabel && typeLabel !== primaryLabel ? typeLabel : null,
      focusedTeamName && isMatchCard && focusedTeamName !== primaryLabel ? focusedTeamName : null,
      !isMatchCard && title && title !== primaryLabel ? title : null,
    ].filter(Boolean).join(' · ');

    return {
      compactDateTimeLabel,
      contextLabel: null,
      isMatchCard,
      isTeamFocusedCard: true,
      primaryLabel,
      quaternaryMetaLabel,
      secondaryDateTimeLabel,
      tertiaryLocationLabel: locationLabel,
      typeLabel,
    };
  }

  return {
    compactDateTimeLabel,
    contextLabel: defaultContextLabel,
    isMatchCard: Boolean(matchContext?.isMatch || item?.leagueMatch || item?.league_match),
    isTeamFocusedCard: false,
    primaryLabel: defaultPrimaryLabel,
    quaternaryMetaLabel: defaultMetaLabel,
    secondaryDateTimeLabel,
    tertiaryLocationLabel: locationLabel,
    typeLabel,
  };
};
