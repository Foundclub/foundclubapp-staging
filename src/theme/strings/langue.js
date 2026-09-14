// 🔤 I18N-0 — QUELLE LANGUE PARLE L'APP.
//
// Jusqu'au 2026-09-14, `lng: 'fr'` était écrit en dur : un téléphone réglé en
// anglais voyait l'app en français, sans recours. La règle est désormais :
//   1. un choix fait dans le profil (« Langue ») prime, et survit au redémarrage ;
//   2. sinon, la langue du téléphone : français si elle commence par `fr`,
//      anglais pour toute autre langue ;
//   3. et si le téléphone ne dit rien, français (le parc installé est français).
//
// ⛔ Ce module ne dépend PAS d'i18next : l'écran de profil l'importe, et ses
// témoins remplacent `react-i18next` par une doublure sans `initReactI18next`.
// Importer `@/theme/strings` depuis un écran ferait tomber ces suites.
//
// 🧪 Dans Jest, `jest.setup.js` fixe `langueEffective` à `fr` : les 300 fichiers
// de témoins qui lisent du français restent vrais quelle que soit la langue de
// la machine qui les lance (la CI tourne en anglais).
import { getDeviceLocale } from '@/utils/device/deviceInfo';

import { getItem, removeItem, setItem } from '@/platform/storage';

export const LANGUES_DISPONIBLES = ['fr', 'en'];
export const CLEF_CHOIX_DE_LANGUE = 'app.language_choice';

/**
 * La langue de l'app pour une locale de téléphone.
 * @param {string | null | undefined} locale - Par exemple `fr_FR`, `en-AE`, `ar`.
 * @returns {'fr' | 'en'} `fr` si la locale commence par `fr` ou est inconnue, `en` sinon.
 */
export const langueDepuisLocale = (locale) => {
  const texte = String(locale || '').trim().toLowerCase();
  if (texte === '' || texte.startsWith('fr')) return 'fr';
  return 'en';
};

/**
 * La langue du téléphone, ramenée aux langues de l'app.
 * @returns {'fr' | 'en'} La langue déduite, `fr` si la lecture échoue.
 */
export const langueDuTelephone = () => {
  try {
    return langueDepuisLocale((getDeviceLocale() || []).join('-'));
  } catch {
    return 'fr';
  }
};

/**
 * Le choix fait dans le profil, s'il y en a un.
 * @returns {'fr' | 'en' | null} La langue choisie, ou `null` pour « la langue du téléphone ».
 */
export const lireChoixDeLangue = () => {
  try {
    const choix = getItem(CLEF_CHOIX_DE_LANGUE);
    return LANGUES_DISPONIBLES.includes(choix) ? choix : null;
  } catch {
    return null;
  }
};

/**
 * Enregistre le choix du profil. `null` revient à la langue du téléphone.
 * @param {'fr' | 'en' | null} choix - La langue choisie.
 * @returns {void}
 */
export const enregistrerChoixDeLangue = (choix) => {
  if (LANGUES_DISPONIBLES.includes(choix)) {
    setItem(CLEF_CHOIX_DE_LANGUE, choix);
    return;
  }
  removeItem(CLEF_CHOIX_DE_LANGUE);
};

/**
 * La langue que l'app doit parler maintenant.
 * @returns {'fr' | 'en'} Le choix du profil, sinon la langue du téléphone.
 */
export const langueEffective = () => lireChoixDeLangue() || langueDuTelephone();
