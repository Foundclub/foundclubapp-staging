import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GUIDE_SUR_LE_SITE } from '@/config/fonctionsMasquees';

import SharedAppProviders from './AppProviders.shared';
import '@/navigation/gardienDesFleches';

// T3-GUIDE-SITE : chargée à part, le site éteint ne paie pas la couche du guide.
const TourGuideLayer = GUIDE_SUR_LE_SITE
  ? React.lazy(() => import('@/components/molecules/tour/TourGuideLayer'))
  : null;

// La couche se place en coordonnées de la fenêtre, comme les mesures des ancres. Au-dessus des
// feuilles et des fenêtres du site, comme sur le téléphone.
const GUIDE_LAYER_STYLE = {
  bottom: 0, left: 0, position: 'fixed', right: 0, top: 0, zIndex: 100000,
};

/**
 * Web runtime provider stack.
 * @param {object} props
 * @param {import('@tanstack/react-query').QueryClient} props.queryClient
 * @param {React.ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
function AppProvidersWeb({ children, queryClient }) {
  return React.createElement(
    SafeAreaProvider,
    null,
    React.createElement(
      /** @type {any} */ (SharedAppProviders),
      { queryClient },
      children,
      TourGuideLayer ? React.createElement(
        View,
        { pointerEvents: 'box-none', style: /** @type {any} */ (GUIDE_LAYER_STYLE) },
        React.createElement(
          React.Suspense,
          { fallback: null },
          React.createElement(TourGuideLayer),
        ),
      ) : null,
    ),
  );
}

export default AppProvidersWeb;
