import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { AppModeProvider } from '@/context/AppModeContext';
import { BlockingOverlayProvider } from '@/context/BlockingOverlayContext';
import { SmartNotificationProvider } from '@/context/SmartNotificationContext';
import { AppProvider } from '@/store/appContext';
import { ThemeProvider } from '@/theme/themeContext';

/**
 * Shared provider stack used by native and web runtimes.
 * @param {object} props
 * @param {import('@tanstack/react-query').QueryClient} props.queryClient
 * @param {React.ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
function SharedAppProviders({ children, queryClient }) {
  return React.createElement(
    AppProvider,
    null,
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(
        AppModeProvider,
        null,
        React.createElement(
          SmartNotificationProvider,
          null,
          React.createElement(
            BlockingOverlayProvider,
            null,
            React.createElement(QueryClientProvider, { client: queryClient }, children),
          ),
        ),
      ),
    ),
  );
}

export default SharedAppProviders;
