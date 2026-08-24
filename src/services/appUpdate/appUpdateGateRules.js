import { Platform } from 'react-native';

import { resolveWebAppOrigin } from '@/utils/shareLinks';

/**
 * S09 — les regles pures du levier, isolees de tout appel reseau.
 *
 * 🔓 Elles sont dans leur propre fichier pour une raison pratique : le client
 * HTTP jette a l'import quand la configuration reseau n'est pas resolue. Sans
 * cette separation, la regle « on ne bloque pas » ne serait pas testable.
 *
 * 🟠 R3 y ajoute le SECOND etage — « recommande ». Meme exigence : ce qui n'est
 * pas explicitement dit par le serveur ne declenche rien.
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

// Planche B du pack : « 3 lignes max ». Le serveur coupe deja, l'app recoupe —
// une reponse plus ancienne, ou un serveur non deploye, ne doit pas pouvoir
// pousser le bouton hors de l'ecran.
const RELEASE_NOTES_MAX_LINES = 3;

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
 * Le verdict est-il un objet exploitable ? Une chaine, un tableau, `null` : non.
 * @param {unknown} payload
 * @returns {boolean}
 */
const isVerdictObject = (payload) => (
  Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload)
);

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
  isVerdictObject(payload)
  && /** @type {{ blocked?: unknown }} */ (payload).blocked === true
);

/**
 * 🟠 LA PORTE VERS L'INVITATION « PLUS TARD » — aussi stricte, et SUBORDONNEE.
 *
 * 🔒 Elle rend `false` des que l'ecran bloquant s'affiche, meme si le serveur
 * disait les deux. Poser une feuille refusable par-dessus un ecran qui ne se
 * refuse pas donnerait a l'utilisateur une sortie de secours qui n'existe pas :
 * il appuierait sur « Plus tard » et retomberait sur le mur.
 *
 * 🔓 Et comme l'etage du dessus : un serveur muet, une reponse illisible, un
 * `recommended: "true"` en texte ne montrent RIEN. Deranger quelqu'un sur un
 * doute est moins grave que de le bloquer, mais ce n'est pas une raison pour
 * relacher la regle a l'etage ou elle est facile a tenir.
 * @param {unknown} payload
 * @returns {boolean}
 */
export const isRecommendedByUpdateGate = (payload) => (
  isVerdictObject(payload)
  && /** @type {{ recommended?: unknown }} */ (payload).recommended === true
  && !isBlockedByUpdateGate(payload)
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

/**
 * La version que le serveur conseille d'installer, quand il en nomme une.
 * @param {unknown} payload
 * @returns {string | null} Le numero, ou `null` — l'ecran omet alors la ligne
 * plutot que d'afficher un libelle a trou.
 */
export const resolveUpdateRecommendedVersion = (payload) => {
  const raw = String(
    /** @type {{ recommendedVersion?: unknown }} */ (payload || {}).recommendedVersion || '',
  ).trim();
  return raw || null;
};

/**
 * 🧾 Les nouveautes de la planche B — TOUJOURS un tableau.
 *
 * Un tableau vide est le signal « pas de carte a dessiner » : le pack refuse
 * explicitement une carte « Dans cette version » sans contenu. Ce qui n'est pas
 * une chaine non vide est jete ici, avant l'ecran.
 * @param {unknown} payload
 * @returns {string[]}
 */
export const resolveUpdateReleaseNotes = (payload) => {
  const raw = /** @type {{ releaseNotes?: unknown }} */ (payload || {}).releaseNotes;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((line) => typeof line === 'string')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, RELEASE_NOTES_MAX_LINES);
};
