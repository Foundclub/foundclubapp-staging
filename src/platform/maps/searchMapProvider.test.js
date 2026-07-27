// La configuration est injectée par l'override global exposé par le module,
// jamais mutée via `process.env` : babel-plugin-inline-dotenv réécrit chaque
// lecture littérale `process.env.X` en `process.env.X || "<valeur du fichier .env>"`,
// et neutralise `delete process.env.X` (le `delete` porte alors sur une expression,
// plus sur une référence : il ne supprime rien). Une clé vide n'était donc pas
// exprimable sur un poste de dev, et le nettoyage entre tests n'avait pas lieu.
describe('searchMapProvider', () => {
  const TEST_OVERRIDE_KEY = 'fcSearchMapTestOverrides';
  const originalOverrides = global[TEST_OVERRIDE_KEY];

  const loadWithConfig = (overrides) => {
    global[TEST_OVERRIDE_KEY] = overrides;
    // eslint-disable-next-line global-require
    return require('./searchMapProvider');
  };

  afterEach(() => {
    if (originalOverrides === undefined) {
      delete global[TEST_OVERRIDE_KEY];
    } else {
      global[TEST_OVERRIDE_KEY] = originalOverrides;
    }

    jest.resetModules();
  });

  test('defaults to tomtom and exposes the configured key', () => {
    const {
      getSearchMapProvider,
      getTomTomApiKey,
      isTomTomSearchMapMisconfigured,
      SEARCH_MAP_PROVIDERS,
    } = loadWithConfig({
      FC_SEARCH_MAP_PROVIDER: '',
      TOMTOM_API_KEY: 'tomtom-demo-key',
    });

    expect(getSearchMapProvider()).toBe(SEARCH_MAP_PROVIDERS.tomtom);
    expect(getTomTomApiKey()).toBe('tomtom-demo-key');
    expect(isTomTomSearchMapMisconfigured()).toBe(false);
  });

  test('defaults to tomtom without a key but reports the misconfiguration', () => {
    const {
      getSearchMapProvider,
      getTomTomApiKey,
      isTomTomSearchMapMisconfigured,
      SEARCH_MAP_PROVIDERS,
    } = loadWithConfig({
      FC_SEARCH_MAP_PROVIDER: '',
      TOMTOM_API_KEY: '',
    });

    expect(getSearchMapProvider()).toBe(SEARCH_MAP_PROVIDERS.tomtom);
    expect(getTomTomApiKey()).toBe('');
    expect(isTomTomSearchMapMisconfigured()).toBe(true);
  });

  test('keeps explicit legacy override even when a TomTom key exists', () => {
    const {
      getSearchMapProvider,
      isTomTomSearchMapEnabled,
      isTomTomSearchMapMisconfigured,
      SEARCH_MAP_PROVIDERS,
    } = loadWithConfig({
      FC_SEARCH_MAP_PROVIDER: 'legacy',
      TOMTOM_API_KEY: 'tomtom-demo-key',
    });

    expect(getSearchMapProvider()).toBe(SEARCH_MAP_PROVIDERS.legacy);
    expect(isTomTomSearchMapEnabled()).toBe(false);
    expect(isTomTomSearchMapMisconfigured()).toBe(false);
  });
});
