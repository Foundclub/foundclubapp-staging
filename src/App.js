/* eslint-disable perfectionist/sort-imports */
import * as Sentry from '@sentry/react-native';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

import SessionManager from '@/components/atoms/sessionManager/SessionManager';
import LeagueActionPromptHost from '@/components/organisms/league/LeagueActionPromptHost';
import MatchStatsPromptHost from '@/components/organisms/matchStats/MatchStatsPromptHost';
import NotificationBootstrap from '@/components/organisms/notifications/NotificationBootstrap';
import SmartNotificationHost from '@/components/organisms/notifications/SmartNotificationHost';
import AppBannerHost from '@/components/organisms/popup/AppBannerHost';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';
import RemotePopupCampaignHost from '@/components/organisms/popup/RemotePopupCampaignHost';
import StartupPromptBoundary from '@/components/organisms/popup/StartupPromptBoundary';
import ErrorScreen from '@/views/Error';

import AppNavigator from '@/navigation/appNavigator';

import { isInSentryExceptionsAllowList } from '@/services/sentryAllowList';

import {
  clearPersistedBootError,
  readPersistedBootError,
} from '@/utils/bootDiagnostics';
import { displayErrorAlert } from '@/utils/errors/displayError';

import AppErrorBoundary from '@/app/AppErrorBoundary';
import AppProvidersNative from '@/app/AppProviders.native';
import BootGate from '@/app/BootGate';
import buildFoundClubQueryClient from '@/app/queryClient';
import { getRuntimeEndpointsLog } from '@/config/runtimeUrls';
import { POPUP_IDS } from '@/constants/popupRegistry';
import { NOTIFICATIONS_RUNTIME_CONFIG } from '@/constants/runtimeFlags';
import useAuth from '@/domains/auth/useAuth';
import { useBlockingOverlayPrompt } from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';

import { formatBootMeta, markBootStep } from '@/utils/performance/bootPerformance';

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
let defaultSentryTracesSampleRate = 0.2;
if (__DEV__) {
  defaultSentryTracesSampleRate = 0;
} else if (isStaging) {
  defaultSentryTracesSampleRate = 0.05;
}
const sentryTracesSampleRate = parseSampleRate(
  process.env.SENTRY_TRACES_SAMPLE_RATE,
  defaultSentryTracesSampleRate,
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

console.info(`[BOOT] APP_ENV_RESOLVED ${formatBootMeta({
  appEnv,
  isSentryEnabled,
  isStaging,
  notificationsRuntime: NOTIFICATIONS_RUNTIME_CONFIG,
  runtimeEndpoints: getRuntimeEndpointsLog(),
  sentryTracesSampleRate,
})}`);
markBootStep('app_module_loaded', {
  appEnv,
  isStaging,
  sentryEnabled: isSentryEnabled,
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
  const isReactotronEnabled = String(process.env.ENABLE_REACTOTRON || '').trim().toLowerCase() === 'true';
  if (isReactotronEnabled) {
    // eslint-disable-next-line global-require
    require('../ReactotronConfig');
  }
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
  const popup = usePopupEligibility(
    POPUP_IDS.BOOT_ERROR_ALERT,
    Boolean(pendingBootError),
  );

  useEffect(() => {
    const previousBootError = readPersistedBootError();
    if (!previousBootError) return;

    console.warn(`[BOOT] BOOT_PREVIOUS_JS_ERROR_VISIBLE ${formatBootMeta(previousBootError)}`);
    setPendingBootError(previousBootError);
  }, []);

  const bootErrorPromptKey = [
    pendingBootError?.context,
    pendingBootError?.name,
    pendingBootError?.message,
  ].filter(Boolean).join(':');
  const canShowBootError = useBlockingOverlayPrompt(
    popup.descriptor.id,
    popup.canShow,
    popup.descriptor.priority,
  );
  const isVisible = popup.canShow && canShowBootError;

  useEffect(() => {
    if (!pendingBootError || !isVisible || !bootErrorPromptKey) return;
    popup.markShown({ bootErrorPromptKey });
  }, [bootErrorPromptKey, isVisible, pendingBootError, popup]);

  const summary = [
    pendingBootError?.context,
    pendingBootError?.name,
    pendingBootError?.message,
  ].filter(Boolean).join('\n');

  const finalize = () => {
    popup.dismiss();
    clearPersistedBootError();
    setPendingBootError(null);
  };

  return (
    <GlobalPromptModal
      body={summary.slice(0, 500)}
      eyebrow="Crash précédent"
      onRequestClose={finalize}
      primaryAction={{
        label: 'OK',
        onPress: finalize,
      }}
      title="FoundClub a détecté un crash précédent"
      tone="critical"
      visible={Boolean(summary && isVisible)}
    />
  );
}

function DeferredStartupHosts() {
  const { appBootstrapData, isBootstrapResolved } = useAuth();
  const [allowBootstrapFallbackFetches, setAllowBootstrapFallbackFetches] = useState(false);

  useEffect(() => {
    if (isBootstrapResolved) {
      setAllowBootstrapFallbackFetches(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setAllowBootstrapFallbackFetches(true);
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [isBootstrapResolved]);

  const shouldSkipBootstrapBackedInitialFetch = !isBootstrapResolved && !allowBootstrapFallbackFetches;

  return (
    <>
      <RemotePopupCampaignHost
        hasResolvedInitialCampaign={isBootstrapResolved}
        initialCampaign={appBootstrapData?.activeRemotePopupCampaign || null}
        skipInitialFetch={shouldSkipBootstrapBackedInitialFetch}
      />
      <MatchStatsPromptHost skipInitialFetch={shouldSkipBootstrapBackedInitialFetch} />
      <LeagueActionPromptHost skipInitialFetch={shouldSkipBootstrapBackedInitialFetch} />
      <NotificationBootstrap />
      <SmartNotificationHost />
    </>
  );
}

/**
 * App root component.
 * @returns {import('react').ReactElement} App root component.
 */
function App() {
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [isDeferredStartupReady, setIsDeferredStartupReady] = useState(false);

  useEffect(() => {
    markBootStep('app_component_mounted');
  }, []);

  useEffect(() => {
    if (!isNavigationReady) {
      setIsDeferredStartupReady(false);
      return undefined;
    }

    markBootStep('navigation_ready');
    const task = InteractionManager.runAfterInteractions(() => {
      markBootStep('deferred_startup_tasks_ready');
      setIsDeferredStartupReady(true);
    });

    return () => {
      task?.cancel?.();
    };
  }, [isNavigationReady]);

  return (
    <AppProvidersNative queryClient={queryClient}>
      <AppErrorBoundary
        fallback={<ErrorScreen />}
        onError={(error) => {
          if (isSentryEnabled) {
            Sentry.captureException(error);
          }
        }}
      >
        <StartupPromptBoundary>
          <BootGate>
            <BootErrorAlertHost />
            <SessionManager />
            <AppBannerHost />
            <AppNavigator
              navigationIntegration={navigationIntegration}
              onReady={() => setIsNavigationReady(true)}
            />
            {isDeferredStartupReady ? <DeferredStartupHosts /> : null}
          </BootGate>
        </StartupPromptBoundary>
      </AppErrorBoundary>
    </AppProvidersNative>
  );
}

const RootApp = isSentryEnabled ? Sentry.wrap(App) : App;

export default RootApp;
