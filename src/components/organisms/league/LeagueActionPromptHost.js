import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  AppState,
  Platform,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LeagueModalHeader from '@/components/molecules/header/LeagueModalHeader';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import { shouldMaskOpponentIdentity } from '@/views/league/match/utils/matchStatus';
import { buildProposalDefaultsFromMatch } from '@/views/league/match/utils/proposalDefaults';
import { buildCanonicalLeagueProposalPayload } from '@/views/league/match/utils/proposalPayload';

import {
  getCurrentRouteName,
  getCurrentRouteTrail,
  navigate,
  navigationRef,
} from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import {
  getPendingLeagueActionQueryKey,
  usePendingLeagueAction,
} from '@/services/league/leagueActionQueries';
import {
  createLeagueProposal,
  respondToLeagueProposal,
  submitPostSlotResponse,
} from '@/services/league/leagueMatchService';

import {
  doesMatchRequireVenue,
  getMatchDurationMinutes,
} from '@/utils/leagueSportConfig';
import { getWebBackgroundPollMs } from '@/utils/webRuntime';

import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import {
  POPUP_DISMISS_SCOPES,
  POPUP_IDS,
} from '@/constants/popupRegistry';
import { ENABLE_LEAGUE_ACTION_PROMPTS } from '@/constants/runtimeFlags';
import { useAppFeedback } from '@/context/AppFeedbackContext';
import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';

const END_MATCH_ROUTE = RouteNames.EndMatchScreen;
const LEAGUE_ACTION_PROMPT_STATES = /** @type {Set<string>} */ (new Set([
  'disputed',
  'opponent_found',
  'pending_validation',
  'post_slot_resolution',
  'proposal_received',
  'waiting_score',
  'waiting_venue',
]));

const BLOCKED_ROUTES = /** @type {Set<string>} */ (new Set([
  END_MATCH_ROUTE,
  RouteNames.Conversation,
  RouteNames.LeagueMatchDetails,
  RouteNames.MatchStatsEditor,
  RouteNames.PendingMatchStats,
  RouteNames.PlayerMatchResponse,
]));

/**
 * @param {unknown} value
 * @returns {string}
 */
const formatActionDate = (value) => {
  if (!value) return 'Date à définir';
  try {
    const dateValue = value instanceof Date
      ? value
      : new Date(/** @type {string | number} */ (value));
    return dateValue.toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'long',
    });
  } catch (_error) {
    return 'Date à définir';
  }
};

/**
 * @param {any} error
 * @returns {boolean}
 */
const isAlreadyResolvedError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0);
  const code = String(error?.response?.data?.error?.code || error?.code || '');
  return status === 409 || code === 'ALREADY_RESOLVED';
};

/**
 * @param {string | undefined | null} opponentResponse
 * @param {string | undefined | null} opponentNextAction
 * @returns {string}
 */
const getOpponentResponseLabel = (opponentResponse, opponentNextAction) => {
  if (opponentResponse === 'played') {
    return 'Match joué';
  }
  if (opponentNextAction === 'cancel') {
    return 'Match non joué - annulation proposée';
  }
  if (opponentNextAction === 'reschedule') {
    return 'Match non joué - replanification proposée';
  }
  return 'Match non joué';
};

/**
 * @param {{ skipInitialFetch?: boolean }} [props]
 */
function LeagueActionPromptHost({ skipInitialFetch = false } = {}) {
  const queryClient = useQueryClient();
  const [{ auth }] = useAppContext();
  const { isBootstrapResolved, userData } = useAuth();
  // AUDIT LEAGUE 2026-07-30, defaut G4 — cet hote est monte dans DeferredStartupHosts
  // (App.js), donc HORS du navigateur : l appel partait pour TOUS les comptes, y compris
  // ceux qui n ont jamais choisi de profil. Mesure sur la base de production : 40 comptes
  // sur 118 sont restes au role `Authenticated` (SMS valide, profil jamais choisi — 34 %
  // des inscriptions sur 4 mois). Ils n ont ni escouade, ni equipe, ni club : la reponse
  // serait vide, et c est un 403 qu ils recevaient a chaque ouverture d application.
  // getUserRoleKey rend 'new' pour `Authenticated` comme pour un role inconnu, donc aussi
  // tant que userData n est pas arrive : la porte est fermee par defaut, ce qui est le
  // bon sens (voir G5 — les deux autres verrous LEAGUE s ouvraient quand ils ne savaient pas).
  const hasChosenProfile = getUserRoleKey(userData?.role?.type || userData?.role?.name) !== 'new';
  const [consumedForcedPromptKey, setConsumedForcedPromptKey] = useState(/** @type {string | null} */ (null));
  const [dismissedActionKey, setDismissedActionKey] = useState(/** @type {string | null} */ (null));
  const [currentRouteName, setCurrentRouteName] = useState(/** @type {string | null} */ (null));
  const [currentRouteTrail, setCurrentRouteTrail] = useState(/** @type {string[]} */ ([]));
  const [forcePromptToken, setForcePromptToken] = useState(/** @type {string | null} */ (null));
  const [isNavigationReady, setIsNavigationReady] = useState(navigationRef.isReady());
  const [isCounterProposalVisible, setIsCounterProposalVisible] = useState(false);
  const [postSlotLocalStep, setPostSlotLocalStep] = useState(/** @type {string | null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppressedScoreMatchId, setSuppressedScoreMatchId] = useState(/** @type {string | null} */ (null));
  const [allowPromptFallbackFetch, setAllowPromptFallbackFetch] = useState(false);
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const appStateRef = useRef(AppState.currentState);
  const shownActionPromptKeyRef = useRef(/** @type {string | null} */ (null));
  const shownCounterProposalKeyRef = useRef(/** @type {string | null} */ (null));
  const { height, width } = useWindowDimensions();
  const {
    ApplicationStyle, Colors, Fonts,
  } = useTheme();
  const { showBanner } = useAppFeedback();
  let pendingActionPollInterval = false;
  if (auth?.token && (isBootstrapResolved || allowPromptFallbackFetch) && Platform.OS === 'web') {
    pendingActionPollInterval = getWebBackgroundPollMs();
  }

  const {
    data: pendingActionPayload,
    refetch,
  } = usePendingLeagueAction(undefined, {
    enabled: ENABLE_LEAGUE_ACTION_PROMPTS
      && Boolean(auth?.token)
      && hasChosenProfile
      && !skipInitialFetch
      && (isBootstrapResolved || allowPromptFallbackFetch),
    refetchInterval: pendingActionPollInterval,
    refetchIntervalInBackground: false,
  });

  const nextAction = /** @type {any} */ (pendingActionPayload)?.nextAction || null;
  const nextActionMatchId = String(
    nextAction?.matchId
    || nextAction?.match?.documentId
    || nextAction?.match?.id
    || '',
  ).trim();
  const promptVenueRequired = doesMatchRequireVenue(nextAction?.match);
  const promptDurationMinutes = getMatchDurationMinutes(
    nextAction?.match?.team_a?.sport || nextAction?.match?.team_b?.sport || nextAction?.match?.sport,
  );
  const promptMatchFocusSection = promptVenueRequired ? 'venueBooking' : 'presence';
  const isBlockedRoute = Boolean(
    (currentRouteName && BLOCKED_ROUTES.has(currentRouteName))
    || currentRouteTrail.some((routeName) => BLOCKED_ROUTES.has(routeName)),
  );
  const isCompactMobile = width < 390 || height < 760;
  const modalSnapPoint = isCompactMobile ? '90%' : '84%';
  const sectionGap = isCompactMobile ? 12 : 16;
  const currentForcedPromptKey = nextAction?.key && forcePromptToken
    ? `${nextAction.key}:${forcePromptToken}`
    : null;
  const scoreActionState = String(nextAction?.state || '').trim().toLowerCase();
  const scoreActionPhase = String(nextAction?.match?.phase || '').trim().toLowerCase();
  const effectiveScoreAction = ['disputed', 'pending_validation', 'waiting_score'].includes(scoreActionState)
    ? scoreActionState
    : scoreActionPhase;
  const isScoreActionPrompt = ['disputed', 'pending_validation', 'waiting_score'].includes(
    effectiveScoreAction,
  );
  const isSuppressedScorePrompt = Boolean(
    suppressedScoreMatchId
    && nextActionMatchId
    && String(suppressedScoreMatchId) === nextActionMatchId
    && isScoreActionPrompt,
  );
  const isForcedForCurrentAction = Boolean(
    currentForcedPromptKey && consumedForcedPromptKey !== currentForcedPromptKey,
  );
  const shouldShowPrompt = Boolean(
    ENABLE_LEAGUE_ACTION_PROMPTS
    && auth?.token
    && nextAction
    && isNavigationReady
    && !isBlockedRoute
    && !isSuppressedScorePrompt
    && LEAGUE_ACTION_PROMPT_STATES.has(String(nextAction?.state || ''))
    && (dismissedActionKey !== (nextAction?.key || null) || isForcedForCurrentAction),
  );
  const leagueActionPopup = usePopupEligibility(
    POPUP_IDS.LEAGUE_ACTION_PROMPT,
    shouldShowPrompt,
    {
      cooldownKey: nextAction?.key || 'default',
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const counterProposalPopup = usePopupEligibility(
    POPUP_IDS.LEAGUE_COUNTER_PROPOSAL,
    Boolean(isCounterProposalVisible),
    {
      cooldownKey: `${nextAction?.key || 'default'}:counter-proposal`,
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const canShowLeagueActionPrompt = useBlockingOverlayPrompt(
    leagueActionPopup.descriptor.id,
    leagueActionPopup.canShow,
    leagueActionPopup.descriptor.priority,
  );
  const canShowCounterProposalModal = useBlockingOverlayPrompt(
    counterProposalPopup.descriptor.id,
    counterProposalPopup.canShow,
    counterProposalPopup.descriptor.priority,
  );
  const isVisible = Boolean(shouldShowPrompt && leagueActionPopup.canShow && canShowLeagueActionPrompt);
  useBlockingOverlayLifecycle(leagueActionPopup.descriptor.id, isVisible, {
    releaseDelayMs: 360,
  });
  useBlockingOverlayLifecycle(
    counterProposalPopup.descriptor.id,
    Boolean(isCounterProposalVisible && counterProposalPopup.canShow && canShowCounterProposalModal),
    {
      releaseDelayMs: 360,
    },
  );
  const shouldHideOpponentName = useMemo(
    () => shouldMaskOpponentIdentity(nextAction?.match || null),
    [nextAction?.match],
  );
  const promptMatchLabel = useMemo(() => {
    const opponent = shouldHideOpponentName ? 'Adversaire' : (nextAction?.opponent?.name || 'Adversaire');
    return `Ta squad VS ${opponent}`;
  }, [nextAction?.opponent?.name, shouldHideOpponentName]);

  useEffect(() => {
    if (isBootstrapResolved) {
      setAllowPromptFallbackFetch(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setAllowPromptFallbackFetch(true);
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [isBootstrapResolved]);

  const dismissForSession = useCallback(() => {
    if (currentForcedPromptKey) {
      setConsumedForcedPromptKey(currentForcedPromptKey);
    }
    if (nextAction?.key) {
      setDismissedActionKey(nextAction.key);
    }
    setPostSlotLocalStep(null);
    leagueActionPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
  }, [currentForcedPromptKey, leagueActionPopup, nextAction?.key]);

  useEffect(() => {
    if (!isVisible || !nextAction?.key) {
      shownActionPromptKeyRef.current = null;
      return;
    }
    if (shownActionPromptKeyRef.current === nextAction.key) return;
    shownActionPromptKeyRef.current = nextAction.key;
    /** @type {any} */ (leagueActionPopup).markShown({ actionKey: nextAction.key });
  }, [isVisible, leagueActionPopup, nextAction?.key]);

  useEffect(() => {
    const counterProposalKey = `${nextAction?.key || 'default'}:${isCounterProposalVisible ? 'visible' : 'hidden'}`;
    if (!isCounterProposalVisible || !counterProposalPopup.canShow || !canShowCounterProposalModal) {
      shownCounterProposalKeyRef.current = null;
      return;
    }
    if (shownCounterProposalKeyRef.current === counterProposalKey) return;
    shownCounterProposalKeyRef.current = counterProposalKey;
    /** @type {any} */ (counterProposalPopup).markShown({ actionKey: nextAction?.key || 'default' });
  }, [canShowCounterProposalModal, counterProposalPopup, isCounterProposalVisible, nextAction?.key]);

  const invalidateLeagueQueries = useCallback(() => Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: getPendingLeagueActionQueryKey(undefined) }),
    nextAction?.teamId
      ? queryClient.invalidateQueries({
        queryKey: getPendingLeagueActionQueryKey(String(nextAction.teamId)),
      })
      : Promise.resolve(),
    nextActionMatchId
      ? queryClient.invalidateQueries({ queryKey: ['leagueMatchStats', nextActionMatchId] })
      : Promise.resolve(),
    nextActionMatchId
      ? queryClient.invalidateQueries({ queryKey: ['leagueMyMatchResponse', nextActionMatchId] })
      : Promise.resolve(),
    nextAction?.teamId
      ? queryClient.invalidateQueries({
        queryKey: ['leagueTeamPerformanceStats', String(nextAction.teamId)],
      })
      : Promise.resolve(),
    queryClient.invalidateQueries({ queryKey: ['chats'] }),
    nextAction?.chatId
      ? queryClient.invalidateQueries({ queryKey: ['chat-messages', String(nextAction.chatId)] })
      : Promise.resolve(),
  ]), [nextAction?.chatId, nextAction?.teamId, nextActionMatchId, queryClient]);

  const openMatchDetails = useCallback(
    /**
     * @param {string | undefined} focusSection
     */
    (focusSection = undefined) => {
      if (!nextActionMatchId) return;
      dismissForSession();
      navigate(RouteNames.LeagueMatchDetails, {
        ...(focusSection ? { focusSection } : {}),
        matchId: nextActionMatchId,
      });
    },
    [dismissForSession, nextActionMatchId],
  );

  const openChat = useCallback(() => {
    if (!nextAction?.chatId) return;
    dismissForSession();
    navigate(RouteNames.Conversation, {
      chatId: nextAction.chatId,
      focusLatestProposal: true,
      focusProposalMessageId: nextAction?.proposalMessageId || undefined,
      leagueNegotiationFocusToken: String(Date.now()),
      subTitle: 'Négociation du match en cours',
    });
  }, [dismissForSession, nextAction?.chatId, nextAction?.proposalMessageId]);

  const handleResolvedElsewhere = useCallback(async () => {
    await invalidateLeagueQueries();
    await refetch();
    dismissForSession();

    if (nextAction?.state === 'waiting_venue' || nextAction?.matchId) {
      navigate(RouteNames.LeagueMatchDetails, {
        focusSection: promptMatchFocusSection,
        matchId: nextAction?.matchId,
      });
      return;
    }

    if (nextAction?.chatId) {
      navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
    }
  }, [dismissForSession, invalidateLeagueQueries, nextAction?.chatId, nextAction?.matchId, nextAction?.state, promptMatchFocusSection, refetch]);

  const handleAcceptProposal = useCallback(async () => {
    if (!nextAction?.matchId || !nextAction?.proposalMessageId || isSubmitting) return;
    try {
      const legalAcceptance = await requestLeagueLegalAcceptance({
        metadata: {
          matchLabel: promptMatchLabel,
        },
        scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
        sourceScreen: 'league_action_prompt_accept_proposal',
        targetDocumentId: nextAction.matchId,
        targetLabel: promptMatchLabel,
        targetType: 'league_match',
      });
      if (!legalAcceptance) return;

      setIsSubmitting(true);
      await respondToLeagueProposal(nextAction.matchId, nextAction.proposalMessageId, 'accept', { legalAcceptance });
      await invalidateLeagueQueries();
      dismissForSession();
      navigate(RouteNames.LeagueMatchDetails, {
        focusSection: promptMatchFocusSection,
        matchId: nextAction.matchId,
      });
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        await handleResolvedElsewhere();
        return;
      }
      showBanner({
        body: "Impossible d'accepter la proposition.",
        title: 'Erreur',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    dismissForSession,
    handleResolvedElsewhere,
    invalidateLeagueQueries,
    isSubmitting,
    nextAction?.matchId,
    nextAction?.proposalMessageId,
    promptMatchFocusSection,
    promptMatchLabel,
    requestLeagueLegalAcceptance,
    showBanner,
  ]);

  const handleDeclineProposal = useCallback(async () => {
    if (!nextAction?.proposalMessageId || !nextAction?.matchId || isSubmitting) {
      setIsCounterProposalVisible(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await respondToLeagueProposal(nextAction.matchId, nextAction.proposalMessageId, 'decline');
      await invalidateLeagueQueries();
      dismissForSession();
      setIsCounterProposalVisible(true);
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        await handleResolvedElsewhere();
        return;
      }
      showBanner({
        body: 'Impossible de refuser la proposition.',
        title: 'Erreur',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [dismissForSession, handleResolvedElsewhere, invalidateLeagueQueries, isSubmitting, nextAction?.matchId, nextAction?.proposalMessageId, showBanner]);

  const handleOpenProposalComposer = useCallback(() => {
    dismissForSession();
    setIsCounterProposalVisible(true);
  }, [dismissForSession]);

  const handleCounterProposalSend = useCallback(async (
    /** @type {any} */ proposalData,
    /** @type {{ legalAcceptance?: Record<string, unknown> } | undefined} */ options = undefined,
  ) => {
    if (!nextAction?.matchId || isSubmitting) return;

    try {
      const proposalPayload = buildCanonicalLeagueProposalPayload(proposalData);
      if (promptVenueRequired && !proposalPayload.venueLabel) {
        throw new Error('Missing proposal venue');
      }
      const legalAcceptance = options?.legalAcceptance || await requestLeagueLegalAcceptance({
        metadata: {
          matchLabel: promptMatchLabel,
          ...(proposalPayload.venueLabel ? { venueLabel: proposalPayload.venueLabel } : {}),
        },
        scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
        sourceScreen: 'league_action_prompt_counter_proposal',
        targetDocumentId: nextAction.matchId,
        targetLabel: promptMatchLabel,
        targetType: 'league_match',
      });
      if (!legalAcceptance) return;

      setIsSubmitting(true);
      const result = await createLeagueProposal(
        nextAction.matchId,
        /** @type {any} */ (proposalPayload),
        { legalAcceptance },
      );
      await invalidateLeagueQueries();
      setIsCounterProposalVisible(false);
      dismissForSession();
      const chatId = nextAction?.chatId
        || result?.match?.chat?.documentId
        || result?.match?.chat?.id
        || '';
      if (chatId) {
        navigate(RouteNames.Conversation, {
          chatId,
          focusLatestProposal: true,
          leagueNegotiationFocusToken: String(Date.now()),
        });
        return;
      }
      navigate(RouteNames.LeagueMatchDetails, {
        focusSection: 'negotiation',
        matchId: nextAction.matchId,
      });
    } catch (error) {
      const isInitialProposal = nextAction?.state === 'opponent_found';
      showBanner({
        body: isInitialProposal
          ? "Impossible d'envoyer la proposition."
          : "Impossible d'envoyer la contre-proposition.",
        title: 'Erreur',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    dismissForSession,
    invalidateLeagueQueries,
    isSubmitting,
    nextAction?.chatId,
    nextAction?.matchId,
    nextAction?.state,
    promptMatchLabel,
    promptVenueRequired,
    requestLeagueLegalAcceptance,
    showBanner,
  ]);

  const handleVenueReminder = useCallback(() => {
    if (!nextActionMatchId) return;
    dismissForSession();
    navigate(RouteNames.LeagueMatchDetails, {
      focusSection: promptMatchFocusSection,
      matchId: nextActionMatchId,
    });
  }, [dismissForSession, nextActionMatchId, promptMatchFocusSection]);

  const openLeagueScoreFlow = useCallback(
    /**
     * @param {string} matchId
     */
    (matchId) => {
      if (!matchId) return;
      if (navigate(END_MATCH_ROUTE, { matchId })) {
        return;
      }

      navigate(RouteNames.LeagueHomeTab, {
        params: {
          params: { matchId },
          screen: END_MATCH_ROUTE,
        },
        screen: RouteNames.LeagueDashboard,
      });
    },
    [],
  );

  const dismissThenOpenLeagueScoreFlow = useCallback(
    /**
     * @param {string} matchId
     */
    (matchId) => {
      if (!matchId) return;
      setSuppressedScoreMatchId(String(matchId));
      dismissForSession();
      setTimeout(() => {
        openLeagueScoreFlow(matchId);
      }, 0);
    },
    [dismissForSession, openLeagueScoreFlow],
  );

  useEffect(() => {
    if (!suppressedScoreMatchId) return;
    if (!nextActionMatchId || nextActionMatchId !== String(suppressedScoreMatchId)) {
      setSuppressedScoreMatchId(null);
      return;
    }
    if (!isScoreActionPrompt) {
      setSuppressedScoreMatchId(null);
    }
  }, [isScoreActionPrompt, nextActionMatchId, suppressedScoreMatchId]);

  const handlePostSlotResponse = useCallback(
    /**
     * @param {{outcome: 'played' | 'not_played', nextAction?: 'reschedule' | 'cancel'}} payload
     */
    async (payload) => {
      if (!nextActionMatchId || isSubmitting) return;
      setIsSubmitting(true);
      try {
        const response = await submitPostSlotResponse(nextActionMatchId, payload);
        await invalidateLeagueQueries();
        setPostSlotLocalStep(null);
        dismissForSession();

        const resolution = String(response?.resolution || '').trim().toLowerCase();
        if (resolution === 'score_flow') {
          dismissThenOpenLeagueScoreFlow(nextActionMatchId);
          return;
        }
        if (resolution === 'rescheduled') {
          if (nextAction?.chatId) {
            navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
            return;
          }
          navigate(RouteNames.LeagueMatchDetails, { matchId: nextActionMatchId });
          return;
        }
        if (['auto_cancelled', 'cancelled', 'disputed'].includes(resolution)) {
          navigate(RouteNames.LeagueMatchDetails, { matchId: nextActionMatchId });
        }
      } catch (error) {
        if (isAlreadyResolvedError(error)) {
          await handleResolvedElsewhere();
          return;
        }
        const apiError = /** @type {any} */ (error);
        const serverMessage = String(
          apiError?.response?.data?.error?.message
          || apiError?.response?.data?.message
          || apiError?.message
          || '',
        ).trim();
        showBanner({
          body: serverMessage || "Impossible d'enregistrer cette réponse.",
          title: 'Erreur',
          tone: 'error',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      dismissThenOpenLeagueScoreFlow,
      dismissForSession,
      handleResolvedElsewhere,
      invalidateLeagueQueries,
      isSubmitting,
      nextAction?.chatId,
      nextActionMatchId,
      showBanner,
    ],
  );

  const openPostSlotNoMatchChoices = useCallback(() => {
    setPostSlotLocalStep('choose_not_played_action');
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      setConsumedForcedPromptKey(null);
      setForcePromptToken(null);
      setDismissedActionKey(null);
      return undefined;
    }

    const syncCurrentRoute = () => {
      const ready = navigationRef.isReady();
      setIsNavigationReady(ready);

      if (!ready) {
        setCurrentRouteName(null);
        setCurrentRouteTrail([]);
        setForcePromptToken(null);
        return;
      }

      const currentRoute = /** @type {any} */ (navigationRef).getCurrentRoute?.();
      setCurrentRouteTrail(getCurrentRouteTrail());
      setCurrentRouteName(currentRoute?.name || getCurrentRouteName());
      const explicitForcePromptToken = currentRoute?.params?.forceLeagueActionPromptToken;
      const shouldForcePrompt = Boolean(currentRoute?.params?.forceLeagueActionPrompt);
      setForcePromptToken(
        shouldForcePrompt
          ? String(explicitForcePromptToken || currentRoute?.params?.matchId || 'forced')
          : null,
      );
    };

    syncCurrentRoute();
    const unsubscribeState = typeof navigationRef.addListener === 'function'
      ? navigationRef.addListener('state', syncCurrentRoute)
      : undefined;
    const unsubscribeReady = typeof navigationRef.addListener === 'function'
      ? navigationRef.addListener('ready', syncCurrentRoute)
      : undefined;

    return () => {
      unsubscribeState?.();
      unsubscribeReady?.();
    };
  }, [auth?.token]);

  useEffect(() => {
    if (!auth?.token) return undefined;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextState;

      if (wasBackground && nextState === 'active' && (isBootstrapResolved || allowPromptFallbackFetch)) {
        setDismissedActionKey(null);
        refetch();
      }
    });

    return () => subscription.remove();
  }, [allowPromptFallbackFetch, auth?.token, isBootstrapResolved, refetch]);

  useEffect(() => {
    if (!isBlockedRoute || !isScoreActionPrompt || !nextAction?.key) return;
    leagueActionPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
  }, [isBlockedRoute, isScoreActionPrompt, leagueActionPopup, nextAction?.key]);

  useEffect(() => {
    setPostSlotLocalStep(null);
  }, [nextAction?.key, nextAction?.state]);

  const promptState = String(nextAction?.state || '').trim().toLowerCase();
  const promptPhase = String(nextAction?.match?.phase || '').trim().toLowerCase();
  const promptScoreActionKey = ['disputed', 'pending_validation', 'waiting_score'].includes(promptState)
    ? promptState
    : promptPhase;
  const isScorePrompt = ['disputed', 'pending_validation', 'waiting_score'].includes(promptScoreActionKey);
  const isWaitingVenue = promptState === 'waiting_venue';
  const isOpponentFound = promptState === 'opponent_found';
  const isPostSlotResolution = promptState === 'post_slot_resolution';
  const effectivePostSlotStep = postSlotLocalStep || nextAction?.step || 'ask_happened';
  let promptTitle = 'Nouvelle proposition League';
  let promptBody = "Une proposition de match attend une réponse de ta squad. Consulte les détails avant d'accepter ou de refuser.";
  if (isScorePrompt) {
    if (promptScoreActionKey === 'pending_validation') {
      promptTitle = 'Score à valider';
      promptBody = 'Un score attend ta validation. Confirme ou conteste le résultat pour finaliser le match League.';
    } else if (promptScoreActionKey === 'disputed') {
      promptTitle = 'Litige score';
      promptBody = 'Un litige est ouvert sur le score. Traite le score pour débloquer la suite League.';
    } else {
      promptTitle = 'Score à saisir';
      promptBody = 'Le match est joue. Saisis le score final pour lancer la validation League.';
    }
  } else if (isWaitingVenue) {
    promptTitle = 'Terrain à réserver';
    promptBody = "Le match est confirmé, mais le terrain n'est pas encore réservé. Pense à finaliser l'organisation.";
  } else if (isOpponentFound) {
    promptTitle = 'Adversaire trouvé';
    promptBody = promptVenueRequired
      ? 'Un match compatible est créé. Envoie la première proposition de terrain et de créneau pour lancer la négociation.'
      : 'Un match compatible est créé. Envoie la première proposition de créneau, avec un lieu si tu veux le fixer tout de suite.';
  }
  if (isPostSlotResolution) {
    if (effectivePostSlotStep === 'confirm_reschedule') {
      promptTitle = 'Confirmer la replanification ?';
      promptBody = "L'adversaire indique que le match n'a pas eu lieu et propose de replanifier ce même match.";
    } else if (effectivePostSlotStep === 'confirm_cancel') {
      promptTitle = 'Confirmer l annulation ?';
      promptBody = "L'adversaire indique que le match n'a pas eu lieu et propose d'annuler ce match sans pénalité.";
    } else if (effectivePostSlotStep === 'choose_not_played_action') {
      promptTitle = 'Le match n a pas eu lieu';
      promptBody = 'Choisis la suite à donner à ce match : replanifier avec le même adversaire ou annuler sans pénalité.';
    } else {
      promptTitle = 'Le match a-t-il eu lieu ?';
      promptBody = 'Le créneau est dépassé sans terrain confirmé. Les capitaines doivent confirmer si le match a eu lieu.';
    }
  }
  let homeAwayLabel = 'Match League';
  if (nextAction?.homeAway === 'home') {
    homeAwayLabel = 'Domicile';
  } else if (nextAction?.homeAway === 'away') {
    homeAwayLabel = 'Extérieur';
  }
  const proposalDefaults = useMemo(
    () => buildProposalDefaultsFromMatch(nextAction?.match || null),
    [nextAction?.match],
  );
  const opponentResponseLabel = useMemo(
    () => getOpponentResponseLabel(nextAction?.opponentResponse, nextAction?.opponentNextAction),
    [nextAction?.opponentNextAction, nextAction?.opponentResponse],
  );

  const renderPostSlotActions = useCallback(() => {
    if (effectivePostSlotStep === 'choose_not_played_action') {
      return (
        <>
          <Button
            onPress={() => handlePostSlotResponse({ nextAction: 'reschedule', outcome: 'not_played' })}
            style={ApplicationStyle.borderRadius24}
            title={isSubmitting ? 'Validation...' : 'Replanifier ce match'}
            variant="Primary"
          />
          <Button
            onPress={() => handlePostSlotResponse({ nextAction: 'cancel', outcome: 'not_played' })}
            style={ApplicationStyle.borderRadius24}
            title="Annuler le match"
            variant="Secondary"
          />
          <Button
            onPress={() => setPostSlotLocalStep(null)}
            style={ApplicationStyle.borderRadius24}
            title="Retour"
            variant="Secondary"
          />
        </>
      );
    }

    if (effectivePostSlotStep === 'confirm_reschedule') {
      return (
        <>
          <Button
            onPress={() => handlePostSlotResponse({ nextAction: 'reschedule', outcome: 'not_played' })}
            style={ApplicationStyle.borderRadius24}
            title={isSubmitting ? 'Validation...' : 'Confirmer la replanification'}
            variant="Primary"
          />
          <Button
            onPress={() => handlePostSlotResponse({ outcome: 'played' })}
            style={ApplicationStyle.borderRadius24}
            title="Le match a eu lieu"
            variant="Secondary"
          />
          <Button
            onPress={() => openMatchDetails()}
            style={ApplicationStyle.borderRadius24}
            title="Voir le match"
            variant="Secondary"
          />
        </>
      );
    }

    if (effectivePostSlotStep === 'confirm_cancel') {
      return (
        <>
          <Button
            onPress={() => handlePostSlotResponse({ nextAction: 'cancel', outcome: 'not_played' })}
            style={ApplicationStyle.borderRadius24}
            title={isSubmitting ? 'Validation...' : 'Confirmer l annulation'}
            variant="Primary"
          />
          <Button
            onPress={() => handlePostSlotResponse({ outcome: 'played' })}
            style={ApplicationStyle.borderRadius24}
            title="Le match a eu lieu"
            variant="Secondary"
          />
          <Button
            onPress={() => openMatchDetails()}
            style={ApplicationStyle.borderRadius24}
            title="Voir le match"
            variant="Secondary"
          />
        </>
      );
    }

    return (
      <>
        <Button
          onPress={() => handlePostSlotResponse({ outcome: 'played' })}
          style={ApplicationStyle.borderRadius24}
          title={isSubmitting ? 'Validation...' : 'Oui, le match a eu lieu'}
          variant="Primary"
        />
        <Button
          onPress={openPostSlotNoMatchChoices}
          style={ApplicationStyle.borderRadius24}
          title="Non, le match n a pas eu lieu"
          variant="Secondary"
        />
        <Button
          onPress={() => openMatchDetails()}
          style={ApplicationStyle.borderRadius24}
          title="Voir le match"
          variant="Secondary"
        />
      </>
    );
  }, [
    ApplicationStyle.borderRadius24,
    effectivePostSlotStep,
    handlePostSlotResponse,
    isSubmitting,
    openMatchDetails,
    openPostSlotNoMatchChoices,
  ]);

  const renderPromptActions = useCallback(() => {
    const state = String(nextAction?.state || '').trim().toLowerCase();
    const phase = String(nextAction?.match?.phase || '').trim().toLowerCase();
    const scoreActionKey = ['disputed', 'pending_validation', 'waiting_score'].includes(state) ? state : phase;
    const isScoreAction = ['disputed', 'pending_validation', 'waiting_score'].includes(scoreActionKey);

    const goToCanonicalScreen = () => {
      if (!nextActionMatchId) return;
      if (isScoreAction) {
        dismissThenOpenLeagueScoreFlow(nextActionMatchId);
        return;
      }

      if (state === 'waiting_venue') {
        openMatchDetails('venueBooking');
        return;
      }

      if (state === 'proposal_received') {
        openMatchDetails('negotiation');
        return;
      }

      openMatchDetails('timeline');
    };

    let primaryTitle = 'Ouvrir le match';
    if (scoreActionKey === 'pending_validation') {
      primaryTitle = 'Valider le score';
    } else if (scoreActionKey === 'disputed') {
      primaryTitle = 'Traiter le litige';
    } else if (scoreActionKey === 'waiting_score') {
      primaryTitle = 'Saisir le score';
    }

    if (state === 'post_slot_resolution') {
      return (
        <View style={{ gap: 12 }}>
          {renderPostSlotActions()}
        </View>
      );
    }

    if (state === 'opponent_found') {
      return (
        <View style={{ gap: 12 }}>
          <Button
            onPress={handleOpenProposalComposer}
            style={ApplicationStyle.borderRadius24}
            title={isSubmitting ? 'Envoi...' : 'Envoyer une proposition'}
            variant="Primary"
          />
          <Button
            onPress={() => openMatchDetails('negotiation')}
            style={ApplicationStyle.borderRadius24}
            title="Voir le match"
            variant="Secondary"
          />
        </View>
      );
    }

    if (state === 'proposal_received') {
      return (
        <View style={{ gap: 12 }}>
          <Button
            disabled={isSubmitting}
            onPress={handleAcceptProposal}
            style={ApplicationStyle.borderRadius24}
            title={isSubmitting ? 'Validation...' : 'Accepter'}
            variant="Primary"
          />
          <Button
            disabled={isSubmitting}
            onPress={handleDeclineProposal}
            style={ApplicationStyle.borderRadius24}
            title="Refuser"
            variant="Secondary"
          />
          <Button
            disabled={isSubmitting}
            onPress={openChat}
            style={ApplicationStyle.borderRadius24}
            title="Ouvrir le chat"
            variant="Secondary"
          />
        </View>
      );
    }

    if (state === 'waiting_venue') {
      return (
        <View style={{ gap: 12 }}>
          <Button
            disabled={isSubmitting}
            onPress={handleVenueReminder}
            style={ApplicationStyle.borderRadius24}
            title="Marquer terrain réservé"
            variant="Primary"
          />
          <Button
            disabled={isSubmitting}
            onPress={() => openMatchDetails('venueBooking')}
            style={ApplicationStyle.borderRadius24}
            title="Voir le match"
            variant="Secondary"
          />
        </View>
      );
    }

    return (
      <View style={{ gap: 12 }}>
        <Button
          onPress={goToCanonicalScreen}
          style={ApplicationStyle.borderRadius24}
          title={primaryTitle}
          variant="Primary"
        />
      </View>
    );
  }, [
    ApplicationStyle.borderRadius24,
    handleAcceptProposal,
    handleDeclineProposal,
    handleOpenProposalComposer,
    handleVenueReminder,
    isSubmitting,
    nextAction?.match?.phase,
    nextAction?.state,
    nextActionMatchId,
    openChat,
    dismissThenOpenLeagueScoreFlow,
    openMatchDetails,
    renderPostSlotActions,
  ]);

  if (!ENABLE_LEAGUE_ACTION_PROMPTS || !nextAction) return null;

  return (
    <>
      {shouldShowPrompt ? (
        <BottomModal
          close={dismissForSession}
          contentBottomPaddingOverride={6}
          isVisible={isVisible}
          preventStartupPresentation
          snapPoints={[modalSnapPoint]}
        >
          <View style={{ gap: sectionGap, paddingBottom: isCompactMobile ? 4 : 8 }}>
            <LeagueModalHeader
              align="left"
              description={promptBody}
              title={promptTitle}
            />

            <View
              style={[
                ApplicationStyle.borderRadius24,
                {
                  backgroundColor: 'rgba(10, 28, 43, 0.90)',
                  borderColor: 'rgba(1, 179, 244, 0.24)',
                  borderWidth: 1,
                  gap: 14,
                  padding: isCompactMobile ? 16 : 20,
                },
              ]}
            >
              <View style={{ gap: 6 }}>
                <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Adversaire</Text>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                  {shouldHideOpponentName ? 'Adversaire' : nextAction?.opponent?.name || 'Adversaire'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <View style={{
                  backgroundColor: `${Colors.primary500}18`,
                  borderColor: `${Colors.primary500}45`,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>{homeAwayLabel}</Text>
                </View>
                {nextAction?.division != null ? (
                  <View style={{
                    backgroundColor: `${Colors.gold500}16`,
                    borderColor: `${Colors.gold500}40`,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                      Division
                      {' '}
                      {nextAction.division}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 10 }}>
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  Date
                  {' : '}
                  <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{formatActionDate(nextAction?.date)}</Text>
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  Terrain
                  {' : '}
                  <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{nextAction?.venue || 'À définir'}</Text>
                </Text>
                {nextAction?.currentProposal?.status ? (
                  <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                    Statut
                    {' : '}
                    <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                      {nextAction.currentProposal.status === 'pending'
                        ? 'En attente'
                        : nextAction.currentProposal.status}
                    </Text>
                  </Text>
                ) : null}
                {isPostSlotResolution && nextAction?.opponentResponse ? (
                  <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                    Réponse adverse
                    {' : '}
                    <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                      {opponentResponseLabel}
                    </Text>
                  </Text>
                ) : null}
              </View>
            </View>

            {renderPromptActions()}

            <View
              style={{
                backgroundColor: `${Colors.neutral00}10`,
                borderColor: `${Colors.primary500}28`,
                borderRadius: 18,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={[Fonts.p4, { color: Colors.neutral200, textAlign: 'center' }]}>
                Si tu fermes ce rappel sans agir, il reviendra à la prochaine ouverture de l&apos;app tant que cet état reste actif.
              </Text>
            </View>
          </View>
        </BottomModal>
      ) : null}

      <VenueProposalModal
        durationMinutes={promptDurationMinutes}
        initialDate={proposalDefaults.date}
        initialEndTime={proposalDefaults.end}
        initialStartTime={proposalDefaults.start}
        isSubmitting={isSubmitting}
        isVisible={Boolean(isCounterProposalVisible && counterProposalPopup.canShow && canShowCounterProposalModal)}
        legalAcceptanceConfig={{
          metadata: {
            matchLabel: promptMatchLabel,
          },
          scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
          sourceScreen: 'league_action_prompt_counter_proposal',
          targetDocumentId: nextAction?.matchId || undefined,
          targetLabel: promptMatchLabel,
          targetType: 'league_match',
        }}
        onClose={() => {
          counterProposalPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
          setIsCounterProposalVisible(false);
          if (nextAction?.chatId) {
            navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
          }
        }}
        onSend={handleCounterProposalSend}
        onSkip={() => {
          counterProposalPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
          setIsCounterProposalVisible(false);
          if (nextAction?.chatId) {
            navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
          }
        }}
        venueRequired={promptVenueRequired}
      />
      {leagueLegalAcceptanceModal}
    </>
  );
}

export default LeagueActionPromptHost;
