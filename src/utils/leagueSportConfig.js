export const LEAGUE_SPORT_KEYS = {
  FOOT_5: 'foot_5',
  PADEL: 'padel',
};

export const normalizeLeagueSportText = (value) => {
  if (!value) return '';
  const raw = typeof value === 'string'
    ? value
    : value?.label || value?.name || value?.title || value?.value || '';
  return String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

export const resolveLeagueSportKey = (sportValue) => {
  const normalized = normalizeLeagueSportText(sportValue);
  if (normalized.includes('padel')) return LEAGUE_SPORT_KEYS.PADEL;
  return LEAGUE_SPORT_KEYS.FOOT_5;
};

export const getLeagueSportConfig = (sportValue) => {
  const key = resolveLeagueSportKey(sportValue);
  if (key === LEAGUE_SPORT_KEYS.PADEL) {
    return {
      allowsDraw: false,
      durationMinutes: 90,
      key,
      label: 'Padel',
      quorum: 2,
      scoreFormat: 'sets',
    };
  }
  return {
    allowsDraw: true,
    durationMinutes: 60,
    key,
    label: 'Football à 5',
    quorum: 5,
    scoreFormat: 'goals',
  };
};

export const getMatchLeagueSportConfig = (match) => getLeagueSportConfig(
  match?.team_a?.sport || match?.team_b?.sport || match?.sport,
);
