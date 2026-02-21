import { RouteNames } from '@/navigation/routeNames';

const SEARCH_TYPE_TO_ROUTE = /** @type {const} */ ({
  clubs: RouteNames.SearchClubs,
  events: RouteNames.SearchEvents,
  recrutement: RouteNames.SearchRecruitment,
  reservations: RouteNames.SearchReservations,
});

export const VALID_RECRUITMENT_TABS = /** @type {const} */ ([
  'annonces',
  'candidatures',
  'profils',
]);

/**
 * @param {unknown} tab
 * @param {'annonces' | 'candidatures' | 'profils'} [fallback]
 * @returns {'annonces' | 'candidatures' | 'profils'}
 */
export function normalizeRecruitmentTab(tab, fallback = 'annonces') {
  if (typeof tab !== 'string') return fallback;
  const normalized = tab.toLowerCase();
  return VALID_RECRUITMENT_TABS.includes(
    /** @type {'annonces' | 'candidatures' | 'profils'} */ (normalized),
  )
    ? /** @type {'annonces' | 'candidatures' | 'profils'} */ (normalized)
    : fallback;
}

/**
 * @param {unknown} searchType
 * @returns {'events' | 'clubs' | 'reservations' | 'recrutement'}
 */
function normalizeSearchType(searchType) {
  if (typeof searchType !== 'string') return 'events';
  const normalized = searchType.toLowerCase();
  if (normalized === 'event' || normalized === 'events') return 'events';
  if (normalized === 'club' || normalized === 'clubs') return 'clubs';
  if (normalized === 'reservation' || normalized === 'reservations') return 'reservations';
  if (
    normalized === 'mercato'
    || normalized === 'recrutement'
    || normalized === 'recruitment'
  ) {
    return 'recrutement';
  }
  return 'events';
}

/**
 * @param {Record<string, unknown> | undefined} params
 * @returns {boolean}
 */
export function hasLegacySearchParams(params) {
  if (!params) return false;
  return Boolean(
    params.initialSearchType
      || params.initialRecruitmentTab
      || params.initialTab
      || params.timestamp,
  );
}

/**
 * @param {Record<string, unknown> | undefined} params
 * @returns {{ routeName: string; params?: Record<string, unknown> } | null}
 */
export function resolveLegacySearchTarget(params) {
  if (!hasLegacySearchParams(params)) return null;

  const initialSearchType = params?.initialSearchType
    || (params?.initialTab === 'mercato' ? 'recrutement' : params?.initialTab);

  const normalizedType = normalizeSearchType(initialSearchType);
  const routeName = SEARCH_TYPE_TO_ROUTE[normalizedType];

  if (routeName === RouteNames.SearchRecruitment) {
    const initialRecruitmentTab = normalizeRecruitmentTab(
      params?.initialRecruitmentTab
        || (params?.initialTab === 'mercato' ? 'profils' : 'annonces'),
    );

    return {
      params: {
        initialRecruitmentTab,
        timestamp: params?.timestamp,
      },
      routeName,
    };
  }

  return { routeName };
}
