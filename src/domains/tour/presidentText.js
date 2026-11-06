import i18next from 'i18next';

/**
 * Texte du guide Dirigeant·e, par i18n avec repli français. Les clés vivent sous
 * `tourCatalog.president` dans `fr.js` et `en.js`, regroupées à la fin du chantier.
 * @param {string} id - Id de l'étape ou du texte.
 * @param {string} fallback - Texte français.
 * @param {Record<string, any>} [values] - Interpolation.
 * @returns {string} Texte.
 */
const t = (id, fallback, values) => String(
  i18next.t(`tourCatalog.president.${id}`, fallback, values),
);

export default t;
