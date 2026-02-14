const FALLBACK_COLORS = {
  primary: '#01B3F4',
  warning: '#F59E0B',
  success: '#22C55E',
  error: '#EF4444',
  neutral: '#6B7280',
  gold: '#D4AF37',
};

const withAlpha = (hex, alpha = '20') => {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  if (hex.length !== 7) return hex;
  return `${hex}${alpha}`;
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseHourMinute = (value) => {
  if (!value) return null;
  const [rawHour, rawMinute] = String(value).split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
};

const normalizePhase = (phase) => {
  if (!phase) return '';
  return String(phase).trim().toLowerCase();
};

export const normalizeMatchStatus = (status) => {
  if (!status) return '';
  const normalized = String(status).toLowerCase();
  return normalized === 'dispute' ? 'disputed' : normalized;
};

export const isVenueBookedForMatch = (match, event = null) => {
  if (!match && !event) return false;
  return event?.venueBooked === true
    || match?.venueBooked === true
    || match?.venue_booked === true;
};

export const getMatchStartDate = (match, event = null) => {
  return parseDate(event?.date || match?.date);
};

export const isMatchPastStart = (match, event = null, now = new Date()) => {
  const startDate = getMatchStartDate(match, event);
  if (!startDate) return false;
  return now >= startDate;
};

export const getMatchEndDate = (match, event = null) => {
  const explicitEnd = parseDate(event?.endDate || match?.location?.proposed_end_time);
  if (explicitEnd) return explicitEnd;

  const startDate = getMatchStartDate(match, event);
  if (!startDate) return null;

  const recurringEnd = parseHourMinute(match?.recurring_end_hour);
  if (recurringEnd) {
    const end = new Date(startDate);
    end.setHours(recurringEnd.hour, recurringEnd.minute, 0, 0);
    if (end.getTime() <= startDate.getTime()) {
      end.setDate(end.getDate() + 1);
    }
    return end;
  }

  return new Date(startDate.getTime() + (60 * 60 * 1000));
};

export const isMatchPastEnd = (match, event = null, now = new Date()) => {
  const endDate = getMatchEndDate(match, event);
  if (!endDate) return false;
  return now >= endDate;
};

export const getMatchDerivedPhase = (match, event = null, now = new Date()) => {
  if (!match) return 'unknown';

  const backendPhase = normalizePhase(match.phase);
  const status = normalizeMatchStatus(match.status);
  const venueBooked = isVenueBookedForMatch(match, event);
  const hasStarted = isMatchPastStart(match, event, now);

  if (backendPhase) {
    // Compatibility override: if backend still sends confirmed_upcoming while the
    // match start time is passed and venue is booked, force waiting_score locally.
    if (backendPhase === 'confirmed_upcoming' && status === 'scheduled' && venueBooked && hasStarted) {
      return 'waiting_score';
    }
    return backendPhase;
  }

  if (status === 'provisionary' || status === 'negotiating') return 'waiting_proposal';
  if (status === 'scheduled' && !venueBooked) return 'waiting_venue';
  if (status === 'scheduled' && venueBooked && !hasStarted) return 'confirmed_upcoming';
  if (status === 'scheduled' && venueBooked && hasStarted) return 'waiting_score';
  if (status === 'pending_validation') return 'pending_validation';
  if (status === 'disputed') return 'disputed';
  if (status === 'valid') return 'valid';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'forfeit') return 'forfeit';
  if (status === 'no_show') return 'no_show';

  return status || 'unknown';
};

export const shouldMaskOpponentIdentity = (match, event = null) => {
  const phase = getMatchDerivedPhase(match, event);
  // Keep anonymity during all pre-result phases to reduce targeted cancellations.
  return !['valid', 'cancelled', 'forfeit', 'no_show'].includes(phase);
};

export const canCaptainSubmitScore = ({ match, event = null, isCaptain = false, now = new Date() }) => {
  if (!isCaptain || !match) return false;
  const phase = getMatchDerivedPhase(match, event, now);
  return phase === 'waiting_score' || phase === 'pending_validation' || phase === 'disputed';
};

export const shouldShowNextMatchCard = (match, event = null) => {
  const phase = getMatchDerivedPhase(match, event);
  return [
    'waiting_venue',
    'confirmed_upcoming',
    'waiting_score',
    'pending_validation',
    'disputed',
  ].includes(phase);
};

export const getMatchStatusBadgeConfig = (match, colors = {}, event = null) => {
  const phase = getMatchDerivedPhase(match, event);
  const palette = {
    primary: colors.primary500 || FALLBACK_COLORS.primary,
    warning: colors.warning500 || FALLBACK_COLORS.warning,
    success: colors.success500 || FALLBACK_COLORS.success,
    error: colors.error500 || FALLBACK_COLORS.error,
    neutral: colors.neutral500 || FALLBACK_COLORS.neutral,
    gold: colors.gold500 || FALLBACK_COLORS.gold,
  };

  const map = {
    waiting_proposal: { label: 'En attente accord', color: palette.warning, bg: withAlpha(palette.warning) },
    waiting_venue: { label: 'En attente terrain', color: palette.warning, bg: withAlpha(palette.warning) },
    confirmed_upcoming: { label: 'A venir', color: palette.primary, bg: withAlpha(palette.primary) },
    waiting_score: { label: 'Score a saisir', color: palette.gold, bg: withAlpha(palette.gold) },
    pending_validation: { label: 'Validation score', color: palette.warning, bg: withAlpha(palette.warning) },
    disputed: { label: 'Litige', color: palette.error, bg: withAlpha(palette.error) },
    valid: { label: 'Valide', color: palette.success, bg: withAlpha(palette.success) },
    cancelled: { label: 'Annule', color: palette.error, bg: withAlpha(palette.error) },
    forfeit: { label: 'Forfait', color: palette.error, bg: withAlpha(palette.error) },
    no_show: { label: 'No-show', color: palette.error, bg: withAlpha(palette.error) },
  };

  if (map[phase]) return map[phase];
  return { label: normalizeMatchStatus(match?.status) || 'inconnu', color: palette.neutral, bg: withAlpha(palette.neutral) };
};
