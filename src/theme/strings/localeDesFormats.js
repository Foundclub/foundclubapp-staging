import i18next from 'i18next';

/**
 * 🔤 I18N-0 — LA LOCALE DES FORMATS DE DATE ET DE NOMBRE.
 *
 * 86 appels écrivent `'fr-FR'` en dur (`toLocaleDateString('fr-FR', …)`,
 * `Intl.DateTimeFormat('fr-FR', …)`) : un téléphone anglais y lirait « lundi 14
 * septembre ». Les lots I18N-1 à 4 les remplacent par `localeDesFormats()`.
 *
 * ⛔ POURQUOI UN FICHIER À PART, ET PAS UN EXPORT DE `@/theme/strings` : un écran
 * qui importe `@/theme/strings` charge l'initialisation d'i18next, et les témoins
 * qui remplacent `react-i18next` par une doublure (sans `initReactI18next`)
 * tombent d'un coup. Ce module ne lit que l'instance d'i18next : sans
 * initialisation (dans un témoin), il répond `fr-FR`.
 * @returns {'fr-FR' | 'en-GB'} La locale à passer à `Intl` / `toLocale*String`.
 */
const localeDesFormats = () => (i18next.language === 'en' ? 'en-GB' : 'fr-FR');

export default localeDesFormats;
