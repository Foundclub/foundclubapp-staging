import {
  consumeSearchHubGuidanceSignal,
  getSearchHubGuidanceSignalKey,
} from '@/views/search/searchRouteHelpers';

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
});
