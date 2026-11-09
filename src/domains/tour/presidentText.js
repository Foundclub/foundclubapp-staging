import i18next from 'i18next';
import { Platform } from 'react-native';

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

/**
 * GUIDES-SITE (09/11) : une bulle qui parle d'un geste du téléphone (messagerie, bord de l'écran,
 * image du téléphone) a sa variante pour le site, sous la clé `<id>-site`.
 * @param {string} id - Id du texte du téléphone.
 * @param {string} fallback - Texte français du téléphone.
 * @param {string} siteFallback - Texte français du site.
 * @returns {string} Texte de la plateforme.
 */
export const tSite = (id, fallback, siteFallback) => (Platform.OS === 'web'
  ? t(`${id}-site`, siteFallback)
  : t(id, fallback));

export default t;
