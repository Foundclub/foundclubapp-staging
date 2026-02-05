import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import {
  MutationCache, QueryCache, QueryClient, QueryClientProvider,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider } from '@/store/appContext';
import { ThemeProvider } from '@/theme/themeContext';
import { AppModeProvider } from '@/context/AppModeContext';

import ErrorScreen from '@/views/Error';

import AppNavigator from '@/navigation/appNavigator';
import SessionManager from '@/components/atoms/sessionManager/SessionManager';

import { isInSentryExceptionsAllowList } from '@/services/sentryAllowList';

import { displayErrorAlert } from '@/utils/errors/displayError';

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Désactiver Sentry en staging ou utiliser un projet Sentry séparé
const isStaging = process.env.ENV === 'staging';

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    attachStacktrace: true,
    beforeSend: (event) => {
      // Don't send events in development mode or staging if desired
      if (__DEV__ || isStaging) {
        return null;
      }
      return event;
    },
    debug: __DEV__,
    dsn: sentryDsn,
    enableAutoSessionTracking: true,
    enableUserInteractionTracing: true,
    tracesSampleRate: 1.0,
    // Add integration for better React Navigation tracking
    integrations: [navigationIntegration],
  });
}

// Désactiver Analytics/Crashlytics en staging
// Note: Installer les packages si nécessaire: npm install @react-native-firebase/analytics @react-native-firebase/crashlytics
// if (isStaging) {
//   import analytics from '@react-native-firebase/analytics';
//   import crashlytics from '@react-native-firebase/crashlytics';
//   analytics().setAnalyticsCollectionEnabled(false);
//   crashlytics().setCrashlyticsCollectionEnabled(false);
// }

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
    onError: (error) => {
      // Capture exceptions to Sentry unless in allow list
      const shouldSkip = isAxiosError(error) && isInSentryExceptionsAllowList(error);
      if (!shouldSkip) {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ThemeProvider>
            <AppModeProvider>
                <QueryClientProvider client={queryClient}>
                  <BottomSheetModalProvider>
                    <SessionManager />
                    <Sentry.ErrorBoundary fallback={<ErrorScreen />} showDialog>
                      <AppNavigator navigationIntegration={navigationIntegration} />
                    </Sentry.ErrorBoundary>
                  </BottomSheetModalProvider>
                </QueryClientProvider>
            </AppModeProvider>
          </ThemeProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
