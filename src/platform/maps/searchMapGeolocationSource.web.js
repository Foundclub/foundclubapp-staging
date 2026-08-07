// Source de position — WEB.
//
// C'est le code que D23 avait écrit dans `searchMapGeolocation.js` : il est
// déplacé ici SANS changement de comportement. La raison du déplacement est
// entièrement défensive — le site compile les sources de `app`, et tant que la
// variante web n'importe pas le paquet natif de D30, Vite ne peut pas le
// résoudre, donc `vite build` ne peut pas casser.
//
// Conséquence voulue : un navigateur sans géolocalisation (ou une page servie
// sans HTTPS) reste détecté comme indisponible, et l'écran affiche le message
// de repli de D23 au lieu de rester inerte.

const getNavigatorGeolocation = () => {
  const candidates = [
    typeof navigator !== 'undefined' ? navigator : null,
    global?.navigator || null,
  ];

  return candidates.find(
    (candidate) => (
      candidate?.geolocation
      && typeof candidate.geolocation.getCurrentPosition === 'function'
    ),
  )?.geolocation || null;
};

export const isSearchMapGeolocationSupported = () => Boolean(getNavigatorGeolocation());

// Le navigateur porte lui-même sa demande d'autorisation, au premier appel de
// `getCurrentPosition`. Il n'y a rien à réclamer en amont.
export const ensureSearchMapGeolocationPermission = async () => true;

/**
 * @param {(position: any) => void} onSuccess
 * @param {() => void} onFailure
 * @param {Record<string, any>} options
 */
export const getCurrentSearchMapPosition = (onSuccess, onFailure, options) => {
  const geolocationApi = getNavigatorGeolocation();
  if (!geolocationApi) {
    onFailure();
    return;
  }

  geolocationApi.getCurrentPosition(onSuccess, onFailure, options);
};

export default {
  ensureSearchMapGeolocationPermission,
  getCurrentSearchMapPosition,
  isSearchMapGeolocationSupported,
};
