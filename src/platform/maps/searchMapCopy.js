const SCOPE_TITLES = Object.freeze({
  clubs: 'Carte des clubs',
  events: 'Carte des événements',
  reservations: 'Carte des réservations',
});

const SCOPE_SUBTITLES = Object.freeze({
  clubs: 'Recherche par adresse, filtres actifs et clubs visibles sur la carte.',
  events: 'Recherche par adresse, filtres actifs et événements visibles sur la carte.',
  reservations: 'Recherche par adresse, filtres actifs et réservations visibles sur la carte.',
});

export const SEARCH_MAP_ERROR_REASONS = Object.freeze({
  invalidApiKey: 'invalid_api_key',
  invalidTileRequest: 'invalid_tile_request',
  leafletUnavailable: 'leaflet_unavailable',
  missingApiKey: 'missing_api_key',
  networkError: 'network_error',
  providerUnavailable: 'provider_unavailable',
  rateLimited: 'rate_limited',
  runtimeError: 'runtime_error',
  tileError: 'tile_error',
  tilesUnavailable: 'tiles_unavailable',
  webViewError: 'webview_error',
  webViewProcessGone: 'webview_process_gone',
});

export const getSearchMapTitle = (scope) => SCOPE_TITLES[scope] || SCOPE_TITLES.events;

export const getSearchMapSubtitle = (scope) => (
  SCOPE_SUBTITLES[scope] || SCOPE_SUBTITLES.events
);

export const getSearchMapAddressHint = () => 'Ville, stade, gymnase ou adresse précise.';

export const getSearchMapActiveFiltersSummary = (filterCount, geolocatableCount) => {
  if (!filterCount) {
    return 'Aucun filtre supplémentaire actif';
  }

  return `${filterCount} filtre${filterCount > 1 ? 's' : ''} actif${
    filterCount > 1 ? 's' : ''
  } · ${geolocatableCount} affichable${geolocatableCount > 1 ? 's' : ''} sur la carte`;
};

export const getSearchMapLoadingCopy = () => ({
  body: 'Nous préparons l’affichage cartographique de vos résultats géolocalisés.',
  title: 'Chargement de la carte',
});

export const getSearchMapUpdatingResultsCopy = () => 'Mise à jour des résultats…';

export const getSearchMapSearchAreaLabel = (isLoading = false) => (
  isLoading ? 'Mise à jour…' : 'Rechercher dans cette zone'
);

export const getSearchMapProviderErrorMessage = (errorReason) => {
  switch (errorReason) {
    case SEARCH_MAP_ERROR_REASONS.invalidApiKey:
      return 'La clé TomTom utilisée par ce build n’est pas valide ou n’a pas accès à Map Display API.';
    case SEARCH_MAP_ERROR_REASONS.invalidTileRequest:
      return 'La requête envoyée au provider cartographique est invalide. Vérifiez la configuration TomTom.';
    case SEARCH_MAP_ERROR_REASONS.leafletUnavailable:
      return 'Le moteur cartographique n’a pas pu démarrer correctement dans ce build.';
    case SEARCH_MAP_ERROR_REASONS.missingApiKey:
      return 'La clé TomTom est manquante pour ce build. Ajoutez TOMTOM_API_KEY avant de tester la carte.';
    case SEARCH_MAP_ERROR_REASONS.networkError:
      return 'Le réseau de la carte est indisponible pour le moment. Vérifiez la connexion puis réessayez.';
    case SEARCH_MAP_ERROR_REASONS.providerUnavailable:
      return 'Le service cartographique TomTom est momentanément indisponible. Réessayez plus tard.';
    case SEARCH_MAP_ERROR_REASONS.rateLimited:
      return 'Le quota TomTom a été atteint pour le moment. Réessayez un peu plus tard.';
    case SEARCH_MAP_ERROR_REASONS.tilesUnavailable:
      return 'La carte a démarré, mais aucune tuile exploitable n’a pu être chargée. Réessayez ou revenez à la liste.';
    case SEARCH_MAP_ERROR_REASONS.webViewError:
      return 'Le moteur web de la carte a échoué au chargement. Fermez puis rouvrez la carte.';
    case SEARCH_MAP_ERROR_REASONS.webViewProcessGone:
      return 'Le moteur web de la carte a ete interrompu. Rechargez la carte ou revenez a la liste.';
    case SEARCH_MAP_ERROR_REASONS.runtimeError:
    case SEARCH_MAP_ERROR_REASONS.tileError:
    default:
      return 'Les tuiles TomTom ne répondent pas pour le moment. Réessayez ou revenez à la liste.';
  }
};

export default {
  getSearchMapActiveFiltersSummary,
  getSearchMapAddressHint,
  getSearchMapLoadingCopy,
  getSearchMapProviderErrorMessage,
  getSearchMapSearchAreaLabel,
  getSearchMapSubtitle,
  getSearchMapTitle,
  getSearchMapUpdatingResultsCopy,
  SEARCH_MAP_ERROR_REASONS,
};
