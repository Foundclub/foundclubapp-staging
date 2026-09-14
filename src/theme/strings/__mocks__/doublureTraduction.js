/**
 * 🔤 I18N-2 — UNE DOUBLURE DE TRADUCTION QUI SE COMPORTE COMME L'APP EN FRANÇAIS.
 *
 * Les lots I18N remplacent `'Sur le banc'` par `t('clef', 'Sur le banc')`. Un
 * témoin qui ne double pas `react-i18next` reçoit alors la doublure « pas prête »
 * de la bibliothèque : elle rend le repli simple, mais la CLEF pour un pluriel
 * (`defaultValue_one` / `defaultValue_other`) et `{{prenom}}` tel quel pour une
 * interpolation. Le témoin rougit sans qu'aucun écran n'ait changé.
 *
 * Cette doublure fait ce que fait l'app en français, et rien d'autre :
 * 1. le texte de `fr.js` s'il existe (comme i18next) ;
 * 2. sinon le repli (`t('clef', 'texte')` ou `defaultValue_one` / `_other`) ;
 * 3. les `{{jetons}}` remplacés par les valeurs ;
 * 4. le pluriel FRANÇAIS : 0 et 1 prennent le singulier.
 *
 * Usage, dans un témoin :
 *   jest.mock('react-i18next', () => (
 *     jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
 *   ));
 *   jest.mock('i18next', () => (
 *     jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
 *   ));
 * @module doublureTraduction
 */
const fr = require('@/theme/strings/translations/fr').default;

/**
 * Le texte de fr.js pour une clef pointée.
 * @param {string} clef - Par exemple `eventDetails.title`.
 * @returns {string | undefined} Le texte, ou `undefined` s'il n'existe pas.
 */
const lire = (clef) => {
  const valeur = String(clef || '')
    .split('.')
    .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), fr);
  return typeof valeur === 'string' ? valeur : undefined;
};

/**
 * La traduction française d'une clef, comme i18next la rendrait.
 * @param {string} clef - La clef.
 * @param {string | object} [repliOuOptions] - Le repli, ou les options.
 * @param {object} [options] - Les options quand le deuxième argument est le repli.
 * @returns {string} Le texte affiché.
 */
const t = (clef, repliOuOptions, options) => {
  const opts = repliOuOptions && typeof repliOuOptions === 'object'
    ? repliOuOptions
    : (options || {});
  const repli = typeof repliOuOptions === 'string' ? repliOuOptions : undefined;
  let texte;
  if (typeof opts.count === 'number') {
    const suffixe = Math.abs(opts.count) < 2 ? '_one' : '_other';
    texte = lire(`${clef}${suffixe}`) ?? opts[`defaultValue${suffixe}`];
  }
  texte = texte ?? lire(clef) ?? repli ?? opts.defaultValue ?? clef;
  return String(texte).replace(/\{\{\s*(\w+)\s*\}\}/g, (jeton, nom) => (
    opts[nom] === undefined ? jeton : String(opts[nom])
  ));
};

const i18n = {
  changeLanguage: () => Promise.resolve(),
  exists: (/** @type {string} */ clef) => lire(clef) !== undefined,
  language: 'fr',
  off: () => {},
  on: () => {},
  t,
};

const reactI18next = {
  initReactI18next: { init: () => {}, type: '3rdParty' },
  Trans: ({ children }) => children,
  useTranslation: () => ({ i18n, t }),
  withTranslation: () => (Composant) => Composant,
};

module.exports = {
  i18next: { __esModule: true, default: i18n, ...i18n },
  reactI18next,
  t,
};
