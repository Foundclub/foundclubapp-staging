import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Sentry from '@sentry/react-native';
import {
  MutationCache, QueryCache, QueryClient, QueryClientProvider,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider } from '@/store/appContext';
import { ThemeProvider } from '@/theme/themeContext';

import ErrorScreen from '@/views/Error';

import AppNavigator from '@/navigation/appNavigator';

import { isInSentryExceptionsAllowList } from '@/services/sentryAllowList';

import { displayErrorAlert } from '@/utils/errors/displayError';

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Sentry.init({
//   attachStacktrace: true,
//   beforeSend: (event) => {
//     // Don't send events in development mode
//     if (__DEV__) {
//       return null;
//     }
//     return event;
//   },
//   debug: __DEV__,
//   dsn: process.env.SENTRY_DSN,
//   enableAutoSessionTracking: true,
//   enableUserInteractionTracing: true,
//   replaysOnErrorSampleRate: 1.0,
//   replaysSessionSampleRate: 0.1,
//   tracesSampleRate: 1.0,
//   // Add integration for better React Navigation tracking
//   integrations: [navigationIntegration],
// });

// Reactotron configuration to debug app
if (__DEV__) {
  // eslint-disable-next-line global-require
  require('../ReactotronConfig');
}

// create react query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
  mutationCache: new MutationCache({
    onError:
    (error, variables, context, mutation) => {
      if (!mutation?.options?.meta?.preventToastError) {
        // Handle error and show Alert
        displayErrorAlert(
          error,
          mutation?.options?.meta?.errorMessageFallback?.toString(),
        );
      }
      // if (isAxiosError(error) && !isInSentryExceptionsAllowList(error)) {
      //   Sentry.captureException(error);
      // } else {
      //   Sentry.captureException(error);
      // }
    },
  }),

  queryCache: new QueryCache({
    onError:
    (error) => {
      if (isAxiosError(error) && !isInSentryExceptionsAllowList(error)) {
        Sentry.captureException(error);
      } else {
        Sentry.captureException(error);
      }
    },
  }),

});

/**
 * App root component.
 * @returns {import('react').ReactElement} App root component.
 */
function App() {
  return (
    <GestureHandlerRootView>
      <AppProvider>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <QueryClientProvider client={queryClient}>
              <Sentry.ErrorBoundary fallback={<ErrorScreen />} showDialog>
                <AppNavigator navigationIntegration={navigationIntegration} />
              </Sentry.ErrorBoundary>
            </QueryClientProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
