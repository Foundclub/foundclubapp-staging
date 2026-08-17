import { Platform } from 'react-native';

import { resolveWebAppOrigin } from '@/utils/shareLinks';

/**
 * S09 — les regles pures du levier, isolees de tout appel reseau.
 *
 * 🔓 Elles sont dans leur propre fichier pour une raison pratique : le client
 * HTTP jette a l'import quand la configuration reseau n'est pas resolue. Sans
 * cette separation, la regle « on ne bloque pas » ne serait pas testable.
 */

// 🏪 Adresses de repli, utilisees seulement si le serveur n'en fournit pas.
// ⚠️ iOS : l'identifiant numerique App Store n'existe NULLE PART dans les trois
// depots (mesure du 2026-08-17). On ne l'invente pas — la recherche App Store
// mene bien a la boutique, et le champ `iosStoreUrl` cote serveur permet de
// poser le vrai lien sans republier l'app.
const DEFAULT_STORE_URL_BY_PLATFORM = {
  android: 'https://play.google.com/store/apps/details?id=com.foundclub',
  ios: 'https://apps.apple.com/fr/search?term=foundclub',
};

/**
 * Ne laisse sortir qu'une adresse http/https.
 * @param {unknown} value
 * @returns {string | null} L'adresse si elle est bien en http/https.
 */
const toHttpUrl = (value) => {
  const normalized = String(value || '').trim();
  return /^https?:\/\/\S+$/i.test(normalized) ? normalized : null;
};

/**
 * L'adresse de boutique connue de l'app, quand le serveur n'en donne aucune.
 * @returns {string | null} L'adresse de repli pour CETTE plateforme, `null`
 * partout ailleurs (le web n'est jamais bloque).
 */
const resolveDefaultStoreUrl = () => {
  if (Platform.OS === 'ios') return DEFAULT_STORE_URL_BY_PLATFORM.ios;
  if (Platform.OS === 'android') return DEFAULT_STORE_URL_BY_PLATFORM.android;
  return null;
};

/**
 * 🚨 LA SEULE PORTE VERS L'ECRAN BLOQUANT, ET ELLE EST STRICTE.
 * Serveur injoignable, reponse illisible, `blocked` absent, `blocked: "true"`
 * en texte, verdict inconnu : tout cela rend `false`. Seul le booleen `true`
 * bloque.
 * @param {unknown} payload
 * @returns {boolean}
 */
export const isBlockedByUpdateGate = (payload) => (
  Boolean(payload)
  && typeof payload === 'object'
  && !Array.isArray(payload)
  && /** @type {{ blocked?: unknown }} */ (payload).blocked === true
);

/**
 * L'adresse de la boutique de LA plateforme de ce telephone.
 * @param {unknown} payload
 * @returns {string | null}
 */
export const resolveUpdateStoreUrl = (payload) => (
  toHttpUrl(/** @type {{ storeUrl?: unknown }} */ (payload || {}).storeUrl)
  || resolveDefaultStoreUrl()
);

/**
 * 🔒 L'issue de secours. Un ecran bloquant sans moyen de joindre quelqu'un est
 * un cul-de-sac : le repli est le site public, deja resolu par le depot.
 * @param {unknown} payload
 * @returns {string | null}
 */
export const resolveUpdateContactUrl = (payload) => {
  const fromServer = toHttpUrl(/** @type {{ contactUrl?: unknown }} */ (payload || {}).contactUrl);
  if (fromServer) return fromServer;

  try {
    return toHttpUrl(resolveWebAppOrigin());
  } catch (_error) {
    // Configuration reseau non resolue : on prefere un bouton eteint a un
    // plantage sur l'ecran qui sert justement a expliquer la panne.
    return null;
  }
};
