import i18next from 'i18next';
import { Alert, Linking, Platform } from 'react-native';

import { isWebRouteSupported } from '@/navigation/webRoutes';
import { DEFAULT_STORE_URL_BY_PLATFORM } from '@/services/appUpdate/appUpdateGateRules';

/**
 * La boutique du visiteur : l'App Store sur un appareil Apple, Google Play ailleurs.
 * ponytail: lue sur le `userAgent` ; un ordinateur sous Windows ou Linux reçoit la page
 * Google Play (elle sait envoyer l'app vers un téléphone). Sortie : une page du site qui
 * montre les deux boutiques, si Adel la demande.
 * @returns {string} L'adresse de la boutique.
 */
const boutiqueDuVisiteur = () => {
  const agent = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
  return /iPhone|iPad|iPod|Macintosh/.test(agent)
    ? DEFAULT_STORE_URL_BY_PLATFORM.ios
    : DEFAULT_STORE_URL_BY_PLATFORM.android;
};

/**
 * Garde-fou contre l atterrissage silencieux sur « / ».
 *
 * Sur le web, `getWebRoutePattern()` retombe sur '/' quand un ecran n a pas de
 * motif (webRoutes.js:252). Naviguer vers un ecran non route ne leve donc AUCUNE
 * erreur : on arrive sur l accueil ou sur une page blanche, sans le moindre
 * signal. C est exactement la panne du 18/07, et c est ce que le test de parite
 * empeche pour les ecrans EXISTANTS.
 *
 * Reste le cas d un ecran volontairement exempte en attendant son lot de
 * routage web (MOBILE_ONLY_SCREENS, TODO(L7) des matchs amicaux) : le test de
 * parite est vert, mais l utilisateur du site, lui, serait quand meme renvoye a
 * l accueil sans explication.
 *
 * Cette fonction ferme ce trou et **se desactive toute seule** : le jour ou le
 * motif est ajoute dans WEB_ROUTE_PATTERNS, `isWebRouteSupported()` devient vrai
 * et la navigation redevient normale. Il n y a rien a penser a retirer.
 * @param {any} navigation - Le navigateur react-navigation courant.
 * @param {string} routeName - L ecran vise.
 * @param {any} [params] - Ses parametres.
 * @returns {boolean} Vrai si la navigation a eu lieu.
 */
export const navigateOrExplainOnWeb = (navigation, routeName, params = undefined) => {
  if (Platform.OS === 'web' && !isWebRouteSupported(routeName)) {
    // CORR-CHEMINS (30/10, point 47, Adel « B ») : plus de « Bientôt sur le site » ; l'écran vit
    // dans l'application, et la boutique est à un geste.
    Alert.alert(
      i18next.t('webNavigationGuard.surLApp.title', 'Disponible sur l’app'),
      i18next.t(
        'webNavigationGuard.surLApp.message',
        "Cet écran se trouve dans l'application FoundClub, gratuite sur l'App Store et Google Play.",
      ),
      [
        { style: 'cancel', text: i18next.t('webNavigationGuard.surLApp.fermer', 'Plus tard') },
        {
          isPreferred: true,
          onPress: () => { Linking.openURL(boutiqueDuVisiteur()).catch(() => {}); },
          text: i18next.t('webNavigationGuard.surLApp.ouvrir', "Télécharger l'app"),
        },
      ],
    );
    return false;
  }

  navigation?.navigate(routeName, params);
  return true;
};

export default navigateOrExplainOnWeb;
