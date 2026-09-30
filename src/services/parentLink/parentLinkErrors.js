/**
 * PARENT-LIEN — le code serveur d'un refus (`PARENT_LINK_…`), où qu'il se trouve.
 *
 * Module PUR, sans client HTTP : les écrans le lisent sans charger le réseau (le client exige
 * la configuration d'exécution, absente des témoins).
 * @param {any} error - L'erreur préservée (`buildPreservedApiError`) ou la charge Strapi déballée.
 * @returns {string} Le code, ou une chaîne vide.
 */
export const parentLinkErrorCode = (error) => String(
  error?.details?.code || error?.details?.details?.code || error?.code || '',
).trim();

export default parentLinkErrorCode;
