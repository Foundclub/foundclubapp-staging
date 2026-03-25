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

const buildTimeLabel = (item) => {
  const start = formatClock(item?.startTime);
  const end = formatClock(item?.endTime);

  if (start && end && start !== end) {
    return `${start} - ${end}`;
  }

  return start || end || '';
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
    location: item.location || null,
    locationDetails: item.locationDetails || null,
    matchContext,
    name: item.name || item.eventName || null,
    participationStatus: typeof item.participationStatus === 'string'
      ? item.participationStatus.trim().toLowerCase()
      : null,
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
