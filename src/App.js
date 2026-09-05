/* eslint-disable perfectionist/sort-imports */
import * as Sentry from '@sentry/react-native';
import { useEffect, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';

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
import { navigationRef } from '@/navigation/navigationService';

import { isInSentryExceptionsAllowList } from '@/services/sentryAllowList';

import {
  clearPersistedBootError,
  readPersistedBootError,
} from '@/utils/bootDiagnostics';
import { displayErrorAlert } from '@/utils/errors/displayError';

import AppErrorBoundary from '@/app/AppErrorBoundary';
import AppProvidersNative from '@/app/AppProviders.native';
import BootGate from '@/app/BootGate';
import LeaguePlatformGate from '@/app/LeaguePlatformGate';
import buildFoundClubQueryClient from '@/app/queryClient';
import { startQueryRefreshBridge } from '@/app/queryRefreshOnReturn';
import { getRuntimeEndpointsLog } from '@/config/runtimeUrls';
import { POPUP_IDS } from '@/constants/popupRegistry';
import { APP_RUNTIME_ENV, NOTIFICATIONS_RUNTIME_CONFIG } from '@/constants/runtimeFlags';
import useAuth from '@/domains/auth/useAuth';
import InvitationLinkHost from '@/domains/invitations/InvitationLinkHost';
import { emitGuidanceRouteVisit } from '@/domains/guidance/guidanceRuntime';
import { syncRevenueCatIdentity } from '@/domains/subscription/subscriptionRevenueCat';
import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '@/context/BlockingOverlayContext';
import ClubScopeToggle from '@/components/molecules/header/ClubScopeToggle';
import { usePopupEligibility } from '@/context/PopupManagerContext';
import { STARTUP_PHASES, useStartupPhase } from '@/context/StartupPhaseContext';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';
import { getWebBackgroundHostsDelayMs } from '@/utils/webRuntime';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatBootMeta, markBootStep } from '@/utils/performance/bootPerformance';

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
  // SENTRY1 — le garde `isAxiosError(...)` qui se trouvait ici rendait la liste
  // blanche INATTEIGNABLE. Les intercepteurs de reponse rejettent la charge
  // DEBALLEE `error.response.data.error` (client.native.js:88), donc une erreur
  // applicative Strapi n'a jamais `isAxiosError` : la condition etait toujours
  // fausse et TOUT partait, y compris les 401 qu'on croyait filtres depuis des
  // mois. Preuve : Sentry REACT-NATIVE-2 du 2026-09-05, « Object captured as
  // exception with keys: details, message, name, status ».
  captureQueryError: (/** @type {unknown} */ error, /** @type {any} */ query) => {
    if (isSentryEnabled && !isInSentryExceptionsAllowList(error, query)) {
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
  const { phase } = useStartupPhase();
  const popup = usePopupEligibility(
    POPUP_IDS.BOOT_ERROR_ALERT,
    Boolean(pendingBootError),
  );

  useEffect(() => {
    const previousBootError = readPersistedBootError();
    if (!previousBootError) return;
    if (APP_RUNTIME_ENV === 'production' && !previousBootError?.isFatal) {
      clearPersistedBootError();
      return;
    }

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
  const isVisible = popup.canShow
    && canShowBootError
    && phase === STARTUP_PHASES.STARTUP_PROMPT_WINDOW;
  useBlockingOverlayLifecycle(popup.descriptor.id, isVisible, {
    releaseDelayMs: 320,
  });

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
      inlineOnAndroid
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

// eslint-disable-next-line perfectionist/sort-modules
function AppShell() {
  const {
    markInteractionsSettled,
    markNavigationReady,
    notifyRouteChanged,
    phase,
  } = useStartupPhase();
  const isDeferredStartupReady = phase !== STARTUP_PHASES.BOOT_CORE
    && phase !== STARTUP_PHASES.NAV_READY
    && phase !== STARTUP_PHASES.ROUTE_STABLE;

  useEffect(() => {
    markBootStep('app_component_mounted');
  }, []);

  useEffect(() => {
    if (phase !== STARTUP_PHASES.ROUTE_STABLE) {
      return undefined;
    }

    markBootStep('navigation_ready');
    const task = InteractionManager.runAfterInteractions(() => {
      markBootStep('deferred_startup_tasks_ready');
      markInteractionsSettled();
    });

    return () => {
      task?.cancel?.();
    };
  }, [markInteractionsSettled, phase]);

  return (
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
          <LeaguePlatformGate>
            <AppNavigator
              navigationIntegration={navigationIntegration}
              onReady={() => {
                const routeName = navigationRef.getCurrentRoute()?.name || null;
                markNavigationReady(routeName);
              }}
              onStateChange={(routeName) => {
                notifyRouteChanged(routeName);
                emitGuidanceRouteVisit(routeName);
              }}
            />
            <ClubScopeSwitchHost />
            <InvitationLinkHost />
            {isDeferredStartupReady ? <DeferredStartupHosts /> : null}
          </LeaguePlatformGate>
        </BootGate>
      </StartupPromptBoundary>
    </AppErrorBoundary>
  );
}

function ClubScopeSwitchHost() {
  const insets = useSafeAreaInsets();

  return (
    <WebFloatingOverlay
      style={{
        alignItems: 'center',
        left: 0,
        right: 0,
        top: insets.top + 52,
        zIndex: 1300,
      }}
    >
      <ClubScopeToggle />
    </WebFloatingOverlay>
  );
}

function DeferredStartupHosts() {
  const { appBootstrapData, isBootstrapResolved, userData } = useAuth();
  const [allowBootstrapFallbackFetches, setAllowBootstrapFallbackFetches] = useState(false);
  const revenueCatUserDocumentId = String(userData?.documentId || '').trim();

  // Identité RevenueCat alignée sur la session (appUserID = documentId payeur,
  // requis par le webhook serveur). No-op tant que la clé SDK est absente.
  useEffect(() => {
    syncRevenueCatIdentity(revenueCatUserDocumentId).catch((error) => {
      console.warn('[SUBSCRIPTION] RevenueCat identity sync failed', error?.message || error);
    });
  }, [revenueCatUserDocumentId]);
  const shouldDeferHostFetchesOnWeb = Platform.OS === 'web';
  const bootstrapFallbackDelayMs = shouldDeferHostFetchesOnWeb
    ? getWebBackgroundHostsDelayMs()
    : 2500;

  useEffect(() => {
    if (isBootstrapResolved) {
      setAllowBootstrapFallbackFetches(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setAllowBootstrapFallbackFetches(true);
    }, bootstrapFallbackDelayMs);

    return () => clearTimeout(timeoutId);
  }, [bootstrapFallbackDelayMs, isBootstrapResolved]);

  const shouldSkipBootstrapBackedInitialFetch = shouldDeferHostFetchesOnWeb
    ? !allowBootstrapFallbackFetches
    : !isBootstrapResolved && !allowBootstrapFallbackFetches;

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
  // Y05 — LA DETECTION « L'APP EST REVENUE » N'EXISTAIT NULLE PART.
  // react-query l'attend d'un evenement de navigateur que le telephone n'emet
  // jamais : sans ce branchement, revenir dans FoundClub ne relisait RIEN, et il
  // fallait la fermer completement pour voir les demandes arriver.
  useEffect(() => startQueryRefreshBridge(queryClient), []);

  return (
    <AppProvidersNative queryClient={queryClient}>
      <AppShell />
    </AppProvidersNative>
  );
}

const RootApp = isSentryEnabled ? Sentry.wrap(App) : App;

export default RootApp;
