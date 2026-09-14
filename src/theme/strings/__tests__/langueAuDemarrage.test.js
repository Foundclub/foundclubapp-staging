// 🔤 I18N-0 — l'app DÉMARRE dans la langue du téléphone.
//
// 🐞 Avant ce lot, `src/theme/strings/index.js` écrivait `lng: 'fr'` en dur : un
// téléphone réglé en anglais voyait « Bienvenu·e sur » quoi qu'il arrive. Ce
// témoin charge le VRAI i18next, avec la VRAIE initialisation, et ne double que
// la question « quelle langue ? ».

/** @type {'fr' | 'en'} */
let mockLangue = 'fr';

jest.mock('@/theme/strings/langue', () => ({
  langueEffective: () => mockLangue,
}));

/**
 * Charge l'initialisation d'i18next dans un registre de modules neuf.
 * @param {'fr' | 'en'} langue - La langue que le téléphone annonce.
 * @returns {any} Le module initialisé, et le `format` de date-fns du MÊME registre
 *   (les réglages par défaut de date-fns vivent dans son instance).
 */
const demarrer = (langue) => {
  mockLangue = langue;
  /** @type {any} */
  let module;
  jest.isolateModules(() => {
    module = {
      ...jest.requireActual('@/theme/strings'),
      format: jest.requireActual('date-fns').format,
    };
  });
  return module;
};

describe('I18N-0 — la langue au démarrage', () => {
  it('un téléphone en anglais voit l’accueil en anglais', () => {
    const { default: i18n, localeDesFormats } = demarrer('en');

    expect(i18n.language).toBe('en');
    expect(i18n.t('welcome.title')).toBe('Welcome to');
    expect(i18n.t('profile.actions.logout')).toBe('Log out');
    expect(localeDesFormats()).toBe('en-GB');
  });

  it('un téléphone en français garde l’app d’aujourd’hui', () => {
    const { default: i18n, localeDesFormats } = demarrer('fr');

    expect(i18n.language).toBe('fr');
    expect(i18n.t('welcome.title')).toBe('Bienvenu·e sur');
    expect(localeDesFormats()).toBe('fr-FR');
  });

  it('les dates suivent la langue, y compris après un changement', async () => {
    const { default: i18n, format } = demarrer('en');
    const lundi = new Date(2026, 8, 14);
    expect(format(lundi, 'EEEE')).toBe('Monday');

    await i18n.changeLanguage('fr');
    expect(format(lundi, 'EEEE')).toBe('lundi');
  });

  it('en anglais, le zéro prend le pluriel — et en français, le singulier', async () => {
    const { default: i18n } = demarrer('en');
    expect(i18n.t('myChildren.screen.years', { count: 0 })).toBe('0 years old');
    expect(i18n.t('myChildren.screen.years', { count: 1 })).toBe('1 year old');

    await i18n.changeLanguage('fr');
    expect(i18n.t('myChildren.screen.years', { count: 0 })).toBe('0 an');
  });
});
