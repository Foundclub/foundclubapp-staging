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

import {
  getCurrentRouteName,
  navigate,
  navigationRef,
} from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { useGetPendingMatchStatsPrompts } from '@/services/matchStats/matchStatsQueries';

import {
  POPUP_DISMISS_SCOPES,
  POPUP_IDS,
} from '@/constants/popupRegistry';
import { ENABLE_MATCH_STATS_PROMPTS } from '@/constants/runtimeFlags';
import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';

const BLOCKED_ROUTES = new Set([
  RouteNames.EventDetails,
  RouteNames.LeagueMatchDetails,
  RouteNames.MatchStatsEditor,
  RouteNames.PendingMatchStats,
  RouteNames.PlayerMatchResponse,
]);

const formatPromptDate = (value) => {
  if (!value) return 'Date indisponible';

  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'long',
    });
  } catch (_error) {
    return 'Date indisponible';
  }
};

const getPromptStatusMeta = (prompt, Colors) => {
  if (prompt?.actionType === 'player_self_report') {
    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: prompt?.state === 'draft' ? 'Brouillon perso' : 'A repondre',
      textColor: Colors.primary500,
    };
  }

  if (prompt?.reviewRequired) {
    return {
      backgroundColor: `${Colors.warning500}20`,
      borderColor: `${Colors.warning500}45`,
      label: 'Verification requise',
      textColor: Colors.warning500,
    };
  }

  if (prompt?.reportStatus === 'draft') {
    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: 'Brouillon en cours',
      textColor: Colors.primary500,
    };
  }

  if (prompt?.score?.waitingOfficial) {
    return {
      backgroundColor: `${Colors.gold500}20`,
      borderColor: `${Colors.gold500}45`,
      label: 'Score officiel en attente',
      textColor: Colors.gold500,
    };
  }

  if (prompt?.score?.available) {
    return {
      backgroundColor: `${Colors.success500}20`,
      borderColor: `${Colors.success500}45`,
      label: 'A finaliser',
      textColor: Colors.success500,
    };
  }

  return {
    backgroundColor: `${Colors.neutral00}14`,
    borderColor: `${Colors.neutral00}24`,
    label: 'Score a completer',
    textColor: Colors.neutral00,
  };
};

const navigateToPendingMatchStats = (prompt, overrides = {}) => {
  if (!prompt) return false;

  const commonParams = {
    ...(prompt?.sourceType === 'event' ? { eventId: prompt?.eventId } : { matchId: prompt?.matchId }),
    matchLabel: prompt?.label || 'Match',
    sourceType: prompt?.sourceType === 'league' ? 'league' : 'event',
    sport: prompt?.sport || 'football',
    teamId: prompt?.team?.documentId || undefined,
    teamName: prompt?.team?.name || null,
  };
  const targetScreen = prompt?.actionType === 'player_self_report'
    ? RouteNames.PlayerMatchResponse
    : RouteNames.MatchStatsEditor;
  const screenParams = {
    ...commonParams,
    ...overrides,
    actionType: prompt?.actionType || 'coach_team_review',
    actorRole: prompt?.actorRole || 'player',
    title: prompt?.actionType === 'player_self_report' ? 'Mon retour post-match' : 'Bilan equipe',
  };

  if (prompt?.sourceType === 'league') {
    return navigate(RouteNames.LeagueHomeTab, {
      params: {
        params: screenParams,
        screen: targetScreen,
      },
      screen: RouteNames.LeagueDashboard,
    });
  }

  return navigate(RouteNames.EventStack, {
    params: screenParams,
    screen: targetScreen,
  });
};

const openPendingMatchStatsList = () => navigate(RouteNames.EventStack, {
  screen: RouteNames.PendingMatchStats,
});

/**
 * @param {{ skipInitialFetch?: boolean }} [props]
 */
function MatchStatsPromptHost({ skipInitialFetch = false } = {}) {
  const [{ auth }] = useAppContext();
  const queryClient = useQueryClient();
  const [dismissedPromptKey, setDismissedPromptKey] = useState(/** @type {string | null} */ (null));
  const [currentRouteName, setCurrentRouteName] = useState(/** @type {string | null} */ (null));
  const [isNavigationReady, setIsNavigationReady] = useState(navigationRef.isReady());
  const appStateRef = useRef(AppState.currentState);
  const shownPromptKeyRef = useRef(/** @type {string | null} */ (null));
  const { height, width } = useWindowDimensions();

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const {
    data: pendingPromptsPayload,
    refetch,
  } = useGetPendingMatchStatsPrompts({
    enabled: ENABLE_MATCH_STATS_PROMPTS && Boolean(auth?.token) && !skipInitialFetch,
    refetchInterval: auth?.token ? 60000 : false,
    refetchIntervalInBackground: false,
  });

  const nextPrompt = pendingPromptsPayload?.nextPrompt || null;
  const totalPending = Number(pendingPromptsPayload?.totalPending || 0);
  const isBlockedRoute = currentRouteName ? BLOCKED_ROUTES.has(currentRouteName) : false;
  const isCompactMobile = width < 390 || height < 760;
  const statusMeta = useMemo(() => getPromptStatusMeta(nextPrompt, Colors), [Colors, nextPrompt]);
  const modalSnapPoint = isCompactMobile ? '88%' : '82%';
  const shouldShowPrompt = Boolean(
    ENABLE_MATCH_STATS_PROMPTS
    && auth?.token
    && nextPrompt
    && isNavigationReady
    && !isBlockedRoute
    && (!dismissedPromptKey || dismissedPromptKey !== nextPrompt.key),
  );
  const matchStatsPopup = usePopupEligibility(
    POPUP_IDS.MATCH_STATS_PROMPT,
    shouldShowPrompt,
    {
      cooldownKey: nextPrompt?.key || 'default',
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const canShowPrompt = useBlockingOverlayPrompt(
    matchStatsPopup.descriptor.id,
    matchStatsPopup.canShow,
    matchStatsPopup.descriptor.priority,
  );
  const isVisible = Boolean(shouldShowPrompt && matchStatsPopup.canShow && canShowPrompt);
  useBlockingOverlayLifecycle(matchStatsPopup.descriptor.id, isVisible, {
    releaseDelayMs: 360,
  });
  const sectionGap = isCompactMobile ? 16 : 24;
  const titleGap = isCompactMobile ? 12 : 16;
  const cardPadding = isCompactMobile ? 16 : 24;
  const cardGap = isCompactMobile ? 12 : 16;
  const buttonStackGap = isCompactMobile ? 16 : 24;
  const statusBadgePadding = isCompactMobile ? 8 : 12;
  const helperLineHeight = isCompactMobile ? 24 : 26;
  const sectionOffset = isCompactMobile ? 8 : 12;
  const summaryBannerPaddingHorizontal = isCompactMobile ? 16 : 24;
  const summaryBannerPaddingVertical = isCompactMobile ? 12 : 16;
  const modalButtonStyle = useMemo(
    () => [
      ApplicationStyle.borderRadius24,
      {
        minHeight: isCompactMobile ? 54 : 56,
      },
    ],
    [ApplicationStyle.borderRadius24, isCompactMobile],
  );
  const footerButtonStyle = useMemo(
    () => [
      ...modalButtonStyle,
      {
        marginBottom: isCompactMobile ? 4 : 0,
      },
    ],
    [isCompactMobile, modalButtonStyle],
  );

  const primaryActionTitle = useMemo(() => {
    if (!nextPrompt) return 'Ouvrir';
    if (nextPrompt?.actionType === 'player_self_report') {
      return nextPrompt?.state === 'draft' ? 'Reprendre ma reponse' : 'Renseigner mes stats';
    }
    if (nextPrompt?.reviewRequired) return 'Mettre a jour apres score officiel';
    if (nextPrompt?.reportStatus === 'draft') return 'Reprendre le brouillon';
    if (nextPrompt?.score?.available) return 'Saisir les stats du match';
    return 'Enregistrer le score';
  }, [nextPrompt]);

  const helperText = useMemo(() => {
    if (!nextPrompt) return '';
    if (nextPrompt?.actionType === 'player_self_report') {
      if (nextPrompt?.state === 'draft') {
        return 'Ton retour perso post-match est deja commence. Reprends-le quand tu veux pour finaliser tes stats et ta note.';
      }
      return 'Ton match est termine. Renseigne tes stats individuelles si tu les connais, puis laisse une note sur 10 et ton ressenti.';
    }
    if (nextPrompt?.reviewRequired) {
      return 'Le score officiel a change apres une premiere saisie. Verifie les lignes puis republie la bonne version.';
    }
    if (nextPrompt?.reportStatus === 'draft') {
      return 'Un brouillon post-match existe deja pour cette equipe. Il attend encore d etre finalise.';
    }
    if (nextPrompt?.score?.available) {
      return 'Le score est pret. Il reste a completer le temps de jeu et les statistiques cles de ton equipe.';
    }
    return 'Le match est termine. Commence par enregistrer le score, puis complete les statistiques de ton equipe.';
  }, [nextPrompt]);

  const scoreLabel = useMemo(() => {
    if (!nextPrompt?.score?.available) return nextPrompt?.actionType === 'player_self_report' ? 'Score en attente' : 'Score a completer';
    return `${nextPrompt?.score?.scoreFor ?? '-'} - ${nextPrompt?.score?.scoreAgainst ?? '-'}`;
  }, [nextPrompt]);
  const promptSourceLabel = useMemo(() => {
    if (nextPrompt?.actionType === 'player_self_report') return 'Retour perso';
    if (nextPrompt?.sourceType === 'league') return 'Ligue';
    return 'Evenement';
  }, [nextPrompt?.actionType, nextPrompt?.sourceType]);

  const dismissPromptForSession = useCallback(() => {
    if (nextPrompt?.key) {
      setDismissedPromptKey(nextPrompt.key);
    }
    matchStatsPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
  }, [matchStatsPopup, nextPrompt?.key]);

  useEffect(() => {
    if (!isVisible || !nextPrompt?.key) {
      shownPromptKeyRef.current = null;
      return;
    }
    if (shownPromptKeyRef.current === nextPrompt.key) return;
    shownPromptKeyRef.current = nextPrompt.key;
    matchStatsPopup.markShown({ promptKey: nextPrompt.key });
  }, [isVisible, matchStatsPopup, nextPrompt?.key]);

  const handleOpenEditor = useCallback(() => {
    if (!nextPrompt) return;

    dismissPromptForSession();
    navigateToPendingMatchStats(nextPrompt);
  }, [dismissPromptForSession, nextPrompt]);
  const handleOpenUnknownStatsFlow = useCallback(() => {
    if (!nextPrompt || nextPrompt?.actionType !== 'player_self_report') return;

    dismissPromptForSession();
    navigateToPendingMatchStats(nextPrompt, { forceUnknownStats: true });
  }, [dismissPromptForSession, nextPrompt]);

  useEffect(() => {
    if (!auth?.token) {
      setDismissedPromptKey(null);
      return undefined;
    }

    const syncCurrentRoute = () => {
      setIsNavigationReady(navigationRef.isReady());
      setCurrentRouteName(getCurrentRouteName());
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
        setDismissedPromptKey(null);
        queryClient.invalidateQueries({ queryKey: ['pendingMatchStatsPrompts'] });
        refetch();
      }
    });

    return () => subscription.remove();
  }, [auth?.token, queryClient, refetch]);

  if (!ENABLE_MATCH_STATS_PROMPTS || !auth?.token || !nextPrompt) {
    return null;
  }

  return (
    <BottomModal
      close={dismissPromptForSession}
      contentContainerStyle={{
        paddingBottom: isCompactMobile ? 20 : 24,
        paddingTop: isCompactMobile ? 10 : 14,
      }}
      footerComponent={(
        <Button
          onPress={dismissPromptForSession}
          style={footerButtonStyle}
          title="Plus tard"
          variant="Secondary"
        />
      )}
      isVisible={isVisible}
      preventStartupPresentation
      snapPoints={[modalSnapPoint]}
    >
      <View style={[Spaces.gap[sectionGap], Spaces.paddingBottom[isCompactMobile ? 20 : 24]]}>
        <View style={[Spaces.gap[titleGap]]}>
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>Rappel post-match</Text>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {nextPrompt?.actionType === 'player_self_report' ? 'Ton match est termine' : 'Bilan de fin de match'}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, { lineHeight: helperLineHeight, maxWidth: '96%' }]}>
            {helperText}
          </Text>
        </View>

        <View style={{ paddingBottom: sectionOffset / 2, paddingTop: sectionOffset / 2 }}>
          <View
            style={[
              ApplicationStyle.card,
              ApplicationStyle.borderRadius24,
              Spaces.padding[cardPadding],
              Spaces.gap[cardGap],
              {
                backgroundColor: `${Colors.primary700}CC`,
                borderColor: `${Colors.primary500}75`,
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[16]]}>
              <View style={[{ flex: 1 }, Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>Match</Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nextPrompt?.label || 'Match'}</Text>
              </View>
              <View
                style={[
                  Spaces.paddingHorizontal[statusBadgePadding],
                  Spaces.paddingVertical[8],
                  {
                    backgroundColor: statusMeta.backgroundColor,
                    borderColor: statusMeta.borderColor,
                    borderRadius: 999,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: statusMeta.textColor }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>

            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[16]]}>
              <View style={[{ flex: 1 }, Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>Equipe</Text>
                <Text style={[Fonts.p3Bold, Fonts.primary100]}>
                  {nextPrompt?.team?.name || 'Equipe'}
                </Text>
              </View>
              <View style={[{ minWidth: isCompactMobile ? 108 : 120 }, Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>Score</Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {scoreLabel}
                </Text>
              </View>
            </View>

            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[16]]}>
              <View style={[{ flex: 1 }, Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>Fin du match</Text>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {formatPromptDate(nextPrompt?.endedAt || nextPrompt?.updatedAt)}
                </Text>
              </View>
              <View style={[{ minWidth: isCompactMobile ? 108 : 120 }, Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral200]}>Source</Text>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {promptSourceLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {totalPending > 1 ? (
          <View style={{ paddingBottom: sectionOffset / 2, paddingTop: sectionOffset / 2 }}>
            <View
              style={[
                ApplicationStyle.card,
                { borderRadius: 20 },
                Spaces.paddingHorizontal[summaryBannerPaddingHorizontal],
                Spaces.paddingVertical[summaryBannerPaddingVertical],
                {
                  backgroundColor: `${Colors.primary700}D9`,
                  borderColor: `${Colors.primary500}45`,
                },
              ]}
            >
              <Text style={[Fonts.p3, Fonts.neutral100]}>
                {`Il reste ${totalPending} actions post-match a completer.`}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[{ gap: buttonStackGap }, Spaces.paddingTop[sectionOffset]]}>
          <Button
            onPress={handleOpenEditor}
            style={modalButtonStyle}
            title={primaryActionTitle}
            variant="Primary"
          />
          {nextPrompt?.actionType === 'player_self_report' ? (
            <Button
              onPress={handleOpenUnknownStatsFlow}
              style={modalButtonStyle}
              title="Je ne sais pas mes stats"
              variant="Secondary"
            />
          ) : null}
          {totalPending > 1 ? (
            <Button
              onPress={() => {
                dismissPromptForSession();
                openPendingMatchStatsList();
              }}
              style={modalButtonStyle}
              title="Voir tous les matchs en attente"
              variant="Secondary"
            />
          ) : null}
        </View>
      </View>
    </BottomModal>
  );
}

export default MatchStatsPromptHost;
