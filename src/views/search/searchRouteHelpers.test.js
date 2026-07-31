import {
  coerceSearchHubType,
  consumeSearchHubGuidanceSignal,
  getSearchHubGuidanceSignalKey,
  hasLegacySearchParams,
  resolveLegacySearchTarget,
} from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

describe('searchRouteHelpers', () => {
  it('builds the canonical guidance signal key for a search hub tab', () => {
    expect(getSearchHubGuidanceSignalKey('clubs')).toBe('search.tab.clubs');
    expect(getSearchHubGuidanceSignalKey('recrutement')).toBe('search.tab.recruitment');
  });

  it('emits the guidance signal only the first time a tab is exposed in a screen session', () => {
    const exposedTypes = new Set();

    expect(consumeSearchHubGuidanceSignal('clubs', exposedTypes)).toBe('search.tab.clubs');
    expect(consumeSearchHubGuidanceSignal('clubs', exposedTypes)).toBeNull();
    expect(consumeSearchHubGuidanceSignal('recruitment', exposedTypes)).toBe('search.tab.recruitment');
    expect(consumeSearchHubGuidanceSignal('clubs', exposedTypes)).toBeNull();
  });

  it('reconnait l onglet des matchs amicaux et retombe sur les evenements sinon', () => {
    expect(coerceSearchHubType('amicaux')).toBe('amicaux');
    expect(coerceSearchHubType('amical')).toBe('amicaux');
    expect(coerceSearchHubType('friendly')).toBe('amicaux');
    expect(coerceSearchHubType('AMICAUX')).toBe('amicaux');
    expect(coerceSearchHubType('recruitment')).toBe('recruitment');
    expect(coerceSearchHubType('inconnu')).toBe('events');
    expect(getSearchHubGuidanceSignalKey('amicaux')).toBe('search.tab.amicaux');
  });

  it('treats activeType params as a valid SearchHub redirect target', () => {
    expect(hasLegacySearchParams({ activeType: 'recruitment' })).toBe(true);

    expect(resolveLegacySearchTarget({ activeType: 'recruitment' }, { role: 'president' })).toEqual({
      params: {
        activeType: 'recruitment',
        initialRecruitmentTab: 'annonces',
        timestamp: undefined,
      },
      routeName: RouteNames.SearchHub,
    });
  });
});
