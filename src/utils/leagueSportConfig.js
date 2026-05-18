const SPORT_KEYS = {
  football11: 'football11',
  football5: 'football5',
  padel: 'padel',
};

const stripDiacritics = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const normalizeLeagueSportKey = (sportValue) => {
  const normalized = stripDiacritics(
    typeof sportValue === 'string'
      ? sportValue
      : sportValue?.label || sportValue?.name || sportValue?.title || sportValue?.value || '',
  ).trim().toLowerCase();

  if (
    normalized.includes('football a 11')
    || normalized.includes('foot a 11')
    || normalized.includes('football11')
    || normalized.includes('foot11')
    || normalized.includes('11v11')
    || normalized.includes('11 vs 11')
  ) {
    return SPORT_KEYS.football11;
  }
  if (normalized.includes('padel')) return SPORT_KEYS.padel;
  return SPORT_KEYS.football5;
};

const LEAGUE_SPORT_CONFIG = {
  [SPORT_KEYS.football5]: {
    durationMinutes: 60,
    label: 'Football a 5',
    quorum: 5,
    venueRequired: true,
  },
  [SPORT_KEYS.football11]: {
    durationMinutes: 90,
    label: 'Football a 11',
    quorum: 11,
    venueRequired: false,
  },
  [SPORT_KEYS.padel]: {
    durationMinutes: 90,
    label: 'Padel',
    quorum: 2,
    venueRequired: true,
  },
};

export const getLeagueSportConfig = (sportValue) => {
  const key = normalizeLeagueSportKey(sportValue);
  return {
    key,
    ...LEAGUE_SPORT_CONFIG[key],
  };
};

// Keep legacy exports available while the league flow converges on one helper API.
export const getMatchLeagueSportConfig = getLeagueSportConfig;

export const getRequiredPlayersForSport = (sportValue) => getLeagueSportConfig(sportValue).quorum;
export const getMatchDurationMinutes = (sportValue) => getLeagueSportConfig(sportValue).durationMinutes;
export const doesSportRequireVenue = (sportValue) => getLeagueSportConfig(sportValue).venueRequired !== false;
export const doesMatchRequireVenue = (match) => doesSportRequireVenue(
  match?.team_a?.sport || match?.team_b?.sport || match?.sport,
);
export const isFootballElevenSport = (sportValue) => normalizeLeagueSportKey(sportValue) === SPORT_KEYS.football11;

export const getLocationModeLabel = (locationMode) => {
  const normalized = String(locationMode || '').trim().toLowerCase();
  if (normalized === 'travel') return 'Se deplace';
  if (normalized === 'host') return 'Recoit';
  if (normalized === 'both') return 'Les deux';
  return '';
};

export const getLocationModeBadgeTone = (locationMode) => {
  const normalized = String(locationMode || '').trim().toLowerCase();
  if (normalized === 'travel') return 'primary';
  if (normalized === 'host') return 'gold';
  if (normalized === 'both') return 'success';
  return 'neutral';
};

export const LEAGUE_SPORT_OPTIONS = [
  { label: 'Football a 5', value: SPORT_KEYS.football5 },
  { label: 'Football a 11', value: SPORT_KEYS.football11 },
  { label: 'Padel', value: SPORT_KEYS.padel },
];

export const LEAGUE_SPORT_KEYS = Object.freeze({
  FOOTBALL5: SPORT_KEYS.football5,
  FOOTBALL11: SPORT_KEYS.football11,
  PADEL: SPORT_KEYS.padel,
});

export { SPORT_KEYS, normalizeLeagueSportKey };
