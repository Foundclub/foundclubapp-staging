import client from '@/services/client';

const PLATFORM_CLOSED_LINES = [
  'Found Club League arrive bientôt.',
  'Prépare ta squad, la compétition démarre bientôt.',
];

const MATCHMAKING_CLOSED_LINES = [
  'La recherche de match sera bientôt disponible.',
  'Prépare ta squad avant le lancement.',
];

export const LEAGUE_PLATFORM_RUNTIME_QUERY_KEY = ['league', 'platform-runtime'];

const unwrapResponse = (response) => response?.data?.data || response?.data || null;

const normalizeMessageLines = (lines, fallbackLines) => {
  if (Array.isArray(lines) && lines.length > 0) {
    return lines.map((line) => String(line || '').trim()).filter(Boolean);
  }
  return fallbackLines;
};

export const getLeaguePlatformRuntime = async () => {
  const response = await client.get('/league/runtime');
  return unwrapResponse(response);
};

export const getLeaguePlatformRestrictionCode = (error) => String(
  error?.details?.code
  || error?.code
  || '',
).trim();

export const getLeagueRuntimeFromError = (error) => (
  error?.details?.runtime
  || error?.runtime
  || null
);

export const isLeaguePlatformRestrictionCode = (code) => (
  code === 'LEAGUE_PLATFORM_CLOSED'
  || code === 'LEAGUE_MATCHMAKING_CLOSED'
);

export const isLeaguePlatformRestrictedError = (error) => (
  isLeaguePlatformRestrictionCode(getLeaguePlatformRestrictionCode(error))
);

export const getLeagueRestrictionScope = (error) => (
  getLeaguePlatformRestrictionCode(error) === 'LEAGUE_PLATFORM_CLOSED'
    ? 'platform'
    : 'matchmaking'
);

export const getLeagueClosedMessageLines = (runtime, scope = 'platform') => {
  const fallbackLines = scope === 'matchmaking'
    ? MATCHMAKING_CLOSED_LINES
    : PLATFORM_CLOSED_LINES;
  const target = scope === 'matchmaking' ? runtime?.matchmaking : runtime?.platform;
  const openingDate = String(target?.openingDate || target?.countdownTarget || '').trim();

  if (openingDate) {
    const firstLine = scope === 'matchmaking'
      ? 'La recherche de match sera bientôt disponible.'
      : 'Found Club League arrive bientôt.';
    const thirdLine = scope === 'matchmaking'
      ? 'Prépare ta squad avant le lancement.'
      : 'Prépare ta squad, la compétition démarre bientôt.';
    return normalizeMessageLines(target?.messageLines, [
      firstLine,
      `Ouverture prévue le ${openingDate}.`,
      thirdLine,
    ]);
  }

  return normalizeMessageLines(target?.messageLines, fallbackLines);
};

export const getLeagueClosedMessage = (runtime, scope = 'platform') => (
  getLeagueClosedMessageLines(runtime, scope).join('\n')
);
