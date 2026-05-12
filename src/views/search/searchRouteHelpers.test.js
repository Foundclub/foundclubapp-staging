import {
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
