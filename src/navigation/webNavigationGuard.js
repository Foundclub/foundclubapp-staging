import { Alert, Platform } from 'react-native';

import { isWebRouteSupported } from '@/navigation/webRoutes';

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
    Alert.alert(
      'Bientôt sur le site',
      "Cet écran n'est pas encore disponible sur le site :"
      + " ouvre-le depuis l'application FoundClub.",
    );
    return false;
  }

  navigation?.navigate(routeName, params);
  return true;
};

export default navigateOrExplainOnWeb;
