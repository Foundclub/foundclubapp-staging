import i18next from 'i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import client from '@/services/client';

const platformClosedLines = () => [
  i18next.t('leaguePlatformService.platformClosed.title', 'Found Club League arrive bientôt.'),
  i18next.t(
    'leaguePlatformService.platformClosed.hint',
    'Prépare ta squad, la compétition démarre bientôt.',
  ),
];

const matchmakingClosedLines = () => [
  i18next.t(
    'leaguePlatformService.matchmakingClosed.title',
    'La recherche de match sera bientôt disponible.',
  ),
  i18next.t('leaguePlatformService.matchmakingClosed.hint', 'Prépare ta squad avant le lancement.'),
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
    ? matchmakingClosedLines()
    : platformClosedLines();
  const target = scope === 'matchmaking' ? runtime?.matchmaking : runtime?.platform;
  const openingDate = String(target?.openingDate || target?.countdownTarget || '').trim();

  if (openingDate) {
    const firstLine = scope === 'matchmaking'
      ? i18next.t(
        'leaguePlatformService.matchmakingClosed.title',
        'La recherche de match sera bientôt disponible.',
      )
      : i18next.t(
        'leaguePlatformService.platformClosed.title',
        'Found Club League arrive bientôt.',
      );
    const thirdLine = scope === 'matchmaking'
      ? i18next.t(
        'leaguePlatformService.matchmakingClosed.hint',
        'Prépare ta squad avant le lancement.',
      )
      : i18next.t(
        'leaguePlatformService.platformClosed.hint',
        'Prépare ta squad, la compétition démarre bientôt.',
      );
    return normalizeMessageLines(target?.messageLines, [
      firstLine,
      i18next.t(
        'leaguePlatformService.openingDate',
        'Ouverture prévue le {{openingDate}}.',
        { openingDate, ...SANS_ECHAPPEMENT },
      ),
      thirdLine,
    ]);
  }

  return normalizeMessageLines(target?.messageLines, fallbackLines);
};

export const getLeagueClosedMessage = (runtime, scope = 'platform') => (
  getLeagueClosedMessageLines(runtime, scope).join('\n')
);
