/* eslint-disable import/no-unresolved -- react-dom n'est installé que dans le dépôt du site. */
import React from 'react';
import { createPortal } from 'react-dom';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import isGuideSupported from '@/domains/tour/guideSupport';

import SharedAppProviders from './AppProviders.shared';
import '@/navigation/gardienDesFleches';

// T3-GUIDE-SITE : chargée à part, le site éteint ne paie pas la couche du guide.
const TourGuideLayer = isGuideSupported()
  ? React.lazy(() => import('@/components/molecules/tour/TourGuideLayer'))
  : null;

// La couche se place en coordonnées de la fenêtre, comme les mesures des ancres. Portée dans `body`
// pour passer au-dessus des feuilles du site, elles aussi portées là, comme sur le téléphone.
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
      TourGuideLayer ? createPortal(
        React.createElement(
          View,
          { pointerEvents: 'box-none', style: /** @type {any} */ (GUIDE_LAYER_STYLE) },
          React.createElement(
            React.Suspense,
            { fallback: null },
            React.createElement(TourGuideLayer),
          ),
        ),
        document.body,
      ) : null,
    ),
  );
}

export default AppProvidersWeb;
