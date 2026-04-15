import { sanitizeRecruitmentTabForRole, VALID_RECRUITMENT_TABS } from '@/domains/search/recruitmentFlow';

import { RouteNames } from '@/navigation/routeNames';

const CANONICAL_SEARCH_TYPES = new Set(['clubs', 'events', 'recruitment', 'reservations']);

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
 * @returns {'events' | 'clubs' | 'reservations' | 'recruitment'}
 */
export function normalizeSearchType(searchType) {
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
    return 'recruitment';
  }
  return 'events';
}

/**
 * @param {unknown} searchType
 * @returns {'events' | 'clubs' | 'reservations' | 'recruitment'}
 */
export function coerceSearchHubType(searchType) {
  if (typeof searchType === 'string' && CANONICAL_SEARCH_TYPES.has(searchType)) {
    return /** @type {'events' | 'clubs' | 'reservations' | 'recruitment'} */ (searchType);
  }

  return normalizeSearchType(searchType);
}

/**
 * @param {string | undefined} routeName
 * @returns {'events' | 'clubs' | 'reservations' | 'recruitment'}
 */
export function getSearchTypeFromRouteName(routeName) {
  if (routeName === RouteNames.SearchClubs) return 'clubs';
  if (routeName === RouteNames.SearchReservations) return 'reservations';
  if (routeName === RouteNames.SearchRecruitment) return 'recruitment';
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
 * @param {unknown} [userOrRole]
 * @returns {{ routeName: string; params?: Record<string, unknown> } | null}
 */
export function resolveLegacySearchTarget(params, userOrRole) {
  if (!hasLegacySearchParams(params)) return null;

  const initialSearchType = params?.initialSearchType
    || (params?.initialTab === 'mercato' ? 'recrutement' : params?.initialTab);

  const normalizedType = normalizeSearchType(initialSearchType);

  if (normalizedType === 'recruitment') {
    const requestedRecruitmentTab = params?.initialRecruitmentTab
      || (params?.initialTab === 'mercato' ? 'profils' : undefined);
    const initialRecruitmentTab = sanitizeRecruitmentTabForRole(
      requestedRecruitmentTab,
      userOrRole,
    );

    return {
      params: {
        activeType: normalizedType,
        initialRecruitmentTab,
        timestamp: params?.timestamp,
      },
      routeName: RouteNames.SearchHub,
    };
  }

  return {
    params: {
      activeType: normalizedType,
    },
    routeName: RouteNames.SearchHub,
  };
}
