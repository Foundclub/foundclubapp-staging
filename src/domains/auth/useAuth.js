/* eslint-disable import/order, perfectionist/sort-imports */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  InteractionManager,
  Linking,
  Platform,
} from 'react-native';

import { storage, useAppContext } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';
import SharePlatform from '@/platform/share';

import {
  deleteDeviceToken,
  getMe, login, logout, signInWithPhoneNumber,
} from '@/services/auth/authService';
import {
  getRetryAfterSeconds,
  resetBootRequestGuard,
} from '@/services/bootRequestGuard';
import { getAppBootstrap } from '@/services/bootstrap/bootstrapService';

import { displayErrorAlert } from '@/utils/errors/displayError';
import { createLogger } from '@/utils/logger/logger';
import { markBootStep } from '@/utils/performance/bootPerformance';
import {
  buildInstallLandingUrl,
  buildShareMessageWithUrl,
} from '@/utils/shareLinks';
import {
  getWebFullUserFetchDelayMs,
  isAppBootstrapDisabledOnWeb,
} from '@/utils/webRuntime';
import {
  getSanitizedUserSignature,
  haveSameSanitizedUser,
  sanitizeUser,
} from '@/domains/auth/authSanitizer';
import { getSubscriptionAccessLevel } from '@/domains/subscription/subscriptionDecision';
import {
  canUserEditClub,
  formatBirthdateToDisplay,
  formatBirthdateToSend,
  getActiveClubId,
  getAuthTokens,
  getClubIds,
  getOnboardingViews,
  getUserRoleKey,
  hasClubAccess as hasClubAccessForUser,
  profileFieldToDisplay,
  resolveOnboardingExitRoute,
  USER_ROLES,
} from './authUseCases';

import { useAppMode } from '@/context/AppModeContext';
import { UNREAD_COUNT_QUERY_KEY } from '@/hooks/useNotificationController';
/* eslint-enable import/order, perfectionist/sort-imports */

const authLogger = createLogger('auth');
/** @type {string | null} */
let lastBootstrapErrorLogKey = null;
/** @type {string | null} */
let lastBootstrapLoadedLogKey = null;
/** @type {string | null} */
let lastBootstrapRequestLogKey = null;
/** @type {string | null} */
let lastBootstrapSyncedKey = null;
/** @type {string | null} */
let lastFullUserSyncedKey = null;

const getBootstrapErrorStatus = (/** @type {any} */ error) => {
  const parsedStatus = Number(error?.status || error?.response?.status || error?.error?.status);
  return Number.isFinite(parsedStatus) ? parsedStatus : null;
};

const getBootstrapErrorMessage = (/** @type {any} */ error) => String(
  error?.response?.data?.error?.message
  || error?.response?.data?.message
  || error?.details?.message
  || error?.message
  || error
  || 'unknown',
).trim();

const getBootstrapSessionKey = (/** @type {any} */ auth) => String(
  auth?.user?.documentId
  || auth?.user?.id
  || auth?.token
  || 'no-session',
);

// Politique de retentative des requêtes de démarrage (bootstrap + get-me) :
// nombre borné, délai exponentiel plafonné, retryAfterSeconds serveur respecté.
// Le débit reste de toute façon plafonné par le garde anti-rafale du client
// HTTP (bootRequestGuard) quel que soit le déclencheur des refetchs.
const BOOT_QUERY_MAX_RETRIES = 2;

const isRetryableBootStatus = (/** @type {number | null} */ status) => (
  status === null
  || status === 0
  || status === 408
  || status === 425
  || status === 429
  || status >= 500
);

const shouldRetryBootQuery = (/** @type {number} */ failureCount, /** @type {any} */ error) => (
  failureCount < BOOT_QUERY_MAX_RETRIES
  && isRetryableBootStatus(getBootstrapErrorStatus(error))
);

const getBootRetryDelayMs = (/** @type {number} */ attemptIndex, /** @type {any} */ error) => {
  const backoffMs = Math.min(1000 * 2 ** attemptIndex, 30000);
  const serverMs = Math.min(getRetryAfterSeconds(error) * 1000, 300000);
  return Math.max(backoffMs, serverMs);
};

/**
 * Custom hook to manage authentication
 * @inheritdoc
 */
const useAuth = () => {
  // local state
  const [confirm, setConfirm] = useState(/**
     @type {import('@react-native-firebase/auth')
    .FirebaseAuthTypes.ConfirmationResult | undefined} */(undefined),
  );
  const [isFullUserFetchReady, setIsFullUserFetchReady] = useState(false);

  // hooks
  const [appState, appDispatch] = /** @type {any} */ (useAppContext());
  const { isGold } = useAppMode();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // api calls
  const otpMutation = useMutation({
    mutationFn: signInWithPhoneNumber,
    onError: (/** @type {any} */ error) => {
      displayErrorAlert(error, 'OTP_ERROR');
    },
    onSuccess: (/** @type {any} */ data) => {
      setConfirm(data);
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onError: (/** @type {any} */ error) => {
      displayErrorAlert(error, 'OTP_ERROR');
    },
    onSuccess: async (/** @type {any} */ data) => {
      authLogger.debug('Login mutation succeeded', { userDocumentId: data?.user?.documentId });
      // Ensure OTP confirmation state cannot leak to another account flow
      setConfirm(undefined);
      queryClient.clear();
      appDispatch({
        payload: data,
        type: 'SET_AUTHENTICATION',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async (/** @type {string} */token) => {
      try {
        if (token) {
          await deleteDeviceToken(token);
        }
      } catch (error) {
        const requestError = /** @type {any} */ (error);
        authLogger.warn('Failed to delete device token on logout', requestError?.message || requestError);
      } finally {
        appDispatch({ payload: undefined, type: 'SET_FCM_TOKEN' });
      }

      await logout();
    },
    onSuccess: () => {
      queryClient.clear();
      // Clear all read message data
      const allKeys = storage.getAllKeys();
      allKeys.forEach((/** @type {string} */ key) => {
        if (key.startsWith('chat_')) {
          storage.delete(key);
        }
      });
      appDispatch({ type: 'LOGOUT_CURRENT_SESSION' });
    },
  });

  const { auth, authSessions, isAddingAccount } = /** @type {any} */ (useAppContext()[0]);
  const disableAppBootstrap = Platform.OS === 'web' && isAppBootstrapDisabledOnWeb();

  const switchAccount = useCallback(async (/** @type {any} */ session) => {
    authLogger.debug('Switching account', { userDocumentId: session?.user?.documentId || session?.user?.id });
    setConfirm(undefined);
    queryClient.clear();

    // Switch app session immediately so UI reacts on first tap.
    appDispatch({
      payload: session?.user?.documentId || session,
      type: 'SET_ACTIVE_SESSION',
    });

    // NOTE: We intentionally skip Firebase re-auth here.
    // session.idToken is a Firebase ID token, not a custom token accepted by signInWithCustomToken.
    authLogger.debug('Skipped Firebase re-auth on account switch (requires backend custom token flow)');
  }, [appDispatch, queryClient]);

  const addAccount = useCallback(async () => {
    authLogger.debug('Preparing add-account flow');
    setConfirm(undefined);
    appDispatch({
      type: 'PREPARE_ADD_ACCOUNT',
    });
    queryClient.clear();

    // Sign out from Firebase SDK to ensure a clean slate for the new account
    // This does NOT remove the saved app session from authSessions.
    await logout().catch((/** @type {any} */ error) => {
      authLogger.warn(
        'Logout failed before add-account flow',
        error?.message || 'Unknown error',
      );
    });
  }, [appDispatch, queryClient]);

  const {
    data: bootstrapData,
    error: bootstrapError,
    isLoading: isBootstrapLoading,
  } = useQuery({
    enabled: Boolean(auth?.token) && !isAddingAccount && !disableAppBootstrap,
    placeholderData: auth?.user ? { userSummary: auth.user } : undefined,
    queryFn: getAppBootstrap,
    queryKey: ['app-bootstrap', auth?.token || 'no-token'],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: shouldRetryBootQuery,
    retryDelay: getBootRetryDelayMs,
    // Un remontage d'observateur sur une query en erreur ne doit PAS relancer
    // la requête (c'est le vecteur de la rafale mesurée le 20/07 au boot).
    retryOnMount: false,
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    if (disableAppBootstrap) {
      return;
    }

    if (auth?.token && !isAddingAccount) {
      const requestLogKey = getBootstrapSessionKey(auth);
      if (lastBootstrapRequestLogKey === requestLogKey) {
        return;
      }
      lastBootstrapRequestLogKey = requestLogKey;
      markBootStep('bootstrap_requested');
    }
  }, [auth, auth?.token, disableAppBootstrap, isAddingAccount]);

  useEffect(() => {
    if (!bootstrapError) {
      return;
    }

    const status = getBootstrapErrorStatus(bootstrapError);
    const message = getBootstrapErrorMessage(bootstrapError);
    const errorLogKey = `${getBootstrapSessionKey(auth)}:${status || 'no-status'}:${message}`;
    if (lastBootstrapErrorLogKey === errorLogKey) {
      return;
    }
    lastBootstrapErrorLogKey = errorLogKey;

    authLogger.warn('Bootstrap request failed', {
      message,
      status,
    });
    markBootStep('bootstrap_failed', {
      message,
      ...(status ? { status } : {}),
    });
  }, [auth, bootstrapError]);

  useEffect(() => {
    if (!auth?.token || isAddingAccount) {
      setIsFullUserFetchReady(false);
      return undefined;
    }

    let isCancelled = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;
    const fullUserFetchDelayMs = Platform.OS === 'web'
      ? getWebFullUserFetchDelayMs()
      : 350;
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          setIsFullUserFetchReady(true);
        }
      }, fullUserFetchDelayMs);
    });

    return () => {
      isCancelled = true;
      task?.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [auth?.token, isAddingAccount]);

  const shouldEnableFullUserFetch = Boolean(auth?.token)
    && !isAddingAccount
    && isFullUserFetchReady
    && (
      disableAppBootstrap
      || Boolean(bootstrapError)
      || !bootstrapData?.userSummary?.documentId
    );

  const {
    data: fullUserData,
    error: fullUserDataError,
    isLoading: isFullUserDataLoading,
    refetch: refetchUserData,
  } = useQuery({
    enabled: shouldEnableFullUserFetch,
    queryFn: getMe,
    // Scope by current token to avoid cross-account stale cache reuse
    queryKey: ['get-me', auth?.token || 'no-token'],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: shouldRetryBootQuery,
    retryDelay: getBootRetryDelayMs,
    retryOnMount: false,
    staleTime: 1000 * 60 * 5,
  });

  const userData = useMemo(() => (
    fullUserData || bootstrapData?.userSummary || auth?.user
  ), [auth?.user, bootstrapData?.userSummary, fullUserData]);

  const userDataLoading = Boolean(auth?.token)
    && !isAddingAccount
    && !userData
    && (isBootstrapLoading || isFullUserDataLoading);
  const userDataError = userData ? null : (bootstrapError || fullUserDataError);

  // Sync user data to global state/sessions when it changes (e.g. after edit)
  // This ensures the account switcher displays the correct info
  // NOTE: User data is stored at state.auth.user, NOT state.userData
  const currentContextUserData = appState.auth?.user;

  useEffect(() => {
    if (!bootstrapData?.userSummary?.documentId) {
      return;
    }

    const sanitizedUserData = sanitizeUser(bootstrapData.userSummary);
    const bootstrapSyncKey = `${String(auth?.token || 'no-token')}:${getSanitizedUserSignature(sanitizedUserData)}`;
    if (haveSameSanitizedUser(sanitizedUserData, currentContextUserData)) {
      if (lastBootstrapSyncedKey === bootstrapSyncKey) {
        return;
      }
      lastBootstrapSyncedKey = bootstrapSyncKey;
      return;
    }
    if (lastBootstrapSyncedKey === bootstrapSyncKey) {
      return;
    }

    authLogger.debug('Bootstrap user summary synced', {
      userDocumentId: sanitizedUserData?.documentId,
    });
    lastBootstrapSyncedKey = bootstrapSyncKey;
    appDispatch({
      payload: bootstrapData.userSummary,
      type: 'UPDATE_USER_DATA',
    });
  }, [appDispatch, auth?.token, bootstrapData?.userSummary, currentContextUserData]);

  useEffect(() => {
    if (!bootstrapData?.serverTime) {
      return;
    }

    const loadedLogKey = `${getBootstrapSessionKey(auth)}:${bootstrapData.serverTime}`;
    if (lastBootstrapLoadedLogKey !== loadedLogKey) {
      lastBootstrapLoadedLogKey = loadedLogKey;
      markBootStep('bootstrap_loaded', {
        hasLeagueAction: Boolean(bootstrapData?.pendingLeagueActionSummary),
        hasMatchStatsPrompt: Boolean(bootstrapData?.pendingMatchStatsSummary?.nextPrompt),
        hasRemotePopup: Boolean(bootstrapData?.activeRemotePopupCampaign?.documentId),
      });
    }

    if (Number.isFinite(Number(bootstrapData?.unreadNotificationsCount))) {
      queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, {
        count: Number(bootstrapData.unreadNotificationsCount || 0),
      });
    }

    queryClient.setQueryData(['pendingLeagueAction', 'auto'], {
      nextAction: bootstrapData?.pendingLeagueActionSummary || null,
      serverNow: bootstrapData?.serverTime || null,
    });

    const bootstrapPendingLeagueTeamId = String(
      bootstrapData?.pendingLeagueActionSummary?.teamId || '',
    ).trim();
    if (bootstrapPendingLeagueTeamId) {
      queryClient.setQueryData(['pendingLeagueAction', bootstrapPendingLeagueTeamId], {
        nextAction: bootstrapData?.pendingLeagueActionSummary || null,
        serverNow: bootstrapData?.serverTime || null,
      });
    }

    if (bootstrapData?.pendingMatchStatsSummary) {
      queryClient.setQueryData(
        ['pendingMatchStatsPrompts'],
        bootstrapData.pendingMatchStatsSummary,
      );
    }
  }, [auth, bootstrapData, queryClient]);

  useEffect(() => {
    if (!fullUserData?.documentId) {
      return;
    }

    const sanitizedUserData = sanitizeUser(fullUserData);
    const fullUserSyncKey = `${String(auth?.token || 'no-token')}:${getSanitizedUserSignature(sanitizedUserData)}`;
    if (haveSameSanitizedUser(sanitizedUserData, currentContextUserData)) {
      if (lastFullUserSyncedKey === fullUserSyncKey) {
        return;
      }
      lastFullUserSyncedKey = fullUserSyncKey;
      return;
    }
    if (lastFullUserSyncedKey === fullUserSyncKey) {
      return;
    }

    authLogger.debug('Full user data changed, dispatching update', {
      userDocumentId: sanitizedUserData?.documentId,
    });

    lastFullUserSyncedKey = fullUserSyncKey;
    appDispatch({
      payload: fullUserData,
      type: 'UPDATE_USER_DATA',
    });
  }, [appDispatch, auth?.token, currentContextUserData, fullUserData]);

  const onboardingViews = useMemo(() => (
    userData ? getOnboardingViews(userData) : undefined
  ), [userData]);

  const profileFields = useMemo(() => (
    userData ? profileFieldToDisplay(userData.role) : []
  ), [userData]);

  /**
   * Invite a trainer
   * @param {object} param
   * @param {string | undefined} param.clubId
   * @param {string | undefined} param.firstname
   * @param {string | undefined} param.clubName
   * @param {string | undefined} param.phoneNumber
   */
  const inviteTrainer = ({
    clubId, clubName, firstname, phoneNumber,
  }) => {
    const shareMessage = t('clubDetails.alerts.inviteTrainer.message', {
      clubName,
      coachName: firstname,
    });
    const installUrl = buildInstallLandingUrl(/** @type {any} */ ({
      id: clubId,
      invite: true,
      source: 'sms',
      type: 'club',
    }));
    const encodedMessage = buildShareMessageWithUrl({
      intro: shareMessage,
      linkLabel: t('teamDetails.alerts.invitePlayers.downloadApp', 'Telecharge l\'application ici'),
      url: installUrl,
    });
    const smsUrl = `sms:${phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(encodedMessage)}`;

    Linking.openURL(smsUrl).catch(() => {
      SharePlatform.share({
        message: encodedMessage,
        title: t(
          'clubDetails.alerts.inviteTrainer.title',
        ),
        url: installUrl,
      }).catch(() => undefined);
    });
  };

  /**
   * Invite team players
   * @param {object} param
   * @param {string} [param.clubName]
   * @param {string} [param.teamId]
   * @param {string} [param.teamName]
   * @returns {void}
   */
  const inviteTeamPlayers = ({ clubName, teamId, teamName }) => {
    const installUrl = buildInstallLandingUrl(/** @type {any} */ ({
      id: teamId,
      invite: true,
      source: 'sms',
      type: 'team',
    }));
    const shareMessage = t('teamDetails.alerts.invitePlayers.message', {
      clubName,
      teamName,
    });

    SharePlatform.share({
      message: buildShareMessageWithUrl({
        intro: shareMessage,
        linkLabel: t('teamDetails.alerts.invitePlayers.downloadApp', 'Telecharge l\'application ici'),
        url: installUrl,
      }),
      title: t(
        'teamDetails.alerts.invitePlayers.title',
      ),
      url: installUrl,
    }).catch(() => undefined);
  };

  const getNextOnboardingRoute = useCallback((/** @type {string} */currentRoute) => {
    const currentIndex = onboardingViews?.views?.find(
      (view) => view.route === currentRoute,
    )?.index || 0;
    const nextRoute = onboardingViews?.views?.find(
      (view) => view.canShow && view.index > currentIndex,
    )?.route;
    if (nextRoute) return nextRoute;

    // D16 - LE SAS D'ARRIVEE.
    //
    // `Welcome` n'est plus une etape COMPTEE des parcours joueur, entraineur
    // et dirigeant (decision Adel du 2026-08-06) - mais il n'est pas
    // supprime : il reste l'ecran qui lance le tour guide et montre les trois
    // offres. Il est donc rebranche ici, en SORTIE de tunnel.
    //
    // Pourquoi ici et pas dans `getPostOnboardingHomeRoute` : `Welcome.js`
    // appelle cette derniere pour PARTIR (l. 87, 196, 207). L'y brancher
    // ferait boucler l'ecran sur lui-meme. `Welcome` n'appelle jamais
    // `getNextOnboardingRoute` - la boucle est donc impossible par
    // construction, pas par precaution.
    //
    // D23 - la decision elle-meme vit desormais dans `resolveOnboardingExitRoute`
    // (`authUseCases.js`), ou elle est TESTABLE : « Welcome est atteint en
    // sortie de tunnel » etait suppose, il est maintenant mesure.
    const onboardingUserId = userData?.documentId;
    return resolveOnboardingExitRoute({
      hasSeenWelcome: Boolean(
        onboardingUserId && storage.getBoolean(`hasSeenWelcome_${onboardingUserId}`),
      ),
      userDocumentId: onboardingUserId,
      views: onboardingViews?.views,
    });
  }, [onboardingViews, userData?.documentId]);

  const getPostOnboardingHomeRoute = useCallback(
    () => (isGold ? RouteNames.LeagueHomeTab : RouteNames.HomeTab),
    [isGold],
  );

  const allMyTeams = useMemo(() => (userData?.myTeams || [])
    ?.concat(userData?.trainedTeams || []), [userData]);

  const clubs = useMemo(() => (Array.isArray(userData?.clubs) ? userData.clubs : []), [userData?.clubs]);
  const activeClubId = useMemo(() => getActiveClubId(userData), [userData]);
  const clubIds = useMemo(() => getClubIds(userData), [userData]);
  const hasClubAccess = useCallback(
    (/** @type {string} */ clubId) => hasClubAccessForUser(userData, clubId),
    [userData],
  );

  const canEditClub = useCallback(
    (/** @type {string} */clubId) => canUserEditClub(userData, clubId),
    [userData],
  );

  const userRoleKey = useMemo(
    () => getUserRoleKey(userData?.role?.type || userData?.role?.name),
    [userData?.role?.name, userData?.role?.type],
  );

  const canEditEvent = useCallback(
    (/** @type {string} */teamId) => (userRoleKey === 'coach' || userRoleKey === 'president')
      && userData?.trainedTeams?.map((/** @type {any} */ { documentId }) => documentId)?.includes(teamId),
    [userData, userRoleKey],
  );

  const canManageEvent = useCallback((/** @type {any} */ event) => {
    if (userRoleKey !== 'coach' && userRoleKey !== 'president') {
      return false;
    }

    const normalizedTypeName = String(event?.type?.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const isTournament = normalizedTypeName.includes('tournoi');
    const organizerDocumentId = String(event?.organizer?.documentId || '').trim();
    if (isTournament && organizerDocumentId === String(userData?.documentId || '').trim()) {
      return true;
    }

    const organizerClubId = String(event?.team?.club?.documentId || event?.club?.documentId || '').trim();
    if (canUserEditClub(userData, organizerClubId)) {
      return true;
    }

    const trainedTeamIds = new Set((userData?.trainedTeams || []).map((/** @type {any} */ { documentId }) => documentId));
    const organizerTeamId = event?.team?.documentId;
    const invitedTeamIds = (event?.invitedTeams || []).map((/** @type {any} */ team) => team?.documentId).filter(Boolean);

    if (organizerTeamId && trainedTeamIds.has(organizerTeamId)) return true;
    return invitedTeamIds.some((/** @type {any} */ teamId) => trainedTeamIds.has(teamId));
  }, [userData, userRoleKey]);

  const canJoinClub = useMemo(
    () => userRoleKey === 'coach',
    [userRoleKey],
  );

  const canContactAdmin = useMemo(
    () => userRoleKey === 'president',
    [userRoleKey],
  );

  const canJoinTeam = useCallback((/** @type {string} */teamId) => {
    if (userRoleKey === 'player') {
      return !userData?.myTeams?.some((/** @type {any} */ { documentId }) => documentId === teamId);
    }
    return false;
  }, [userData, userRoleKey]);

  const canManageTeam = useMemo(
    () => userRoleKey === 'coach' || userRoleKey === 'president',
    [userRoleKey],
  );

  const canManageEvents = useMemo(
    () => userRoleKey === 'coach' || userRoleKey === 'president',
    [userRoleKey],
  );

  const nonPartnerCoachPublishingAccess = useMemo(
    () => userData?.nonPartnerCoachPublishingAccess || null,
    [userData?.nonPartnerCoachPublishingAccess],
  );
  const typedBootstrapData = /** @type {any} */ (bootstrapData || null);

  const subscriptionSummary = useMemo(
    () => typedBootstrapData?.subscriptionSummary || null,
    [typedBootstrapData?.subscriptionSummary],
  );

  const entitlementsSummary = useMemo(
    () => (Array.isArray(typedBootstrapData?.entitlementsSummary) ? typedBootstrapData.entitlementsSummary : []),
    [typedBootstrapData?.entitlementsSummary],
  );

  const freeUsageSummary = useMemo(
    () => (Array.isArray(typedBootstrapData?.freeUsageSummary) ? typedBootstrapData.freeUsageSummary : []),
    [typedBootstrapData?.freeUsageSummary],
  );

  const clubVerificationSummary = useMemo(
    () => typedBootstrapData?.clubVerificationSummary || null,
    [typedBootstrapData?.clubVerificationSummary],
  );

  const isCurrentClubPartner = useMemo(() => (
    clubVerificationSummary?.clubPartner === true
    || userData?.club?.clubPartner === true
  ), [
    clubVerificationSummary?.clubPartner,
    userData?.club?.clubPartner,
  ]);

  const isCurrentClubVerified = useMemo(() => (
    clubVerificationSummary?.clubVerified === true
    || userData?.club?.clubVerified === true
  ), [
    clubVerificationSummary?.clubVerified,
    userData?.club?.clubVerified,
  ]);

  const subscriptionAccessLevel = useMemo(() => getSubscriptionAccessLevel({
    clubVerificationSummary,
    entitlementsSummary,
    subscriptionSummary,
    userClub: userData?.club,
  }), [
    clubVerificationSummary,
    entitlementsSummary,
    subscriptionSummary,
    userData?.club,
  ]);

  const isNonPartnerCoach = nonPartnerCoachPublishingAccess?.isNonPartnerCoach === true;

  const canPublishGovernedClubContent = useMemo(() => {
    if (!isNonPartnerCoach) {
      return true;
    }

    return nonPartnerCoachPublishingAccess?.canPublish === true;
  }, [isNonPartnerCoach, nonPartnerCoachPublishingAccess?.canPublish]);

  const governedPublishingBlockReason = useMemo(() => {
    if (canPublishGovernedClubContent) {
      return null;
    }

    return nonPartnerCoachPublishingAccess?.reason || 'requires_superadmin_authorization';
  }, [canPublishGovernedClubContent, nonPartnerCoachPublishingAccess?.reason]);

  const canSendMessageToUser = useCallback((/** @type {User} */userToContact) => {
    if (userToContact?.documentId === userData?.documentId) {
      return false;
    }

    const userClubIds = new Set(clubIds);
    const contactClubIds = new Set(getClubIds(userToContact));
    const sharesClub = [...contactClubIds].some((clubId) => userClubIds.has(clubId));
    if (sharesClub) {
      return userData?.role?.name === USER_ROLES.president;
    }

    const myTeams = (userData?.myTeams || [])
      ?.concat(userData?.trainedTeams || [])
      ?.map((/** @type {any} */ { documentId }) => documentId);

    const userToContactTeams = (userToContact?.myTeams || [])
      ?.concat(userToContact?.trainedTeams || [])
      ?.map((/** @type {any} */ { documentId }) => documentId);

    return myTeams?.some((/** @type {any} */ teamId) => userToContactTeams?.includes(teamId));
  }, [clubIds, userData]);

  const cancelAddAccount = useCallback(() => {
    authLogger.debug('Cancel add-account flow');
    setConfirm(undefined);
    queryClient.clear(); // Clear stale data from previous partial login attempts
    appDispatch({ type: 'CANCEL_ADD_ACCOUNT' });
  }, [appDispatch, queryClient]);

  // Relance volontaire du démarrage (bouton « Réessayer » de l'écran d'échec) :
  // réarme le garde anti-rafale puis remet les deux queries de boot à zéro.
  const retryBoot = useCallback(() => {
    authLogger.debug('Manual boot retry requested');
    resetBootRequestGuard();
    queryClient.resetQueries({ queryKey: ['app-bootstrap'] });
    queryClient.resetQueries({ queryKey: ['get-me'] });
  }, [queryClient]);

  return {
    activeClubId,
    addAccount,
    allMyTeams,
    appBootstrapData: bootstrapData || null,
    authSessions,
    cancelAddAccount,
    canContactAdmin,
    canEditClub,
    canEditEvent,
    canJoinClub,
    canJoinTeam,
    canManageEvent,
    canManageEvents,
    canManageTeam,
    canPublishGovernedClubContent,
    canSendMessageToUser,
    canShowCodeButton: !!confirm,
    clubIds,
    clubs,
    clubVerificationSummary,
    confirm,
    entitlementsSummary,
    formatBirthdateToDisplay,
    formatBirthdateToSend,
    freeUsageSummary,
    getAuthTokens,
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    governedPublishingBlockReason,
    hasClubAccess,
    inviteTeamPlayers,
    inviteTrainer,
    isAddingAccount,
    isBootstrapResolved: disableAppBootstrap
      || !auth?.token
      || isAddingAccount
      || Boolean(bootstrapData?.serverTime || bootstrapError),
    isCurrentClubPartner,
    isCurrentClubVerified,
    isLoading: otpMutation.isPending || loginMutation.isPending,
    isNonPartnerCoach,
    loginMutation,
    logoutMutation,
    nonPartnerCoachPublishingAccess,
    onboardingViews,
    otpMutation,
    profileFields,
    refetchUserData,
    retryBoot,
    setConfirm,
    subscriptionAccessLevel,
    subscriptionSummary,
    switchAccount,
    USER_ROLES,
    userData,
    userDataError,
    userDataLoading,
  };
};

export default useAuth;
