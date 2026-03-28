import * as Sentry from '@sentry/react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import SessionManager from '@/components/atoms/sessionManager/SessionManager';
import LeagueActionPromptHost from '@/components/organisms/league/LeagueActionPromptHost';
import MatchStatsPromptHost from '@/components/organisms/matchStats/MatchStatsPromptHost';
import NotificationBootstrap from '@/components/organisms/notifications/NotificationBootstrap';
import SmartNotificationHost from '@/components/organisms/notifications/SmartNotificationHost';
import ErrorScreen from '@/views/Error';

import AppNavigator from '@/navigation/appNavigator';

import { isInSentryExceptionsAllowList } from '@/services/sentryAllowList';

import {
  clearPersistedBootError,
  readPersistedBootError,
} from '@/utils/bootDiagnostics';
import { displayErrorAlert } from '@/utils/errors/displayError';

import AppProvidersNative from '@/app/AppProviders.native';
import buildFoundClubQueryClient from '@/app/queryClient';
import { useBlockingOverlayPrompt } from '@/context/BlockingOverlayContext';

const isAxiosError = (error) => Boolean(
  error
  && typeof error === 'object'
  && /** @type {{ isAxiosError?: unknown }} */ (error).isAxiosError === true,
);

/**
 * @param {unknown} rawValue
 * @param {number} fallbackValue
 * @returns {number}
 */
const parseSampleRate = (rawValue, fallbackValue) => {
  const parsed = Number.parseFloat(String(rawValue ?? ''));
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  if (parsed < 0 || parsed > 1) {
    return fallbackValue;
  }

  return parsed;
};

const appEnv = String(process.env.APP_ENV || process.env.ENV || '').trim().toLowerCase();
const isStaging = appEnv === 'staging';
const sentryDsn = process.env.SENTRY_DSN;
const isSentryEnabled = Boolean(sentryDsn);
const sentryTracesSampleRate = parseSampleRate(
  process.env.SENTRY_TRACES_SAMPLE_RATE,
  __DEV__ || isStaging ? 1 : 0.2,
);
const navigationIntegration = /** @type {any} */ (isSentryEnabled
  ? Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
  })
  : {
    name: 'noop-navigation-integration',
    registerNavigationContainer: () => {},
    setupOnce: () => {},
  });

console.info('[BOOT] APP_ENV_RESOLVED', {
  appEnv,
  isSentryEnabled,
  isStaging,
  sentryTracesSampleRate,
});

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
    tracesSampleRate: sentryTracesSampleRate,
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

const queryClient = buildFoundClubQueryClient({
  captureQueryError: (/** @type {unknown} */ error) => {
    const typedError = /** @type {any} */ (error);
    const shouldSkip = isAxiosError(typedError) && isInSentryExceptionsAllowList(typedError);
    if (isSentryEnabled && !shouldSkip) {
      Sentry.captureException(error);
    }
  },
  onMutationError: (
    /** @type {unknown} */ error,
    /** @type {string | undefined} */ fallbackMessage,
  ) => {
    displayErrorAlert(error, fallbackMessage);
  },
});

/**
 * App root component.
 * @returns {null}
 */
function BootErrorAlertHost() {
  const [pendingBootError, setPendingBootError] = useState(null);
  const shownBootErrorKeyRef = useRef('');

  useEffect(() => {
    const previousBootError = readPersistedBootError();
    if (!previousBootError) return;

    console.warn('[BOOT] BOOT_PREVIOUS_JS_ERROR_VISIBLE', previousBootError);
    setPendingBootError(previousBootError);
  }, []);

  const bootErrorPromptKey = [
    pendingBootError?.context,
    pendingBootError?.name,
    pendingBootError?.message,
  ].filter(Boolean).join(':');
  const canShowBootError = useBlockingOverlayPrompt(
    'boot-error-alert',
    Boolean(pendingBootError),
    100,
  );

  useEffect(() => {
    if (!pendingBootError || !canShowBootError) return;
    if (shownBootErrorKeyRef.current === bootErrorPromptKey) return;
    shownBootErrorKeyRef.current = bootErrorPromptKey;

    const summary = [
      pendingBootError.context,
      pendingBootError.name,
      pendingBootError.message,
    ].filter(Boolean).join('\n');

    let dismissed = false;
    const finalize = () => {
      if (dismissed) return;
      dismissed = true;
      shownBootErrorKeyRef.current = '';
      clearPersistedBootError();
      setPendingBootError(null);
    };

    Alert.alert(
      'Crash precedent detecte',
      summary.slice(0, 500),
      [{ onPress: finalize, text: 'OK' }],
      {
        cancelable: true,
        onDismiss: finalize,
      },
    );
  }, [bootErrorPromptKey, canShowBootError, pendingBootError]);

  return null;
}

/**
 * App root component.
 * @returns {import('react').ReactElement} App root component.
 */
function App() {
  return (
    <AppProvidersNative queryClient={queryClient}>
      <BootErrorAlertHost />
      <SessionManager />
      {isSentryEnabled ? (
        <Sentry.ErrorBoundary fallback={<ErrorScreen />} showDialog>
          <AppNavigator navigationIntegration={navigationIntegration} />
          <MatchStatsPromptHost />
          <LeagueActionPromptHost />
          <NotificationBootstrap />
          <SmartNotificationHost />
        </Sentry.ErrorBoundary>
      ) : (
        <>
          <AppNavigator navigationIntegration={navigationIntegration} />
          <MatchStatsPromptHost />
          <LeagueActionPromptHost />
          <NotificationBootstrap />
          <SmartNotificationHost />
        </>
      )}
    </AppProvidersNative>
  );
}

const RootApp = isSentryEnabled ? Sentry.wrap(App) : App;

export default RootApp;
