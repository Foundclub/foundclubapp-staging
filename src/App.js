import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Sentry from '@sentry/react-native';
import {
  MutationCache, QueryCache, QueryClient, QueryClientProvider,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios/dist/browser/axios.cjs';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '@/store/appContext';
import { ThemeProvider } from '@/theme/themeContext';

import SessionManager from '@/components/atoms/sessionManager/SessionManager';
import NotificationBootstrap from '@/components/organisms/notifications/NotificationBootstrap';
import SmartNotificationHost from '@/components/organisms/notifications/SmartNotificationHost';
import ErrorScreen from '@/views/Error';

import AppNavigator from '@/navigation/appNavigator';

import { isInSentryExceptionsAllowList } from '@/services/sentryAllowList';

import {
  clearPersistedBootError,
  readPersistedBootError,
} from '@/utils/bootDiagnostics';
import { lockToPortrait } from '@/utils/device/orientation';
import { displayErrorAlert } from '@/utils/errors/displayError';

import { AppModeProvider } from '@/context/AppModeContext';
import { SmartNotificationProvider } from '@/context/SmartNotificationContext';

const appEnv = String(process.env.APP_ENV || process.env.ENV || '').trim().toLowerCase();
const isStaging = appEnv === 'staging';
const sentryDsn = process.env.SENTRY_DSN;
const isSentryEnabled = Boolean(sentryDsn);
const navigationIntegration = isSentryEnabled
  ? Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
  })
  : { registerNavigationContainer: () => {} };

console.info('[BOOT] APP_ENV_RESOLVED', { appEnv, isSentryEnabled, isStaging });

// Désactiver Sentry en staging ou utiliser un projet Sentry séparé
if (isSentryEnabled) {
  Sentry.init({
    attachStacktrace: true,
    beforeSend: (event) => {
      // Keep crash signals in staging to debug launch issues.
      if (__DEV__) {
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
      if (isSentryEnabled && !shouldSkip) {
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
  useEffect(() => {
    lockToPortrait();
  }, []);

  useEffect(() => {
    const previousBootError = readPersistedBootError();
    if (!previousBootError) return;

    console.warn('[BOOT] BOOT_PREVIOUS_JS_ERROR_VISIBLE', previousBootError);

    const summary = [
      previousBootError.context,
      previousBootError.name,
      previousBootError.message,
    ].filter(Boolean).join('\n');

    Alert.alert(
      'Crash precedent détecté',
      summary.slice(0, 500),
    );
    clearPersistedBootError();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ThemeProvider>
            <AppModeProvider>
              <SmartNotificationProvider>
                <QueryClientProvider client={queryClient}>
                  <BottomSheetModalProvider>
                    <SessionManager />
                    {isSentryEnabled ? (
                      <Sentry.ErrorBoundary fallback={<ErrorScreen />} showDialog>
                        <AppNavigator navigationIntegration={navigationIntegration} />
                        <NotificationBootstrap />
                        <SmartNotificationHost />
                      </Sentry.ErrorBoundary>
                    ) : (
                      <>
                        <AppNavigator navigationIntegration={navigationIntegration} />
                        <NotificationBootstrap />
                        <SmartNotificationHost />
                      </>
                    )}
                  </BottomSheetModalProvider>
                </QueryClientProvider>
              </SmartNotificationProvider>
            </AppModeProvider>
          </ThemeProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const RootApp = isSentryEnabled ? Sentry.wrap(App) : App;

export default RootApp;
