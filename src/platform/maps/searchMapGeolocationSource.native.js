import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

// Source de position — NATIF (D30).
//
// LA MESURE QUI A JUSTIFIÉ LA DÉPENDANCE, et elle est vérifiable dans le
// paquet installé : React Native 0.78 n'expose AUCUN `navigator.geolocation`.
// Aucun fichier de `react-native/Libraries/Core/` ne le mentionne,
// `setUpGeolocation.js` n'existe plus, et `react-native/index.js` n'exporte
// aucun `Geolocation`. C'est exactement ce que D23 avait constaté et ce qu'il
// ne pouvait pas réparer sans un GO d'Adel.
//
// `@react-native-community/geolocation` expose la MÊME signature que l'API du
// navigateur — `getCurrentPosition(succès, échec, options)` — donc
// l'orchestrateur partagé est identique sur les deux plateformes.

// Rien à sonder ici : le module est lié à la compilation. S'il ne l'était pas
// (build faite avant l'installation, `pod install` non rejoué), le premier
// accès LÈVE — le paquet remplace le module natif absent par un objet piégé.
// L'orchestrateur rattrape et rend `null`, donc l'écran retombe sur le message
// de repli de D23 au lieu de rester inerte.
export const isSearchMapGeolocationSupported = () => true;

// iOS ne se demande pas ici : le module natif ouvre lui-même sa demande au
// premier `getCurrentPosition`, en affichant pour motif la clé
// `NSLocationWhenInUseUsageDescription` de `ios/foundclub/Info.plist`.
export const ensureSearchMapGeolocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const alreadyGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (alreadyGranted) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      buttonNegative: 'Annuler',
      buttonNeutral: 'Plus tard',
      buttonPositive: 'Autoriser',
      message: 'Nous avons besoin de ta position pour afficher les résultats autour de toi.',
      title: 'Permission de localisation',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

/**
 * @param {(position: any) => void} onSuccess
 * @param {() => void} onFailure
 * @param {Record<string, any>} options
 */
export const getCurrentSearchMapPosition = (onSuccess, onFailure, options) => {
  Geolocation.getCurrentPosition(onSuccess, onFailure, options);
};

export default {
  ensureSearchMapGeolocationPermission,
  getCurrentSearchMapPosition,
  isSearchMapGeolocationSupported,
};
