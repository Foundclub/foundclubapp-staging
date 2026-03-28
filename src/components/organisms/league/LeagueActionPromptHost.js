import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert,
  AppState,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import { shouldMaskOpponentIdentity } from '@/views/league/match/utils/matchStatus';
import { buildProposalDefaultsFromMatch } from '@/views/league/match/utils/proposalDefaults';
import { buildLeagueProposalPayload } from '@/views/league/match/utils/proposalPayload';

import {
  getCurrentRouteName,
  navigate,
  navigationRef,
} from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { createChatMessage, respondProposalMessage } from '@/services/chat/chatService';
import { usePendingLeagueAction } from '@/services/league/leagueActionQueries';
import {
  confirmMatch,
  submitPostSlotResponse,
  updateMatch,
} from '@/services/league/leagueMatchService';

import { useBlockingOverlayPrompt } from '@/context/BlockingOverlayContext';

const END_MATCH_ROUTE = 'EndMatchScreen';

const BLOCKED_ROUTES = new Set([
  END_MATCH_ROUTE,
  RouteNames.Conversation,
  RouteNames.LeagueMatchDetails,
  RouteNames.MatchStatsEditor,
  RouteNames.PendingMatchStats,
  RouteNames.PlayerMatchResponse,
]);

const formatActionDate = (value) => {
  if (!value) return 'Date a definir';
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'long',
    });
  } catch (_error) {
    return 'Date a definir';
  }
};

const isAlreadyResolvedError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0);
  const code = String(error?.response?.data?.error?.code || error?.code || '');
  return status === 409 || code === 'ALREADY_RESOLVED';
};

const getOpponentResponseLabel = (opponentResponse, opponentNextAction) => {
  if (opponentResponse === 'played') {
    return 'Match joue';
  }
  if (opponentNextAction === 'cancel') {
    return 'Match non joue - annulation proposee';
  }
  if (opponentNextAction === 'reschedule') {
    return 'Match non joue - replanification proposee';
  }
  return 'Match non joue';
};

/**
 *
 */
function LeagueActionPromptHost() {
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
  const appStateRef = useRef(AppState.currentState);
  const { height, width } = useWindowDimensions();
  const {
    ApplicationStyle, Colors, Fonts,
  } = useTheme();

  const {
    data: pendingActionPayload,
    refetch,
  } = usePendingLeagueAction(undefined, {
    enabled: Boolean(auth?.token),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const nextAction = pendingActionPayload?.nextAction || null;
  const isBlockedRoute = currentRouteName ? BLOCKED_ROUTES.has(currentRouteName) : false;
  const isCompactMobile = width < 390 || height < 760;
  const modalSnapPoint = isCompactMobile ? '86%' : '78%';
  const sectionGap = isCompactMobile ? 16 : 20;
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
    && ['post_slot_resolution', 'proposal_received', 'waiting_venue'].includes(String(nextAction?.state || ''))
    && (dismissedActionKey !== (nextAction?.key || null) || isForcedForCurrentAction),
  );
  const canShowLeagueActionPrompt = useBlockingOverlayPrompt(
    'league-action-prompt',
    shouldShowPrompt,
    70,
  );
  const canShowCounterProposalModal = useBlockingOverlayPrompt(
    'league-counter-proposal',
    isCounterProposalVisible,
    75,
  );
  const isVisible = shouldShowPrompt && canShowLeagueActionPrompt;

  const dismissForSession = useCallback(() => {
    if (currentForcedPromptKey) {
      setConsumedForcedPromptKey(currentForcedPromptKey);
    }
    if (nextAction?.key) {
      setDismissedActionKey(nextAction.key);
    }
    setPostSlotLocalStep(null);
  }, [currentForcedPromptKey, nextAction?.key]);

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
      subTitle: 'Negociation du match en cours',
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
    setIsSubmitting(true);
    try {
      await confirmMatch(nextAction.matchId);
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
      Alert.alert('Erreur', "Impossible d'accepter la proposition.");
    } finally {
      setIsSubmitting(false);
    }
  }, [dismissForSession, handleResolvedElsewhere, invalidateLeagueQueries, isSubmitting, nextAction?.matchId, nextAction?.proposalMessageId]);

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
      Alert.alert('Erreur', 'Impossible de refuser la proposition.');
    } finally {
      setIsSubmitting(false);
    }
  }, [dismissForSession, handleResolvedElsewhere, invalidateLeagueQueries, isSubmitting, nextAction?.proposalMessageId]);

  const handleCounterProposalSend = useCallback(async (proposalData) => {
    if (!nextAction?.matchId || !nextAction?.chatId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload = buildLeagueProposalPayload(nextAction.matchId, proposalData);
      await updateMatch(nextAction.matchId, payload.matchUpdate);
      await createChatMessage({
        chatId: nextAction.chatId,
        composition: payload.message.composition,
        message: payload.message.message,
      });
      await invalidateLeagueQueries();
      setIsCounterProposalVisible(false);
      dismissForSession();
      navigate(RouteNames.Conversation, {
        chatId: nextAction.chatId,
        focusLatestProposal: true,
        leagueNegotiationFocusToken: String(Date.now()),
      });
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'envoyer la contre-proposition.");
    } finally {
      setIsSubmitting(false);
    }
  }, [dismissForSession, invalidateLeagueQueries, isSubmitting, nextAction?.chatId, nextAction?.matchId]);

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
      Alert.alert(
        'Erreur',
        serverMessage || "Impossible d'enregistrer cette reponse.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [dismissForSession, handleResolvedElsewhere, invalidateLeagueQueries, isSubmitting, nextAction?.chatId, nextAction?.matchId, openLeagueScoreFlow]);

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

  const isWaitingVenue = nextAction?.state === 'waiting_venue';
  const isPostSlotResolution = nextAction?.state === 'post_slot_resolution';
  const effectivePostSlotStep = postSlotLocalStep || nextAction?.step || 'ask_happened';
  let promptTitle = isWaitingVenue ? 'Terrain a reserver' : 'Nouvelle proposition League';
  let promptBody = isWaitingVenue
    ? "Le match est confirme, mais le terrain n'est pas encore reserve. Pensez a finaliser l'organisation."
    : "Une proposition de match attend une reponse de votre squad. Consultez les details avant d'accepter ou de refuser.";
  if (isPostSlotResolution) {
    if (effectivePostSlotStep === 'confirm_reschedule') {
      promptTitle = 'Confirmer la replanification ?';
      promptBody = "L'adversaire indique que le match n'a pas eu lieu et propose de replanifier ce meme match.";
    } else if (effectivePostSlotStep === 'confirm_cancel') {
      promptTitle = 'Confirmer l annulation ?';
      promptBody = "L'adversaire indique que le match n'a pas eu lieu et propose d'annuler ce match sans penalite.";
    } else if (effectivePostSlotStep === 'choose_not_played_action') {
      promptTitle = 'Le match n a pas eu lieu';
      promptBody = 'Choisissez la suite a donner a ce match : replanifier avec le meme adversaire ou annuler sans penalite.';
    } else {
      promptTitle = 'Le match a-t-il eu lieu ?';
      promptBody = 'Le creneau est depasse sans terrain confirme. Les capitaines doivent confirmer si le match a eu lieu.';
    }
  }
  let homeAwayLabel = 'Match League';
  if (nextAction?.homeAway === 'home') {
    homeAwayLabel = 'Domicile';
  } else if (nextAction?.homeAway === 'away') {
    homeAwayLabel = 'Exterieur';
  }
  const proposalDefaults = useMemo(
    () => buildProposalDefaultsFromMatch(nextAction?.match || null),
    [nextAction?.match],
  );
  const shouldHideOpponentName = shouldMaskOpponentIdentity(nextAction?.match || null);
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
    if (nextAction?.state === 'proposal_received') {
      return (
        <View style={{ gap: 12 }}>
          <Button
            onPress={handleAcceptProposal}
            style={ApplicationStyle.borderRadius24}
            title={isSubmitting ? 'Validation...' : 'Accepter'}
            variant="Primary"
          />
          <Button
            onPress={handleDeclineProposal}
            style={ApplicationStyle.borderRadius24}
            title="Refuser"
            variant="Secondary"
          />
          <Button
            onPress={() => openMatchDetails('negotiation')}
            style={ApplicationStyle.borderRadius24}
            title="Voir tous les details"
            variant="Secondary"
          />
          <Button
            onPress={openChat}
            style={ApplicationStyle.borderRadius24}
            title="Ouvrir le chat"
            variant="Secondary"
          />
        </View>
      );
    }

    if (nextAction?.state === 'post_slot_resolution') {
      return (
        <View style={{ gap: 12 }}>
          {renderPostSlotActions()}
        </View>
      );
    }

    return (
      <View style={{ gap: 12 }}>
        <Button
          onPress={handleVenueReminder}
          style={ApplicationStyle.borderRadius24}
          title="Reserver le terrain"
          variant="Primary"
        />
        <Button
          onPress={() => openMatchDetails('venueBooking')}
          style={ApplicationStyle.borderRadius24}
          title="Voir le match"
          variant="Secondary"
        />
      </View>
    );
  }, [
    ApplicationStyle.borderRadius24,
    handleAcceptProposal,
    handleDeclineProposal,
    handleVenueReminder,
    isSubmitting,
    nextAction?.state,
    openChat,
    openMatchDetails,
    renderPostSlotActions,
  ]);

  if (!nextAction) return null;

  return (
    <>
      <BottomModal
        isVisible={isVisible}
        onClose={dismissForSession}
        snapPoint={modalSnapPoint}
      >
        <View style={{ gap: sectionGap, paddingBottom: isCompactMobile ? 12 : 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Signal League</Text>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>{promptTitle}</Text>
            <Text style={[Fonts.p2, { color: Colors.neutral200, lineHeight: 24 }]}>{promptBody}</Text>
          </View>

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
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{formatActionDate(nextAction?.date)}</Text>
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                Terrain
                {' : '}
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{nextAction?.venue || 'A definir'}</Text>
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
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral200, textAlign: 'center' }]}>
              Si vous fermez ce rappel sans agir, il reviendra a la prochaine ouverture de l&apos;app tant que cet etat reste actif.
            </Text>
          </View>
        </View>
      </BottomModal>

      <VenueProposalModal
        initialDate={proposalDefaults.date}
        initialEndTime={proposalDefaults.end}
        initialStartTime={proposalDefaults.start}
        isVisible={isCounterProposalVisible && canShowCounterProposalModal}
        onClose={() => {
          setIsCounterProposalVisible(false);
          if (nextAction?.chatId) {
            navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
          }
        }}
        onSend={handleCounterProposalSend}
        onSkip={() => {
          setIsCounterProposalVisible(false);
          if (nextAction?.chatId) {
            navigate(RouteNames.Conversation, { chatId: nextAction.chatId });
          }
        }}
      />
    </>
  );
}

export default LeagueActionPromptHost;
