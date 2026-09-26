import i18next from 'i18next';
import { Alert, Linking, Platform } from 'react-native';

/**
 * CONVOC (demande d'Adel du 26/09) — OUVRIR UN LIEU DANS L'APPLI GPS DE SON CHOIX.
 *
 * « Sur le lieu […] ce serait bien qu'on puisse l'ouvrir dans le GPS, comme sur
 * les evenements classiques. Et pouvoir choisir l'application : Waze, Maps, ou
 * l'application native, Plans. »
 *
 * ♻️ UNE SEULE VERSION. Avant ce lot, la meme logique vivait TROIS fois :
 * `EventHeader.handleOpenLocationInGps` (le seul appele), et un `openExternalMap`
 * dans `maps.native.js` ET dans `maps.web.js`, appele NULLE PART. C'est ce
 * `openExternalMap` qui est repris ici, corrige, et que les deux ecrans appellent.
 *
 * 🧨 CE QUE LA LECTURE A TROUVE, ET QUI EXPLIQUE « AUCUN CHOIX » :
 *  · iOS — `Info.plist` ne declarait AUCUN `LSApplicationQueriesSchemes` :
 *    `canOpenURL('maps:…')` rendait donc toujours faux, et la fiche ouvrait
 *    Google Maps dans le navigateur au lieu de Plans.
 *  · Android — la balise `<queries>` ne declarait que `SEND` : depuis Android 11,
 *    Waze et Google Maps sont INVISIBLES pour `canOpenURL` sans declaration.
 *  Les deux declarations sont posees avec ce lot (`ios/foundclub/Info.plist`,
 *  `android/app/src/main/AndroidManifest.xml`).
 *
 * 🎛️ LE CHOIX passe par `Alert.alert` et sa liste de boutons + « Annuler » :
 * c'est ainsi que l'app propose deja un choix hors formulaire (annuler une
 * recurrence, `EventDetails.js` ; menu capitaine, `SquadDetailsScreen.js`).
 * Aucune dependance, aucun composant a monter : un appel, depuis n'importe ou.
 * ⚠️ Android affiche AU PLUS 3 boutons : la liste Android est donc bornee a
 * deux applis (voir `listExternalMapApps`) + « Annuler ».
 */

/** Les applis proposees, dans l'ordre ou le choix les montre. */
export const EXTERNAL_MAP_APPS = Object.freeze({
  apple: 'apple',
  device: 'device',
  google: 'google',
  waze: 'waze',
});

/**
 * Une coordonnee exploitable, ou `null`. ⛔ `Number(null)` vaut 0 : sans ce
 * garde, un lieu sans coordonnees pointerait au large du Golfe de Guinee.
 * @param {any} value
 * @returns {number | null}
 */
const toCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const nombre = Number(value);
  return Number.isFinite(nombre) ? nombre : null;
};

/**
 * Les adresses a ouvrir pour un lieu, une par appli.
 * @param {{ label?: string, latitude?: any, longitude?: any }} [target]
 * @returns {{
 *   apple: string, device: string, google: string, googleApp: string, waze: string,
 * } | null} `null` quand il n'y a ni adresse ni coordonnees : rien a ouvrir.
 */
export const buildExternalMapLinks = ({ label = '', latitude, longitude } = {}) => {
  const lat = toCoordinate(latitude);
  const lng = toCoordinate(longitude);
  const point = lat !== null && lng !== null ? `${lat},${lng}` : '';
  const texte = String(label || '').trim();
  if (!texte && !point) return null;

  const query = encodeURIComponent(texte || point);
  return {
    apple: point
      ? `https://maps.apple.com/?ll=${point}&q=${query}`
      : `https://maps.apple.com/?q=${query}`,
    device: point ? `geo:${point}?q=${point}(${query})` : `geo:0,0?q=${query}`,
    // La page Google Maps : le secours de tous les cas, et l'appli Google Maps
    // sur Android (elle intercepte ces liens quand elle est installee).
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    googleApp: point
      ? `comgooglemaps://?q=${query}&center=${point}`
      : `comgooglemaps://?q=${query}`,
    waze: point ? `waze://?ll=${point}&navigate=yes` : `waze://?q=${query}&navigate=yes`,
  };
};

/**
 * Une appli repond-elle a cette adresse ? Jamais d'exception : un refus vaut non.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
const peutOuvrir = async (url) => {
  try {
    return Boolean(await Linking.canOpenURL(url));
  } catch {
    return false;
  }
};

/**
 * Les applis de cartes REELLEMENT installees, dans l'ordre du choix.
 *
 * · iOS : Plans toujours (un lien `maps.apple.com` l'ouvre sans rien declarer),
 *   puis Google Maps et Waze s'ils repondent a leur schema.
 * · Android : Google Maps et Waze s'ils sont visibles ; l'appli de cartes du
 *   telephone (`geo:`) seulement SANS Google Maps — sur un Android, c'est presque
 *   toujours lui qui repond a `geo:`, et le proposer deux fois serait un doublon.
 * @param {NonNullable<ReturnType<typeof buildExternalMapLinks>>} links
 * @param {string} [os]
 * @returns {Promise<Array<{ key: string, url: string }>>}
 */
export const listExternalMapApps = async (links, os = Platform.OS) => {
  if (os === 'ios') {
    const [hasGoogle, hasWaze] = await Promise.all([
      peutOuvrir('comgooglemaps://'),
      peutOuvrir('waze://'),
    ]);
    return [
      { key: EXTERNAL_MAP_APPS.apple, url: links.apple },
      hasGoogle ? { key: EXTERNAL_MAP_APPS.google, url: links.googleApp } : null,
      hasWaze ? { key: EXTERNAL_MAP_APPS.waze, url: links.waze } : null,
    ].filter(Boolean);
  }

  if (os === 'android') {
    const [hasGoogle, hasWaze, hasDevice] = await Promise.all([
      peutOuvrir('google.navigation:q=0,0'),
      peutOuvrir('waze://'),
      peutOuvrir(links.device),
    ]);
    return [
      !hasGoogle && hasDevice ? { key: EXTERNAL_MAP_APPS.device, url: links.device } : null,
      hasGoogle ? { key: EXTERNAL_MAP_APPS.google, url: links.google } : null,
      hasWaze ? { key: EXTERNAL_MAP_APPS.waze, url: links.waze } : null,
    ].filter(Boolean);
  }

  return [];
};

/**
 * Ouvre une adresse ; si l'appli la refuse, la page Google Maps prend le relais.
 * @param {string} url
 * @param {string} secours
 * @returns {Promise<void>}
 */
const ouvrir = (url, secours) => Promise.resolve()
  .then(() => Linking.openURL(url))
  .catch(() => Linking.openURL(secours))
  .catch(() => {});

/**
 * Ouvre un lieu dans l'appli GPS : directement s'il n'y en a qu'une, sinon en
 * proposant le choix. Sur le site, Google Maps dans un nouvel onglet.
 * @param {{ label?: string, latitude?: any, longitude?: any }} target
 * @returns {Promise<boolean>} `false` quand il n'y avait rien a ouvrir.
 */
export const openExternalMap = async (target) => {
  const links = buildExternalMapLinks(target);
  if (!links) return false;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(links.google, '_blank', 'noopener,noreferrer');
    }
    return true;
  }

  const apps = await listExternalMapApps(links);
  if (apps.length <= 1) {
    await ouvrir(apps[0]?.url || links.google, links.google);
    return true;
  }

  Alert.alert(
    i18next.t('externalMap.title'),
    undefined,
    [
      // Premier dans la liste : iOS le range de toute facon en bas, et Android
      // le pose a gauche, a l'ecart des applis.
      { style: 'cancel', text: i18next.t('common.actions.cancel') },
      ...apps.map((app) => ({
        onPress: () => { ouvrir(app.url, links.google); },
        text: i18next.t(`externalMap.apps.${app.key}`),
      })),
    ],
    { cancelable: true },
  );
  return true;
};

export default openExternalMap;
