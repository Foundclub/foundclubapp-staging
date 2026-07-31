import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { AppProvider } from '@/store/appContext';
import { ThemeProvider } from '@/theme/themeContext';

import { AppFeedbackProvider } from '@/context/AppFeedbackContext';
import { AppModeProvider } from '@/context/AppModeContext';
import { BlockingOverlayProvider } from '@/context/BlockingOverlayContext';
import { ClubScopeProvider } from '@/context/ClubScopeContext';
import { PopupManagerProvider } from '@/context/PopupManagerContext';
import { SmartNotificationProvider } from '@/context/SmartNotificationContext';
import { StartupPhaseProvider } from '@/context/StartupPhaseContext';
import { TourProvider } from '@/context/TourContext';

/**
 * Shared provider stack used by native and web runtimes.
 * @param {object} props
 * @param {import('@tanstack/react-query').QueryClient} props.queryClient
 * @param {React.ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
function SharedAppProviders({ children, queryClient }) {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(
      AppProvider,
      null,
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          AppModeProvider,
          null,
          React.createElement(
            ClubScopeProvider,
            null,
            React.createElement(
              AppFeedbackProvider,
              null,
              React.createElement(
                StartupPhaseProvider,
                null,
                React.createElement(
                  PopupManagerProvider,
                  null,
                  React.createElement(
                    SmartNotificationProvider,
                    null,
                    React.createElement(
                      BlockingOverlayProvider,
                      null,
                      React.createElement(TourProvider, null, children),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export default SharedAppProviders;
