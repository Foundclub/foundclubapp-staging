describe('searchMapProvider', () => {
  const TEST_OVERRIDE_KEY = 'fcSearchMapTestOverrides';
  const originalProvider = process.env.FC_SEARCH_MAP_PROVIDER;
  const originalTomTomKey = process.env.TOMTOM_API_KEY;
  const originalOverrides = global[TEST_OVERRIDE_KEY];

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.FC_SEARCH_MAP_PROVIDER;
    } else {
      process.env.FC_SEARCH_MAP_PROVIDER = originalProvider;
    }

    if (originalTomTomKey === undefined) {
      delete process.env.TOMTOM_API_KEY;
    } else {
      process.env.TOMTOM_API_KEY = originalTomTomKey;
    }

    if (originalOverrides === undefined) {
      delete global[TEST_OVERRIDE_KEY];
    } else {
      global[TEST_OVERRIDE_KEY] = originalOverrides;
    }

    jest.resetModules();
  });

  test('defaults to tomtom when a key is configured', () => {
    process.env.FC_SEARCH_MAP_PROVIDER = '';
    process.env.TOMTOM_API_KEY = 'tomtom-demo-key';
    global[TEST_OVERRIDE_KEY] = {
      FC_SEARCH_MAP_PROVIDER: '',
      TOMTOM_API_KEY: 'tomtom-demo-key',
    };

    // eslint-disable-next-line global-require
    const { getSearchMapProvider, SEARCH_MAP_PROVIDERS } = require('./searchMapProvider');

    expect(getSearchMapProvider()).toBe(SEARCH_MAP_PROVIDERS.tomtom);
  });

  test('defaults to tomtom even when no key is configured', () => {
    process.env.FC_SEARCH_MAP_PROVIDER = '';
    process.env.TOMTOM_API_KEY = '';
    global[TEST_OVERRIDE_KEY] = {
      FC_SEARCH_MAP_PROVIDER: '',
      TOMTOM_API_KEY: '',
    };

    // eslint-disable-next-line global-require
    const { getSearchMapProvider, SEARCH_MAP_PROVIDERS } = require('./searchMapProvider');

    expect(getSearchMapProvider()).toBe(SEARCH_MAP_PROVIDERS.tomtom);
  });

  test('keeps explicit legacy override even when a TomTom key exists', () => {
    process.env.FC_SEARCH_MAP_PROVIDER = 'legacy';
    process.env.TOMTOM_API_KEY = 'tomtom-demo-key';
    global[TEST_OVERRIDE_KEY] = {
      FC_SEARCH_MAP_PROVIDER: 'legacy',
      TOMTOM_API_KEY: 'tomtom-demo-key',
    };

    // eslint-disable-next-line global-require
    const { getSearchMapProvider, SEARCH_MAP_PROVIDERS } = require('./searchMapProvider');

    expect(getSearchMapProvider()).toBe(SEARCH_MAP_PROVIDERS.legacy);
  });
});
