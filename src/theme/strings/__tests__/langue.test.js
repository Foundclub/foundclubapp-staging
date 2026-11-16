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

/** @type {{ OS: string }} */
const mockPlatform = { OS: 'ios' };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ clef) => mockStockage.get(clef),
  removeItem: (/** @type {string} */ clef) => mockStockage.delete(clef),
  setItem: (/** @type {string} */ clef, /** @type {any} */ valeur) => {
    mockStockage.set(clef, valeur);
  },
}));

const {
  anglaisDisponible,
  CLEF_CHOIX_DE_LANGUE,
  enregistrerChoixDeLangue,
  langueDepuisLocale,
  langueDuTelephone,
  langueEffective,
  lireChoixDeLangue,
} = jest.requireActual('@/theme/strings/langue');

const navigateurAvant = Object.getOwnPropertyDescriptor(global, 'navigator');
beforeEach(() => {
  mockLocale = ['fr', 'FR'];
  mockPlatform.OS = 'ios';
  mockStockage.clear();
});
afterEach(() => {
  if (navigateurAvant) Object.defineProperty(global, 'navigator', navigateurAvant);
});

/**
 * Le navigateur du testeur : ses langues préférées, dans l'ordre de ses réglages.
 * @param {string[]} languages - `navigator.languages`.
 * @returns {void}
 */
const navigateur = (languages) => {
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: { language: languages[0], languages },
  });
};

// 🐞 RETOUCHES-T12B (16/11, M1292) — Chrome réglé « anglais en premier », fenêtre
// privée : le site restait en français. `Intl` suit la langue d'AFFICHAGE de Chrome
// (celle de Windows), pas la liste des langues préférées que le navigateur annonce
// aux sites (`navigator.languages`, l'en-tête Accept-Language).
describe('M1292 — sur le site, la première visite suit les langues préférées du navigateur', () => {
  it('navigateur « anglais en premier » sur un Chrome affiché en français → anglais', () => {
    mockPlatform.OS = 'web';
    mockLocale = ['fr', 'FR'];
    navigateur(['en-US', 'en', 'fr-FR']);
    expect(langueDuTelephone()).toBe('en');
    expect(langueEffective()).toBe('en');
  });

  it('navigateur « français en premier » → français', () => {
    mockPlatform.OS = 'web';
    mockLocale = ['en', 'US'];
    navigateur(['fr-FR', 'en-US']);
    expect(langueEffective()).toBe('fr');
  });

  it('le choix enregistré l’emporte ensuite sur le navigateur', () => {
    mockPlatform.OS = 'web';
    navigateur(['en-US']);
    enregistrerChoixDeLangue('fr');
    expect(langueEffective()).toBe('fr');
  });

  it('au téléphone, rien ne change : la locale du téléphone', () => {
    mockPlatform.OS = 'ios';
    mockLocale = ['fr', 'FR'];
    navigateur(['en-US']);
    expect(langueDuTelephone()).toBe('fr');
  });
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

// 🚧 GARDE-FOU DU 14/09 (chef d orchestre) : I18N-0 a pose le socle, mais ~6 040 lignes
// de francais restent ecrites en dur (lots I18N-1..4 pas faits). Sur un telephone en
// anglais, une build MAGASIN aurait montre un melange anglais/francais a des
// utilisateurs francais. Tant que le drapeau n est pas leve, la PRODUCTION reste en
// francais ; la recette et le local gardent l anglais pour avancer.
describe('garde-fou : pas d anglais a moitie traduit en production', () => {
  const envAvant = process.env.APP_ENV;
  afterEach(() => {
    process.env.APP_ENV = envAvant;
  });

  it('en production, un telephone en anglais ET un choix « English » restent en francais', () => {
    process.env.APP_ENV = 'production';
    mockLocale = ['en', 'US'];
    mockStockage.set(CLEF_CHOIX_DE_LANGUE, 'en');

    expect(anglaisDisponible()).toBe(false);
    expect(langueEffective()).toBe('fr');
  });

  it('en recette, l anglais reste disponible et suit le telephone', () => {
    process.env.APP_ENV = 'staging';
    mockLocale = ['en', 'US'];

    expect(anglaisDisponible()).toBe(true);
    expect(langueEffective()).toBe('en');
  });
});
