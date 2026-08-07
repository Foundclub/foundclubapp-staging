import {
  ensureSearchMapGeolocationPermission,
  getCurrentSearchMapPosition,
  isSearchMapGeolocationSupported,
} from './searchMapGeolocationSource';

// D30 — « Autour de moi » localise vraiment.
//
// Ce fichier garde TOUTE l'orchestration écrite par D23 : on ne demande jamais
// une autorisation qu'on ne saurait pas exploiter, et aucun chemin d'échec ne
// lève — refus, capteur muet, coordonnées absurdes rendent `null`, ce que
// l'écran traduit par le message de repli plutôt que par de l'inertie.
//
// Ce qui change : la SOURCE de la position est résolue par plateforme
// (`searchMapGeolocationSource.native.js` / `.web.js`), comme `@/platform/device`.
// Le web garde `navigator.geolocation`, le natif utilise le module natif — et
// le bundle du site n'importe jamais la dépendance native.

const DEFAULT_GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  maximumAge: 45000,
  timeout: 10000,
});

// Filet de sécurité, et il couvre un blocage RÉEL, pas une hypothèse : si le
// module natif n'est pas lié, le paquet lève à l'intérieur d'une fonction
// `async` dont son propre wrapper jette la promesse. Aucun des deux rappels ne
// part alors, et l'écran resterait sur « … » indéfiniment. On borne donc
// l'attente juste au-delà du délai demandé : au pire, on retombe sur les
// suggestions.
const SAFETY_NET_MS = DEFAULT_GEOLOCATION_OPTIONS.timeout + 2000;

export const canUseSearchMapGeolocation = () => isSearchMapGeolocationSupported();

/**
 * Request the current device position for the search map.
 * Keeps the renderer detached from direct geolocation access details.
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export const requestCurrentSearchMapLocation = async () => {
  try {
    if (!isSearchMapGeolocationSupported()) {
      return null;
    }

    const hasPermission = await ensureSearchMapGeolocationPermission();
    if (!hasPermission) {
      return null;
    }

    return await new Promise((resolve) => {
      let settled = false;
      /** @type {any} */
      let safetyNet;

      const settle = (/** @type {{ lat: number, lng: number } | null} */ value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(safetyNet);
        resolve(value);
      };

      safetyNet = setTimeout(() => settle(null), SAFETY_NET_MS);

      // Le `try` sert à ANNULER le minuteur quand la source lève : sans lui, la
      // promesse serait bien rejetée puis rattrapée plus bas, mais le minuteur
      // survivrait 12 secondes pour rien.
      try {
        getCurrentSearchMapPosition(
          (/** @type {any} */ position) => {
            const lat = position?.coords?.latitude;
            const lng = position?.coords?.longitude;

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              settle(null);
              return;
            }

            settle({ lat, lng });
          },
          () => settle(null),
          DEFAULT_GEOLOCATION_OPTIONS,
        );
      } catch (error) {
        settle(null);
      }
    });
  } catch (error) {
    return null;
  }
};

export default {
  canUseSearchMapGeolocation,
  requestCurrentSearchMapLocation,
};
