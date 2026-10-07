// CONVOC (26/09) — `openExternalMap` vit desormais dans `./externalMap`, en UNE
// version pour l'app et le site. Celle qui etait ici n'etait appelee nulle part.
import { openExternalMap } from './externalMap';

export { openExternalMap };

export const renderMap = () => null;

/**
 * ADRESSE-CARTE (07/10) — la carte « à épingle » du téléphone : la même page Leaflet que la carte
 * de recherche, dans une WebView. ⚠️ La WebView n'est chargée qu'ICI, à l'ouverture de la carte :
 * sous jest elle ne se charge pas (module non transformé), et 30 écrans montent le champ
 * d'adresse qui porte ce lien — un import en tête de fichier ferait tomber leurs suites.
 * @param {object} props
 * @param {number} [props.height]
 * @param {(region: { lat: number; lng: number; zoom?: number }) => void} [props.onRegionChangeComplete]
 * @param {{ lat: number, lng: number, zoom?: number } | null} [props.regionHint]
 * @returns {import('react').ReactElement}
 */
export const renderPinMap = ({ height = 360, onRegionChangeComplete, regionHint = null } = {}) => {
  // eslint-disable-next-line global-require
  const PinMapNative = require('./pinMapNative').default;
  return (
    <PinMapNative
      height={height}
      onRegionChangeComplete={onRegionChangeComplete}
      regionHint={regionHint}
    />
  );
};

/**
 * ADRESSE-CARTE (07/10) — la position SEULEMENT si elle est déjà accordée (jamais de demande).
 * ⚠️ Chargée à l'appel, pour la même raison que la WebView : sous jest, le module de position natif
 * lève dès qu'on l'importe (« doesn't seem to be linked »).
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export const readCurrentLocationIfGranted = () => {
  // eslint-disable-next-line global-require
  const { readCurrentSearchMapLocationIfGranted } = require('./searchMapGeolocation');
  return readCurrentSearchMapLocationIfGranted();
};

export default {
  openExternalMap,
  readCurrentLocationIfGranted,
  renderMap,
  renderPinMap,
};
