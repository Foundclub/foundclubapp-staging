import { resolveEventOpponentName } from '@/domains/event/eventDisplayName';

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const stripDiacritics = (value) => normalizeText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const normalizeTeamName = (value) => stripDiacritics(value)
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const isSameExternalTeamName = (left, right) => {
  const normalizedLeft = normalizeTeamName(left);
  const normalizedRight = normalizeTeamName(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const extractMatchContextLabel = (...sources) => {
  const normalizedSources = sources
    .map((source) => stripDiacritics(source).toLowerCase())
    .filter(Boolean);

  if (normalizedSources.some((source) => source.includes('domicile'))) {
    return 'Domicile';
  }
  if (normalizedSources.some((source) => source.includes('exterieur'))) {
    return 'Exterieur';
  }
  return '';
};

const extractVenueLabel = (match) => {
  const venueName = normalizeText(match?.venueName);
  const venueLabel = normalizeText(match?.venueLabel);
  const venueAddress = normalizeText(match?.venueAddress);
  const venueCity = normalizeText(match?.venueCity);

  if (venueLabel && venueLabel !== '[object Object]') {
    return venueLabel;
  }
  if (venueName && venueCity) {
    return `${venueName} - ${venueCity}`;
  }
  if (venueName) {
    return venueName;
  }
  if (venueAddress && venueCity) {
    return `${venueAddress} - ${venueCity}`;
  }
  return venueAddress || venueCity || '';
};

const extractMatchTitle = (...sources) => {
  const normalizedSources = sources
    .map((source) => normalizeText(source))
    .filter(Boolean);

  const match = normalizedSources.reduce((found, source) => {
    if (found) return found;

    const directVsMatch = source.match(/\bvs\b\.?\s+(.+)$/i);
    if (directVsMatch?.[1]) {
      return `VS ${directVsMatch[1].trim()}`;
    }

    if (/^vs\b/i.test(source)) {
      return source.replace(/^vs\b/i, 'VS').trim();
    }

    return '';
  }, '');

  return match;
};

const resolveMatchInvolvement = (match, team) => {
  const selectedTeamId = normalizeText(team?.externalTeamId);
  const selectedTeamName = normalizeText(team?.externalTeamName || team?.name);
  const homeTeamId = normalizeText(match?.homeTeamId);
  const awayTeamId = normalizeText(match?.awayTeamId);
  const homeTeam = normalizeText(match?.homeTeam);
  const awayTeam = normalizeText(match?.awayTeam);

  if (selectedTeamId) {
    if (homeTeamId && homeTeamId === selectedTeamId) {
      return { contextLabel: 'Domicile', opponent: awayTeam || 'Adversaire' };
    }
    if (awayTeamId && awayTeamId === selectedTeamId) {
      return { contextLabel: 'Exterieur', opponent: homeTeam || 'Adversaire' };
    }
  }

  if (!selectedTeamName) return null;

  if (isSameExternalTeamName(homeTeam, selectedTeamName)) {
    return { contextLabel: 'Domicile', opponent: awayTeam || 'Adversaire' };
  }
  if (isSameExternalTeamName(awayTeam, selectedTeamName)) {
    return { contextLabel: 'Exterieur', opponent: homeTeam || 'Adversaire' };
  }

  return null;
};

const findBestCalendarMatch = (eventLike) => {
  const calendarMatches = Array.isArray(eventLike?.team?.externalCalendarData)
    ? eventLike.team.externalCalendarData
    : [];

  if (!calendarMatches.length || !eventLike?.date) {
    return null;
  }

  return calendarMatches
    .map((match) => {
      const involvement = resolveMatchInvolvement(match, eventLike?.team);
      if (!involvement) return null;
      const distance = getMatchDistance(eventLike, match);
      if (!Number.isFinite(distance)) return null;
      return { distance, involvement, match };
    })
    .filter(Boolean)
    .sort((left, right) => left.distance - right.distance)[0] || null;
};

const getMatchDistance = (eventLike, match) => {
  const eventDate = eventLike?.date ? new Date(eventLike.date) : null;
  const matchDate = match?.date ? new Date(match.date) : null;
  if (!eventDate || Number.isNaN(eventDate.getTime()) || !matchDate || Number.isNaN(matchDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const diff = Math.abs(eventDate.getTime() - matchDate.getTime());
  if (diff <= 10 * 60 * 1000) return diff;

  const sameUtcDay = eventDate.getUTCFullYear() === matchDate.getUTCFullYear()
    && eventDate.getUTCMonth() === matchDate.getUTCMonth()
    && eventDate.getUTCDate() === matchDate.getUTCDate();

  return sameUtcDay ? diff + (12 * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;
};

/**
 * Resolve a human-friendly match label from imported external competition data.
 * Works for already-synced events and for older imported events that still need
 * a fallback against the team's external calendar snapshot.
 *
 * @param {any} eventLike
 * @returns {{ title: string, contextLabel: string }}
 */
export const resolveExternalMatchDisplay = (eventLike) => {
  const titleFromFields = extractMatchTitle(eventLike?.name, eventLike?.description);
  const contextFromFields = extractMatchContextLabel(eventLike?.name, eventLike?.description);

  // Y02 — L'ADVERSAIRE EST DEVENU UNE DONNEE, il passe donc devant tout le reste.
  // Avant ce lot, l'adversaire ne pouvait etre que RECONSTRUIT : on relisait la
  // chaine « VS X » dans `name`/`description`, ou on rapprochait l'evenement du
  // calendrier de l'equipe a moins de 10 minutes pres. Ces deux chemins restent
  // dessous pour l'ancien parc ; ils ne sont simplement plus le premier recours.
  const opponentFromData = resolveEventOpponentName(eventLike);
  if (opponentFromData) {
    return {
      contextLabel: contextFromFields,
      title: `VS ${opponentFromData}`,
    };
  }

  if (titleFromFields) {
    return {
      contextLabel: contextFromFields,
      title: titleFromFields,
    };
  }

  const bestMatch = findBestCalendarMatch(eventLike);
  if (!bestMatch?.involvement?.opponent) {
    return {
      contextLabel: contextFromFields,
      title: '',
    };
  }

  return {
    contextLabel: bestMatch.involvement.contextLabel || contextFromFields,
    title: `VS ${bestMatch.involvement.opponent}`,
  };
};

/**
 * @param {any} eventLike
 * @returns {string}
 */
export const resolveExternalMatchLocation = (eventLike) => {
  const bestMatch = findBestCalendarMatch(eventLike);
  return extractVenueLabel(bestMatch?.match);
};
