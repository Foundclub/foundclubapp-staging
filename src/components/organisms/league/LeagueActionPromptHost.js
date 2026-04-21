import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  AppState,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

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
  navigate,
  navigationRef,
} from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { respondProposalMessage } from '@/services/chat/chatService';
import { usePendingLeagueAction } from '@/services/league/leagueActionQueries';
import {
  confirmMatch,
  createLeagueProposal,
  submitPostSlotResponse,
} from '@/services/league/leagueMatchService';

import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import {
  POPUP_DISMISS_SCOPES,
  POPUP_IDS,
} from '@/constants/popupRegistry';
import { useAppFeedback } from '@/context/AppFeedbackContext';
import { useBlockingOverlayPrompt } from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';

const END_MATCH_ROUTE = RouteNames.EndMatchScreen;
const LEAGUE_ACTION_PROMPT_STATES = new Set([
  'disputed',
  'opponent_found',
  'pending_validation',
  'post_slot_resolution',
  'proposal_received',
  'waiting_score',
  'waiting_venue',
]);

const BLOCKED_ROUTES = new Set([
  END_MATCH_ROUTE,
  RouteNames.Conversation,
  RouteNames.LeagueMatchDetails,
  RouteNames.MatchStatsEditor,
  RouteNames.PendingMatchStats,
  RouteNames.PlayerMatchResponse,
]);

const formatActionDate = (value) => {
  if (!value) return 'Date \u00E0 d\u00E9finir';
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'long',
    });
  } catch (_error) {
    return 'Date \u00E0 d\u00E9finir';
  }
};

const isAlreadyResolvedError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0);
  const code = String(error?.response?.data?.error?.code || error?.code || '');
  return status === 409 || code === 'ALREADY_RESOLVED';
};

const getOpponentResponseLabel = (opponentResponse, opponentNextAction) => {
  if (opponentResponse === 'played') {
    return 'Match jou\u00E9';
  }
  if (opponentNextAction === 'cancel') {
    return 'Match non jou\u00E9 - annulation propos\u00E9e';
  }
  if (opponentNextAction === 'reschedule') {
    return 'Match non jou\u00E9 - replanification propos\u00E9e';
  }
  return 'Match non jou\u00E9';
};

/**
 * @param {{ skipInitialFetch?: boolean }} [props]
 */
function LeagueActionPromptHost({ skipInitialFetch = false } = {}) {
  const queryClient = useQueryClient();
  const [{ auth }] = useAppContext();
  const [consumedForcedPromptKey, setConsumedForcedPromptKey] = useState(/** @type {string | null} */ (null));
  const [dismissedActionKey, setDismissedActionKey] = useState(/** @type {string | null} */ (null));
  const [currentRouteName, setCurrentRouteName] = useState(/** @type {string | null} */ (null));
  const [forcePromptToken, setForcePromptToken] = useState(/** @type {string | null} */ (null));
  const [isNavigationReady, setIsNavigationReady] = useState(navigationRef.isReady());
  const [isCounterProposalVisible, setIsCounterProposalVisible] = useState(false);
  const [postSlotLocalStep, setPostSlotLocalStep] = useState(/** @type {string | null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const appStateRef = useRef(AppState.currentState);
  const shownActionPromptKeyRef = useRef(/** @type {string | null} */ (null));
  const shownCounterProposalKeyRef = useRef(/** @type {string | null} */ (null));
  const { height, width } = useWindowDimensions();
  const {
    ApplicationStyle, Colors, Fonts,
  } = useTheme();
  const { showBanner } = useAppFeedback();

  const {
    data: pendingActionPayload,
    refetch,
  } = usePendingLeagueAction(undefined, {
    enabled: Boolean(auth?.token) && !skipInitialFetch,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const nextAction = pendingActionPayload?.nextAction || null;
  const isBlockedRoute = currentRouteName ? BLOCKED_ROUTES.has(currentRouteName) : false;
  const isCompactMobile = width < 390 || height < 760;
  const modalSnapPoint = isCompactMobile ? '90%' : '84%';
  const sectionGap = isCompactMobile ? 12 : 16;
  const currentForcedPromptKey = nextAction?.key && forcePromptToken
    ? `${nextAction.key}:${forcePromptToken}`
    : null;
  const isForcedForCurrentAction = Boolean(
    currentForcedPromptKey && consumedForcedPromptKey !== currentForcedPromptKey,
  );
  const shouldShowPrompt = Boolean(
    auth?.token
    && nextAction
    && isNavigationReady
    && !isBlockedRoute
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
  const shouldHideOpponentName = useMemo(
    () => shouldMaskOpponentIdentity(nextAction?.match || null),
    [nextAction?.match],
  );
  const promptMatchLabel = useMemo(() => {
    const opponent = shouldHideOpponentName ? 'Adversaire' : (nextAction?.opponent?.name || 'Adversaire');
    return `Votre squad VS ${opponent}`;
  }, [nextAction?.opponent?.name, shouldHideOpponentName]);

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
    leagueActionPopup.markShown({ actionKey: nextAction.key });
  }, [isVisible, leagueActionPopup, nextAction?.key]);

  useEffect(() => {
    const counterProposalKey = `${nextAction?.key || 'default'}:${isCounterProposalVisible ? 'visible' : 'hidden'}`;
    if (!isCounterProposalVisible || !counterProposalPopup.canShow || !canShowCounterProposalModal) {
      shownCounterProposalKeyRef.current = null;
      return;
    }
    if (shownCounterProposalKeyRef.current === counterProposalKey) return;
    shownCounterProposalKeyRef.current = counterProposalKey;
    counterProposalPopup.markShown({ actionKey: nextAction?.key || 'default' });
  }, [canShowCounterProposalModal, counterProposalPopup, isCounterProposalVisible, nextAction?.key]);

  const invalidateLeagueQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pendingLeagueAction'] });
    queryClient.invalidateQueries({ queryKey: ['leagueMatchStats'] });
    queryClient.invalidateQueries({ queryKey: ['leagueMyMatchResponse'] });
    queryClient.invalidateQueries({ queryKey: ['leagueTeamPerformanceStats'] });
    queryClient.invalidateQueries({ queryKey: ['chats'] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
  }, [queryClient]);

  const openMatchDetails = useCallback((focusSection = undefined) => {
    if (!nextAction?.matchId) return;
    dismissForSession();
    navigate(RouteNames.LeagueMatchDetails, {
      ...(focusSection ? { focusSection } : {}),
      matchId: nextAction.matchId,
    });
  }, [dismissForSession, nextAction?.matchId]);

  const openChat = useCallback(() => {
    if (!nextAction?.chatId) return;
    dismissForSession();
    navigate(RouteNames.Conversation, {
      chatId: nextAction.chatId,
      focusLatestProposal: true,
      focusProposalMessageId: nextAction?.proposalMessageId || undefined,
      leagueNegotiationFocusToken: String(Date.now()),
      subTitle: 'N\u00E9gociation du match en cours',
    });
  }, [dismissForSession, nextAction?.chatId, nextAction?.proposalMessageId]);

  const handleResolvedElsewhere = useCallback(async () => {
    await invalidateLeagueQueries();
    await refetch();
    dismissForSession();

    if (nextAction?.state === 'waiting_venue' || nextAction?.matchId) {
      navigate(RouteNames.LeagueMatchDetails, {
        focusSection: 'venueBooking',
        matchId: nextAction?.matchId,
      });
      return;
    }

    if (nextAction?.chatId) {
      navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
    }
  }, [dismissForSession, invalidateLeagueQueries, nextAction?.chatId, nextAction?.matchId, nextAction?.state, refetch]);

  const handleAcceptProposal = useCallback(async () => {
    if (!nextAction?.matchId || isSubmitting) return;
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
      await confirmMatch(nextAction.matchId, { legalAcceptance });
      if (nextAction?.proposalMessageId) {
        await respondProposalMessage(nextAction.proposalMessageId, 'accepted');
      }
      await invalidateLeagueQueries();
      dismissForSession();
      navigate(RouteNames.LeagueMatchDetails, {
        focusSection: 'venueBooking',
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
    promptMatchLabel,
    requestLeagueLegalAcceptance,
    showBanner,
  ]);

  const handleDeclineProposal = useCallback(async () => {
    if (!nextAction?.proposalMessageId || isSubmitting) {
      setIsCounterProposalVisible(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await respondProposalMessage(nextAction.proposalMessageId, 'declined');
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
  }, [dismissForSession, handleResolvedElsewhere, invalidateLeagueQueries, isSubmitting, nextAction?.proposalMessageId, showBanner]);

  const handleOpenProposalComposer = useCallback(() => {
    dismissForSession();
    setIsCounterProposalVisible(true);
  }, [dismissForSession]);

  const handleCounterProposalSend = useCallback(async (proposalData) => {
    if (!nextAction?.matchId || isSubmitting) return;

    try {
      const proposalPayload = buildCanonicalLeagueProposalPayload(proposalData);
      if (!proposalPayload.venueLabel) {
        throw new Error('Missing proposal venue');
      }
      const legalAcceptance = await requestLeagueLegalAcceptance({
        metadata: {
          matchLabel: promptMatchLabel,
          venueLabel: proposalPayload.venueLabel,
        },
        scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
        sourceScreen: 'league_action_prompt_counter_proposal',
        targetDocumentId: nextAction.matchId,
        targetLabel: promptMatchLabel,
        targetType: 'league_match',
      });
      if (!legalAcceptance) return;

      setIsSubmitting(true);
      const result = await createLeagueProposal(nextAction.matchId, proposalPayload, { legalAcceptance });
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
    requestLeagueLegalAcceptance,
    showBanner,
  ]);

  const handleVenueReminder = useCallback(() => {
    if (!nextAction?.matchId) return;
    dismissForSession();
    navigate(RouteNames.LeagueMatchDetails, {
      focusSection: 'venueBooking',
      matchId: nextAction.matchId,
    });
  }, [dismissForSession, nextAction?.matchId]);

  const openLeagueScoreFlow = useCallback((matchId) => {
    if (!matchId) return;
    navigate(RouteNames.LeagueHomeTab, {
      params: {
        params: { matchId },
        screen: END_MATCH_ROUTE,
      },
      screen: RouteNames.LeagueDashboard,
    });
  }, []);

  const handlePostSlotResponse = useCallback(async (payload) => {
    if (!nextAction?.matchId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await submitPostSlotResponse(nextAction.matchId, payload);
      await invalidateLeagueQueries();
      setPostSlotLocalStep(null);
      dismissForSession();

      const resolution = String(response?.resolution || '').trim().toLowerCase();
      if (resolution === 'score_flow') {
        openLeagueScoreFlow(nextAction.matchId);
        return;
      }
      if (resolution === 'rescheduled') {
        if (nextAction?.chatId) {
          navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
          return;
        }
        navigate(RouteNames.LeagueMatchDetails, { matchId: nextAction.matchId });
        return;
      }
      if (['auto_cancelled', 'cancelled', 'disputed'].includes(resolution)) {
        navigate(RouteNames.LeagueMatchDetails, { matchId: nextAction.matchId });
      }
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        await handleResolvedElsewhere();
        return;
      }
      const serverMessage = String(
        error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || '',
      ).trim();
      showBanner({
        body: serverMessage || "Impossible d'enregistrer cette r\u00E9ponse.",
        title: 'Erreur',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [dismissForSession, handleResolvedElsewhere, invalidateLeagueQueries, isSubmitting, nextAction?.chatId, nextAction?.matchId, openLeagueScoreFlow, showBanner]);

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
        setForcePromptToken(null);
        return;
      }

      const currentRoute = navigationRef.getCurrentRoute?.();
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

      if (wasBackground && nextState === 'active') {
        setDismissedActionKey(null);
        refetch();
      }
    });

    return () => subscription.remove();
  }, [auth?.token, refetch]);

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
  let promptBody = "Une proposition de match attend une r\u00E9ponse de votre squad. Consultez les d\u00E9tails avant d'accepter ou de refuser.";
  if (isScorePrompt) {
    if (promptScoreActionKey === 'pending_validation') {
      promptTitle = 'Score a valider';
      promptBody = 'Un score attend votre validation. Confirmez ou contestez le resultat pour finaliser le match League.';
    } else if (promptScoreActionKey === 'disputed') {
      promptTitle = 'Litige score';
      promptBody = 'Un litige est ouvert sur le score. Traitez le score pour debloquer la suite League.';
    } else {
      promptTitle = 'Score a saisir';
      promptBody = 'Le match est joue. Saisissez le score final pour lancer la validation League.';
    }
  } else if (isWaitingVenue) {
    promptTitle = 'Terrain \u00E0 r\u00E9server';
    promptBody = "Le match est confirm\u00E9, mais le terrain n'est pas encore r\u00E9serv\u00E9. Pensez \u00E0 finaliser l'organisation.";
  } else if (isOpponentFound) {
    promptTitle = 'Adversaire trouv\u00E9';
    promptBody = 'Un match compatible est cr\u00E9\u00E9. Envoyez la premi\u00E8re proposition de terrain et de cr\u00E9neau pour lancer la n\u00E9gociation.';
  }
  if (isPostSlotResolution) {
    if (effectivePostSlotStep === 'confirm_reschedule') {
      promptTitle = 'Confirmer la replanification ?';
      promptBody = "L'adversaire indique que le match n'a pas eu lieu et propose de replanifier ce m\u00EAme match.";
    } else if (effectivePostSlotStep === 'confirm_cancel') {
      promptTitle = 'Confirmer l annulation ?';
      promptBody = "L'adversaire indique que le match n'a pas eu lieu et propose d'annuler ce match sans p\u00E9nalit\u00E9.";
    } else if (effectivePostSlotStep === 'choose_not_played_action') {
      promptTitle = 'Le match n a pas eu lieu';
      promptBody = 'Choisissez la suite \u00E0 donner a ce match : replanifier avec le meme adversaire ou annuler sans p\u00E9nalit\u00E9.';
    } else {
      promptTitle = 'Le match a-t-il eu lieu ?';
      promptBody = 'Le cr\u00E9neau est d\u00E9pass\u00E9 sans terrain confirm\u00E9. Les capitaines doivent confirmer si le match a eu lieu.';
    }
  }
  let homeAwayLabel = 'Match League';
  if (nextAction?.homeAway === 'home') {
    homeAwayLabel = 'Domicile';
  } else if (nextAction?.homeAway === 'away') {
    homeAwayLabel = 'Ext\u00E9rieur';
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
      if (!nextAction?.matchId) return;
      if (isScoreAction) {
        dismissForSession();
        openLeagueScoreFlow(nextAction.matchId);
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
            title="Marquer terrain reserve"
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
    dismissForSession,
    handleAcceptProposal,
    handleDeclineProposal,
    handleOpenProposalComposer,
    handleVenueReminder,
    isSubmitting,
    nextAction?.match?.phase,
    nextAction?.matchId,
    nextAction?.state,
    openChat,
    openLeagueScoreFlow,
    openMatchDetails,
    renderPostSlotActions,
  ]);

  if (!nextAction) return null;

  return (
    <>
      <BottomModal
        contentBottomPaddingOverride={6}
        isVisible={isVisible}
        onClose={dismissForSession}
        snapPoint={modalSnapPoint}
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
                <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{nextAction?.venue || '\u00C0 d\u00E9finir'}</Text>
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
                  Reponse adverse
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
              Si vous fermez ce rappel sans agir, il reviendra a la prochaine ouverture de l&apos;app tant que cet etat reste actif.
            </Text>
          </View>
        </View>
      </BottomModal>

      <VenueProposalModal
        initialDate={proposalDefaults.date}
        initialEndTime={proposalDefaults.end}
        initialStartTime={proposalDefaults.start}
        isVisible={Boolean(isCounterProposalVisible && counterProposalPopup.canShow && canShowCounterProposalModal)}
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
      />
      {leagueLegalAcceptanceModal}
    </>
  );
}

export default LeagueActionPromptHost;
