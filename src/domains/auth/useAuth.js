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
  getMe, login, logout, markOnboardingCompletedOnServer, signInWithPhoneNumber,
} from '@/services/auth/authService';
import {
  getRetryAfterSeconds,
  resetBootRequestGuard,
} from '@/services/bootRequestGuard';
import { getAppBootstrap } from '@/services/bootstrap/bootstrapService';
import { shareTeamInviteLink } from '@/services/teamInvite/teamInviteShare';

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
import {
  canUseParentMode as canAccountUseParentMode,
  canUsePlayerMode as canAccountUsePlayerMode,
  resolveDisplayRoleKey,
  useDisplayModeRequest,
  writeDisplayModeRequest,
} from '@/domains/auth/playerMode';
import {
  getAccountSubscriptionAccessLevel,
  getSubscriptionAccessLevel,
} from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
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
  isClubMember as isClubMemberForUser,
  onboardingCompleteKey,
  profileFieldToDisplay,
  resolveNextOnboardingRoute,
  resolveOnboardingExitRoute,
  shouldFetchFullUser,
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
// ONBOARDDATE — les comptes dont la fin d'inscription est partie au serveur pendant CE lancement.
// Un echec n'est pas rejoue avant le lancement suivant (variable de module, remise a zero).
/** @type {Set<string>} */
const finInscriptionEnvoyee = new Set();

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

  // U05 — Le profil complet est deja en cache ? Alors il EST l'identite lue
  // (`userData` le prefere au resume du bootstrap, plus bas), et il doit rester
  // rafraichissable. Lecture synchrone du cache : l'observateur de la query
  // ci-dessous nous re-rend des que cette donnee apparait.
  const hasCachedFullUser = Boolean(
    /** @type {any} */ (queryClient.getQueryData(['get-me', auth?.token || 'no-token']))
      ?.documentId,
  );

  const shouldEnableFullUserFetch = shouldFetchFullUser({
    hasBootstrapError: Boolean(bootstrapError),
    hasBootstrapUser: Boolean(bootstrapData?.userSummary?.documentId),
    hasFullUser: hasCachedFullUser,
    isAddingAccount: Boolean(isAddingAccount),
    isBootstrapDisabled: Boolean(disableAppBootstrap),
    isDelayElapsed: Boolean(isFullUserFetchReady),
    isSignedIn: Boolean(auth?.token),
  });

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
      // FINITIONS18 · POINT 6 (T16) — le RESUME du demarrage (`items: []`) ne remplace jamais une
      // LISTE deja lue : cet effet repasse a chaque nouvelle identite de `auth`, et « Matchs en
      // attente », reste monte sous « Mon retour de match », tombait sur son squelette sans fin
      // (« des matchs, pas de liste »), sans relire. Une liste qui ne compte plus comme le serveur
      // est seulement marquee a relire.
      const resume = bootstrapData.pendingMatchStatsSummary;
      const liste = /** @type {any} */ (queryClient.getQueryData(['pendingMatchStatsPrompts']));
      if (!Array.isArray(liste?.items) || liste.items.length === 0) {
        queryClient.setQueryData(['pendingMatchStatsPrompts'], resume);
      } else if (Number(liste?.totalPending) !== Number(resume?.totalPending)) {
        queryClient.invalidateQueries(
          { queryKey: ['pendingMatchStatsPrompts'] },
          { cancelRefetch: false },
        );
      }
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

  // BOUCLE-ACCUEIL (tournee 2.6.83, 28/10/2026) — « inscription finie » est un drapeau de
  // l'appareil (`markOnboardingComplete`), pas un champ du profil : le parcours ne se recalculait
  // qu'avec `userData`. « Demarrer le tour guide » posait le drapeau, mais le navigateur gardait
  // le tunnel monte (bulle « Mission 1/4 » sur « Bienvenue », retour arriere vers 5/5). Toute
  // ecriture de la cle du compte recalcule donc le parcours, quel que soit l'ecran qui finit.
  const onboardingDocumentId = userData?.documentId;
  const [onboardingCompleteVersion, setOnboardingCompleteVersion] = useState(0);
  useEffect(() => {
    if (!onboardingDocumentId) return undefined;
    if (typeof storage.addOnValueChangedListener !== 'function') return undefined;
    const cle = onboardingCompleteKey(onboardingDocumentId);
    const abonnement = storage.addOnValueChangedListener((/** @type {string} */ changedKey) => {
      if (changedKey === cle) setOnboardingCompleteVersion((version) => version + 1);
    });
    return () => abonnement?.remove?.();
  }, [onboardingDocumentId]);

  // ONBOARDDATE (29/10/2026, decision d'Adel « 3- A ») — le SERVEUR garde la date de fin : le
  // drapeau pose (n'importe quelle sortie du tunnel), ou deja la sans date serveur au demarrage
  // (appel rate, version d'avant), on la lui demande. Un echec ne bloque personne : le drapeau
  // ferme deja le tunnel sur cet appareil.
  const onboardingCompletedAtServeur = userData?.onboardingCompletedAt;
  useEffect(() => {
    if (!onboardingDocumentId || onboardingCompletedAtServeur) return;
    if (finInscriptionEnvoyee.has(onboardingDocumentId)) return;
    // Meme lecture prudente que `getOnboardingViews` : un stockage illisible = pas de drapeau.
    let drapeauLocal = false;
    try {
      drapeauLocal = storage.getBoolean(onboardingCompleteKey(onboardingDocumentId)) === true;
    } catch { /* rien */ }
    if (!drapeauLocal) return;
    finInscriptionEnvoyee.add(onboardingDocumentId);
    // Jamais d'erreur qui remonte a l'ecran : l'appel part dans une promesse, son echec se
    // journalise.
    const appel = Promise.resolve().then(() => markOnboardingCompletedOnServer());
    appel.catch((/** @type {any} */ error) => {
      authLogger.warn('Onboarding completion not saved on server', error?.message || error);
    });
  }, [onboardingCompleteVersion, onboardingCompletedAtServeur, onboardingDocumentId]);

  const onboardingViews = useMemo(() => (
    userData ? getOnboardingViews(userData) : undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [userData, onboardingCompleteVersion]);

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
   * @param {boolean} [param.isManager] - INVITESMS : un dirigeant (son SMS dit « dirigeant·e »).
   */
  const inviteTrainer = ({
    clubId, clubName, firstname, isManager = false, phoneNumber,
  }) => {
    const shareMessage = t(isManager
      ? 'clubDetails.alerts.inviteManager.message'
      : 'clubDetails.alerts.inviteTrainer.message', {
      clubName,
      coachName: firstname,
      ...SANS_ECHAPPEMENT,
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
    // INVIT2 — le lien part sur foundclub.app/i/team/<id>?c=<code> (plus sur
    // install.html du domaine de l'API, dont les fichiers de reconnaissance sont en
    // 404) et la phrase nomme QUI invite. Voir services/teamInvite/teamInviteShare.js.
    if (!teamId) return;
    shareTeamInviteLink({
      clubName,
      inviterName: String(userData?.firstname || '').trim(),
      teamId,
      teamName,
    }).catch(() => undefined);
  };

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

  // C3 — « ce club fait-il partie des miens ? », equipes comprises. A ne pas
  // confondre avec `hasClubAccess` juste au-dessus, qui est la porte des droits
  // (edition du club, moderation, « quitter le club ») : celle-ci n'en ouvre
  // aucun. Voir le commentaire de `getClubIds` dans authUseCases.js.
  const isClubMember = useCallback(
    (/** @type {string} */ clubId) => isClubMemberForUser(userData, clubId),
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

  // LOT RÔLES (2026-09-28) — LE MODE JOUEUR : un rôle d'AFFICHAGE, jamais un droit.
  //
  // `userRoleKey` reste le rôle du COMPTE (le sas d'arrivée le lit plus bas).
  // `displayRoleKey` vaut `player` quand un dirigeant ou un entraîneur qui joue
  // dans une équipe a demandé à « voir l'app en joueur » : SEULS les jugements
  // d'affichage ci-dessous le lisent (gérer l'équipe, gérer les événements…).
  // ⛔ Les portes de droits (`canEditClub`, `hasClubAccess`) et le serveur ne
  // le voient pas ; `userData.role` n'est jamais réécrit.
  // Témoin : src/domains/auth/__tests__/useAuth.ROLES.modeJoueur.test.js.
  //
  // PAR-L12 (13/10, décision D6 A d'Adel du 12/10) — le MODE PARENT, troisième position du même
  // choix d'affichage : un joueur, un entraîneur ou un dirigeant qui a des enfants voit l'app
  // comme un parent (`displayRoleKey` vaut `parent`). Mêmes règles : ni droit, ni serveur.
  // Témoin : src/domains/auth/__tests__/useAuth.L12.modeParent.test.js.
  const displayModeRequest = useDisplayModeRequest(userData?.documentId);
  const displayRoleKey = resolveDisplayRoleKey({
    accountRoleKey: userRoleKey,
    displayModeRequest,
    userData,
  });
  const isPlayerMode = displayRoleKey === 'player' && userRoleKey !== 'player';
  const isParentMode = displayRoleKey === 'parent' && userRoleKey !== 'parent';
  const canUsePlayerMode = canAccountUsePlayerMode(userRoleKey, userData);
  const canUseParentMode = canAccountUseParentMode(userRoleKey);
  const setDisplayMode = useCallback(
    (/** @type {'player' | 'parent' | null} */ mode) => writeDisplayModeRequest(
      userData?.documentId,
      mode,
    ),
    [userData?.documentId],
  );
  // L'appel d'avant L12 garde son sens : vrai = mode joueur, faux = retour au rôle du compte.
  const setPlayerMode = useCallback(
    (/** @type {boolean} */ enabled) => setDisplayMode(enabled ? 'player' : null),
    [setDisplayMode],
  );

  const canEditEvent = useCallback(
    (/** @type {string} */teamId) => (displayRoleKey === 'coach' || displayRoleKey === 'president')
      && userData?.trainedTeams?.map((/** @type {any} */ { documentId }) => documentId)?.includes(teamId),
    [userData, displayRoleKey],
  );

  const canManageEvent = useCallback((/** @type {any} */ event) => {
    if (displayRoleKey !== 'coach' && displayRoleKey !== 'president') {
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
  }, [userData, displayRoleKey]);

  // TRIO/A2 — « C'EST MON CLUB ! » N'ETAIT OUVERT QU'A L'ENTRAINEUR.
  //
  // Un DIRIGEANT recevait `false` et la fiche club ne lui proposait donc que la
  // REVENDICATION, celle qu'un SuperAdmin valide a la main. Le geste n°1 du
  // produit etait ferme a la moitie de ceux a qui il s'adresse.
  //
  // 🔓 LE SERVEUR, LUI, ACCEPTE LES DEUX ROLES — verifie le 2026-09-01 :
  //   · `canClaimClubWithoutManager` vaut `isCoachRole(role) || isPresidentRole(role)`
  //     depuis U03/D4 (admin, club-membership-request.ts) ;
  //   · le Dirigeant declare `club-membership-request.create` depuis AB05
  //     (admin, src/index.ts : « le seul verbe qui manquait au dirigeant etait
  //     demander »).
  // ⇒ Ce lot n'elargit AUCUN droit serveur : il ouvre un bouton sur une porte
  // que le serveur tenait deja ouverte.
  //
  // 🔤 Meme mot que `canContactAdmin` juste en dessous et que `canManageTeam` /
  // `canManageEvents` juste apres : `'president'`.
  const canJoinClub = useMemo(
    () => displayRoleKey === 'coach' || displayRoleKey === 'president',
    [displayRoleKey],
  );

  const canContactAdmin = useMemo(
    () => displayRoleKey === 'president',
    [displayRoleKey],
  );

  const canJoinTeam = useCallback((/** @type {string} */teamId) => {
    if (displayRoleKey === 'player') {
      return !userData?.myTeams?.some((/** @type {any} */ { documentId }) => documentId === teamId);
    }
    return false;
  }, [userData, displayRoleKey]);

  const canManageTeam = useMemo(
    () => displayRoleKey === 'coach' || displayRoleKey === 'president',
    [displayRoleKey],
  );

  const canManageEvents = useMemo(
    () => displayRoleKey === 'coach' || displayRoleKey === 'president',
    [displayRoleKey],
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

  // ABOPARCLUB (2026-09-29, decision d'Adel « niveau oui ») — le niveau d'acces
  // est celui du club AFFICHE, plus celui du compte. Le calcul vit dans
  // `getSubscriptionAccessLevel` ; ses ~16 lecteurs suivent sans reecriture.
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

  // Ce que le compte PAIE (ou ce qu'on paie pour lui), quel que soit le club
  // affiche : seuls « Mon abonnement » et la carte du Profil le lisent, pour ne
  // jamais faire disparaitre une offre payee pour un autre club.
  const accountSubscriptionAccessLevel = useMemo(() => getAccountSubscriptionAccessLevel({
    entitlementsSummary,
    subscriptionSummary,
  }), [entitlementsSummary, subscriptionSummary]);

  // Le niveau d'un club NOMME — celui d'un evenement ou d'une equipe qu'on
  // regarde depuis un autre club. Club vide = le club affiche.
  const getSubscriptionAccessLevelForClub = useCallback(
    (/** @type {string | null | undefined} */ clubDocumentId) => (
      String(clubDocumentId || '').trim()
        ? getSubscriptionAccessLevel({
          clubDocumentId: String(clubDocumentId).trim(),
          clubVerificationSummary,
          entitlementsSummary,
          subscriptionSummary,
          userClub: userData?.club,
        })
        : subscriptionAccessLevel
    ),
    [
      clubVerificationSummary,
      entitlementsSummary,
      subscriptionAccessLevel,
      subscriptionSummary,
      userData?.club,
    ],
  );

  // D89 - DESCENDU ICI, ET LA RAISON EST MECANIQUE, PAS ESTHETIQUE.
  //
  // Le sas lit desormais `userRoleKey` (l. 567) et `subscriptionAccessLevel`
  // (l. 676), tous deux declares plus bas que sa position d'origine. Un `const`
  // cite dans un tableau de dependances est evalue AU MONTAGE, pas a l'appel :
  // laisser ce bloc au-dessus levait une `ReferenceError` (zone morte
  // temporelle) des le premier rendu. Le corps du callback, lui, n'a pas bouge
  // d'une ligne.
  const getNextOnboardingRoute = useCallback((/** @type {string} */currentRoute) => {
    // D33 - la recherche elle-meme vit desormais dans `resolveNextOnboardingRoute`
    // (`authUseCases.js`), ou elle est TESTABLE : le trajet club -> equipe -> sas
    // se mesure sans monter un ecran. Meme code, meme ordre, memes sorties.
    const nextRoute = resolveNextOnboardingRoute({
      currentRoute,
      views: onboardingViews?.views,
    });
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
    //
    // D89 - le sas commence par l'OFFRE quand elle s'adresse a cette personne
    // (entraineur ou dirigeant, encore en gratuit). Les deux entrees de cette
    // decision sont lues ici parce que c'est ici qu'elles vivent ; la regle,
    // elle, reste dans `authUseCases.js` avec le reste du sas.
    const onboardingUserId = userData?.documentId;
    return resolveOnboardingExitRoute({
      hasSeenWelcome: Boolean(
        onboardingUserId && storage.getBoolean(`hasSeenWelcome_${onboardingUserId}`),
      ),
      roleKey: userRoleKey,
      subscriptionAccessLevel,
      userDocumentId: onboardingUserId,
      views: onboardingViews?.views,
    });
  }, [onboardingViews, subscriptionAccessLevel, userData?.documentId, userRoleKey]);

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
    // LOT RÔLES — le rôle du COMPTE, que le mode joueur ne change pas.
    accountRoleKey: userRoleKey,
    accountSubscriptionAccessLevel,
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
    canUseParentMode,
    canUsePlayerMode,
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
    getSubscriptionAccessLevelForClub,
    governedPublishingBlockReason,
    hasClubAccess,
    inviteTeamPlayers,
    inviteTrainer,
    isAddingAccount,
    isBootstrapResolved: disableAppBootstrap
      || !auth?.token
      || isAddingAccount
      || Boolean(bootstrapData?.serverTime || bootstrapError),
    isClubMember,
    isCurrentClubPartner,
    isCurrentClubVerified,
    isLoading: otpMutation.isPending || loginMutation.isPending,
    isNonPartnerCoach,
    isParentMode,
    isPlayerMode,
    loginMutation,
    logoutMutation,
    nonPartnerCoachPublishingAccess,
    onboardingViews,
    otpMutation,
    profileFields,
    refetchUserData,
    retryBoot,
    setConfirm,
    setDisplayMode,
    setPlayerMode,
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
