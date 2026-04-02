/* eslint-disable react/jsx-props-no-spreading */
import LegacySearchMapNative from '@/components/organisms/searchMap/LegacySearchMapNative';
import TomTomSearchMapNative from '@/components/organisms/searchMap/TomTomSearchMapNative';

import {
  getSearchMapProvider,
  SEARCH_MAP_PROVIDERS,
} from '@/platform/maps/searchMapProvider';

/**
 * Search map renderer for native platforms.
 * Keeps the legacy Google implementation behind a rollout flag while
 * defaulting to the TomTom WebView runtime when configured.
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
function SearchMap(props) {
  if (getSearchMapProvider() === SEARCH_MAP_PROVIDERS.tomtom) {
    return <TomTomSearchMapNative {...props} />;
  }

  return <LegacySearchMapNative {...props} />;
}

export default SearchMap;
