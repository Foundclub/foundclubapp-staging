import { sanitizeRecruitmentTabForRole, VALID_RECRUITMENT_TABS } from '@/domains/search/recruitmentFlow';

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';

const CANONICAL_SEARCH_TYPES = new Set([
  'amicaux',
  'clubs',
  'events',
  'recruitment',
  'reservations',
]);

/**
 * @typedef {'events' | 'clubs' | 'reservations' | 'recruitment' | 'amicaux'} SearchHubType
 */

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
 * @returns {SearchHubType}
 */
export function normalizeSearchType(searchType) {
  if (typeof searchType !== 'string') return 'events';
  const normalized = searchType.toLowerCase();
  if (normalized === 'event' || normalized === 'events') return 'events';
  if (normalized === 'club' || normalized === 'clubs') return 'clubs';
  if (normalized === 'reservation' || normalized === 'reservations') return 'reservations';
  if (
    normalized === 'amicaux'
    || normalized === 'amical'
    || normalized === 'friendly'
    || normalized === 'friendly-matches'
  ) {
    return 'amicaux';
  }
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
 * @returns {SearchHubType}
 */
export function coerceSearchHubType(searchType) {
  if (typeof searchType === 'string' && CANONICAL_SEARCH_TYPES.has(searchType)) {
    return /** @type {'events' | 'clubs' | 'reservations' | 'recruitment'} */ (searchType);
  }

  return normalizeSearchType(searchType);
}

/**
 * @param {string | undefined} routeName
 * @returns {SearchHubType}
 */
export function getSearchTypeFromRouteName(routeName) {
  if (routeName === RouteNames.SearchClubs) return 'clubs';
  if (routeName === RouteNames.SearchReservations) return 'reservations';
  if (routeName === RouteNames.SearchRecruitment) return 'recruitment';
  return 'events';
}

/**
 * Ouvre l'onglet Rechercher sur un type donne, DEPUIS N'IMPORTE OU.
 *
 * R06 — pourquoi cet utilitaire existe. Deux appelants ecrivaient
 * `navigate(RouteNames.Search, { screen: RouteNames.SearchClubs })`, c'est-a-dire
 * DEUX niveaux. Or `Search` n'est pas une route du navigateur racine : c'est un
 * onglet, monte un cran plus bas, DANS `HomeTab`. Un ecran pousse sur le
 * navigateur racine (l'assistant d'equipe, par exemple, qui n'affiche donc pas
 * la barre d'onglets) ne trouve aucune route `Search` a son niveau : l'appel
 * echoue en silence et le bouton parait inerte. Constate sur la build
 * 2.6.1 (821) le 2026-08-01.
 *
 * La forme correcte est celle qu'utilise deja SearchRouteRedirect.js : TROIS
 * niveaux, `HomeTab` -> `Search` -> `SearchHub`. Elle fonctionne aussi bien
 * depuis un ecran d'onglet que depuis le navigateur racine, ce qui evite d'avoir
 * a savoir ou l'on se trouve.
 *
 * On vise `SearchHub` avec `activeType` plutot que la route `SearchClubs` :
 * dans SearchStack, `SearchClubs` n'est qu'un alias (`SearchHubRouteAlias`).
 *
 * RETOUR-ONGLET-2 (30/09) — les trois niveaux ne suffisaient pas. Depuis un ecran de
 * la RACINE (l'assistant d'equipe, la page de succes d'abonnement), React Navigation 7
 * EMPILAIT un second HomeTab au lieu de revenir au premier : `navigate` ne cherche la
 * route deja empilee que si `pop` est pose. La forme imbriquee passe donc par
 * `allerDansLOnglet`, qui pose `pop` aux deux niveaux qui empilent.
 * Preuve : navigation/__tests__/retourOnglet2.pileRacine.test.js (F2).
 * @param {any} navigation
 * @param {unknown} [searchType] type d'onglet vise ; defaut 'events'
 * @param {Record<string, unknown>} [extraParams] parametres additionnels
 * @returns {void}
 */
export function navigateToSearchHub(navigation, searchType, extraParams) {
  allerDansLOnglet(navigation, RouteNames.SearchHub, {
    ...(extraParams || {}),
    activeType: coerceSearchHubType(searchType),
  });
}

/**
 * @param {SearchHubType | unknown} searchType
 * @returns {`search.tab.${SearchHubType}`}
 */
export function getSearchHubGuidanceSignalKey(searchType) {
  const normalizedType = coerceSearchHubType(searchType);
  return `search.tab.${normalizedType}`;
}

/**
 * Returns a guidance signal key only the first time a tab is exposed for the current
 * SearchHub screen instance.
 * @param {SearchHubType | unknown} searchType
 * @param {Set<SearchHubType>} exposedTypes
 * @returns {`search.tab.${SearchHubType}` | null}
 */
export function consumeSearchHubGuidanceSignal(searchType, exposedTypes) {
  const normalizedType = coerceSearchHubType(searchType);
  if (!(exposedTypes instanceof Set)) {
    return getSearchHubGuidanceSignalKey(normalizedType);
  }

  if (exposedTypes.has(normalizedType)) {
    return null;
  }

  exposedTypes.add(normalizedType);
  return getSearchHubGuidanceSignalKey(normalizedType);
}

/**
 * @param {Record<string, unknown> | undefined} params
 * @returns {boolean}
 */
export function hasLegacySearchParams(params) {
  if (!params) return false;
  return Boolean(
    params.activeType
      || params.initialSearchType
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

  const initialSearchType = params?.activeType
    || params?.initialSearchType
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
