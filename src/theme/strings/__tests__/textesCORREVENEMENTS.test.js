/* eslint-disable max-len -- les phrases de fr.js sont citées en entier */
import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// CORR-EVENEMENTS (31/10/2026) — thème K/L de la recette du site, décisions d'Adel figées
// dans FEUILLE-REFERENCE-3010.md. Ce témoin lit fr.js par la vraie résolution d'i18next
// (pluriels compris). ROUGE avant le lot.

const i18nextTemoin = require('i18next');

const creer = (/** @type {string} */ lng, /** @type {any} */ translation) => {
  const instance = i18nextTemoin.createInstance();
  instance.init({
    compatibilityJSON: 'v4',
    fallbackLng: lng,
    interpolation: { escapeValue: false },
    lng,
    resources: { [lng]: { translation } },
  });
  return instance;
};

const i18n = creer('fr', fr);
const i18nEn = creer('en', en);

describe('CORR-EVENEMENTS — textes', () => {
  it('136 : une détection sans inscrit dit « Pas encore d’inscrits », sans « 0 inscrit »', () => {
    const zero = i18n.t('detection.squad.checkIn.subtitle', { count: 0 });
    expect(zero).toMatch(/^Pas encore d’inscrits/);
    expect(zero).not.toMatch(/0 inscrit|rarement/);
    expect(i18nEn.t('detection.squad.checkIn.subtitle', { count: 0 })).toMatch(/^No one registered yet/);
    // Les autres nombres ne bougent pas.
    expect(i18n.t('detection.squad.checkIn.subtitle', { count: 8 })).toBe('Sur 8 inscrits, rarement tous se présentent. Générer avant le pointage produit des équipes fausses.');
  });
});
