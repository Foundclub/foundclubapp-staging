import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SharedAppProviders from './AppProviders.shared';

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
    React.createElement(/** @type {any} */ (SharedAppProviders), { children, queryClient }),
  );
}

export default AppProvidersWeb;
