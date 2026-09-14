// 🔤 I18N-0 — la règle qui choisit la langue de l'app.
//
// `jest.setup.js` remplace ce module par un double « tout en français » pour les
// autres témoins : ici on teste le VRAI.
jest.unmock('@/theme/strings/langue');

/** @type {string[] | undefined} */
let mockLocale;
/** @type {Map<string, any>} */
const mockStockage = new Map();

jest.mock('@/utils/device/deviceInfo', () => ({
  getDeviceLocale: () => {
    if (mockLocale === undefined) throw new Error('lecture impossible');
    return mockLocale;
  },
}));

jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ clef) => mockStockage.get(clef),
  removeItem: (/** @type {string} */ clef) => mockStockage.delete(clef),
  setItem: (/** @type {string} */ clef, /** @type {any} */ valeur) => {
    mockStockage.set(clef, valeur);
  },
}));

const {
  CLEF_CHOIX_DE_LANGUE,
  enregistrerChoixDeLangue,
  langueDepuisLocale,
  langueDuTelephone,
  langueEffective,
  lireChoixDeLangue,
} = jest.requireActual('@/theme/strings/langue');

beforeEach(() => {
  mockLocale = ['fr', 'FR'];
  mockStockage.clear();
});

describe('I18N-0 — langueDepuisLocale', () => {
  it.each([
    ['fr_FR', 'fr'],
    ['fr-BE', 'fr'],
    ['fr-CH', 'fr'],
    ['FR', 'fr'],
    ['en_US', 'en'],
    ['en-AE', 'en'],
    ['ar-AE', 'en'],
    ['de-CH', 'en'],
    ['nl-BE', 'en'],
  ])('%s → %s', (locale, attendue) => {
    expect(langueDepuisLocale(locale)).toBe(attendue);
  });

  it('reste en français quand le téléphone ne dit rien', () => {
    expect(langueDepuisLocale(undefined)).toBe('fr');
    expect(langueDepuisLocale('')).toBe('fr');
  });
});

describe('I18N-0 — langueDuTelephone', () => {
  it('lit la locale du téléphone', () => {
    mockLocale = ['en', 'GB'];
    expect(langueDuTelephone()).toBe('en');
  });

  it('retombe sur le français si la lecture échoue', () => {
    mockLocale = undefined;
    expect(langueDuTelephone()).toBe('fr');
  });
});

describe('I18N-0 — le choix du profil prime sur le téléphone', () => {
  it('sans choix, suit le téléphone', () => {
    mockLocale = ['en', 'US'];
    expect(lireChoixDeLangue()).toBeNull();
    expect(langueEffective()).toBe('en');
  });

  it('un choix enregistré l’emporte, dans les deux sens', () => {
    mockLocale = ['en', 'US'];
    enregistrerChoixDeLangue('fr');
    expect(mockStockage.get(CLEF_CHOIX_DE_LANGUE)).toBe('fr');
    expect(langueEffective()).toBe('fr');

    mockLocale = ['fr', 'FR'];
    enregistrerChoixDeLangue('en');
    expect(langueEffective()).toBe('en');
  });

  it('« langue du téléphone » efface le choix', () => {
    mockLocale = ['en', 'US'];
    enregistrerChoixDeLangue('fr');
    enregistrerChoixDeLangue(null);
    expect(mockStockage.has(CLEF_CHOIX_DE_LANGUE)).toBe(false);
    expect(langueEffective()).toBe('en');
  });

  it('ignore une valeur stockée inconnue', () => {
    mockLocale = ['fr', 'FR'];
    mockStockage.set(CLEF_CHOIX_DE_LANGUE, 'de');
    expect(lireChoixDeLangue()).toBeNull();
    expect(langueEffective()).toBe('fr');
  });
});
