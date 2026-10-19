/* eslint-disable react/jsx-props-no-spreading */

/**
 * RESA-CARTE (20/10/2026) — LA CARTE DE RECHERCHE, CHARGÉE À L'OUVERTURE (téléphone).
 * `SearchMap` charge la WebView (TomTom) ou react-native-maps (Google) dès qu'on l'importe ;
 * jest ne transforme ni l'une ni l'autre. Importée en tête par la recherche de terrains (E-P01),
 * elle ferait tomber au chargement toutes les suites qui montent la recherche, même en vue Liste.
 * Elle n'est donc chargée qu'ici, au premier rendu de la vue Carte — comme `renderPinMap`
 * (platform/maps/maps.native.js).
 * Le site lit `LazySearchMap.web.js` (un `require` n'y existe pas).
 * @param {object} props - Les propriétés de `SearchMap`.
 * @returns {import('react').ReactElement} La carte.
 */
function LazySearchMap(props) {
  // eslint-disable-next-line global-require
  const SearchMap = require('@/components/organisms/searchMap/SearchMap').default;
  return <SearchMap {...props} />;
}

export default LazySearchMap;
