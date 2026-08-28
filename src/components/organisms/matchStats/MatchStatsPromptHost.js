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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
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

import { getWebBackgroundPollMs } from '@/utils/webRuntime';

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

const BLOCKED_ROUTES = /** @type {Set<string>} */ (new Set([
  RouteNames.EventDetails,
  RouteNames.LeagueMatchDetails,
  RouteNames.MatchStatsEditor,
  RouteNames.PendingMatchStats,
  RouteNames.PlayerMatchResponse,
]));

/**
 * @param {string | number | Date | null | undefined} value
 * @returns {string}
 */
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

/**
 * @param {any} prompt
 * @param {Record<string, any>} Colors
 */
const getPromptStatusMeta = (prompt, Colors) => {
  if (prompt?.actionType === 'player_self_report') {
    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: prompt?.state === 'draft' ? 'Brouillon perso' : 'A répondre',
      textColor: Colors.primary500,
    };
  }

  if (prompt?.reviewRequired) {
    return {
      backgroundColor: `${Colors.warning500}20`,
      borderColor: `${Colors.warning500}45`,
      label: 'Vérification requise',
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
    label: 'Score à compléter',
    textColor: Colors.neutral00,
  };
};

/**
 * @param {any} prompt
 * @param {Record<string, any>} [overrides]
 * @returns {boolean}
 */
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
    title: prompt?.actionType === 'player_self_report' ? 'Mon retour post-match' : 'Bilan équipe',
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
  const { isBootstrapResolved } = useAuth();
  const queryClient = useQueryClient();
  const [dismissedPromptKey, setDismissedPromptKey] = useState(/** @type {string | null} */ (null));
  const [currentRouteName, setCurrentRouteName] = useState(/** @type {string | null} */ (null));
  const [isNavigationReady, setIsNavigationReady] = useState(navigationRef.isReady());
  const [allowPromptFallbackFetch, setAllowPromptFallbackFetch] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const shownPromptKeyRef = useRef(/** @type {string | null} */ (null));
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  let matchStatsPollInterval = false;
  if (auth?.token && (isBootstrapResolved || allowPromptFallbackFetch) && Platform.OS === 'web') {
    matchStatsPollInterval = getWebBackgroundPollMs();
  }

  const {
    data: pendingPromptsPayload,
    refetch,
  } = useGetPendingMatchStatsPrompts({
    enabled: ENABLE_MATCH_STATS_PROMPTS
      && Boolean(auth?.token)
      && !skipInitialFetch
      && (isBootstrapResolved || allowPromptFallbackFetch),
    refetchInterval: matchStatsPollInterval,
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
  const modalBottomSpacer = (isCompactMobile ? 28 : 36) + insets.bottom;
  const modalButtonStyle = useMemo(
    () => [
      ApplicationStyle.borderRadius24,
      {
        minHeight: isCompactMobile ? 54 : 56,
      },
    ],
    [ApplicationStyle.borderRadius24, isCompactMobile],
  );
  const primaryActionTitle = useMemo(() => {
    if (!nextPrompt) return 'Ouvrir';
    if (nextPrompt?.actionType === 'player_self_report') {
      return nextPrompt?.state === 'draft' ? 'Reprendre ma réponse' : 'Renseigner mes stats';
    }
    if (nextPrompt?.reviewRequired) return 'Mettre à jour après score officiel';
    if (nextPrompt?.reportStatus === 'draft') return 'Reprendre le brouillon';
    if (nextPrompt?.score?.available) return 'Saisir les stats du match';
    return 'Enregistrer le score';
  }, [nextPrompt]);

  const helperText = useMemo(() => {
    if (!nextPrompt) return '';
    if (nextPrompt?.actionType === 'player_self_report') {
      if (nextPrompt?.state === 'draft') {
        return 'Ton retour perso post-match est déjà commence. Reprends-le quand tu veux pour finaliser tes stats et ta note.';
      }
      return 'Ton match est terminé. Renseigne tes stats individuelles si tu les connais, puis laisse une note sur 10 et ton ressenti.';
    }
    if (nextPrompt?.reviewRequired) {
      return 'Le score officiel a changé après une première saisie. Vérifie les lignes puis republie la bonne version.';
    }
    if (nextPrompt?.reportStatus === 'draft') {
      return 'Un brouillon post-match existe déjà pour cette équipe. Il attend encore d être finalise.';
    }
    if (nextPrompt?.score?.available) {
      return 'Le score est prêt. Il reste à compléter le temps de jeu et les statistiques clés de ton équipe.';
    }
    return 'Le match est terminé. Commence par enregistrer le score, puis complète les statistiques de ton équipe.';
  }, [nextPrompt]);

  const scoreLabel = useMemo(() => {
    if (!nextPrompt?.score?.available) return nextPrompt?.actionType === 'player_self_report' ? 'Score en attente' : 'Score à compléter';
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
    /** @type {any} */ (matchStatsPopup).markShown({ promptKey: nextPrompt.key });
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
    if (isBootstrapResolved) {
      setAllowPromptFallbackFetch(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setAllowPromptFallbackFetch(true);
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [isBootstrapResolved]);

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

      if (wasBackground && nextState === 'active' && (isBootstrapResolved || allowPromptFallbackFetch)) {
        setDismissedPromptKey(null);
        queryClient.invalidateQueries({ queryKey: ['pendingMatchStatsPrompts'] });
        refetch();
      }
    });

    return () => subscription.remove();
  }, [allowPromptFallbackFetch, auth?.token, isBootstrapResolved, queryClient, refetch]);

  if (!ENABLE_MATCH_STATS_PROMPTS || !auth?.token || !nextPrompt || !isVisible) {
    return null;
  }

  return (
    <BottomModal
      close={dismissPromptForSession}
      contentBottomPaddingOverride={modalBottomSpacer}
      contentContainerStyle={{
        paddingBottom: modalBottomSpacer,
        paddingTop: isCompactMobile ? 10 : 14,
      }}
      isVisible={isVisible}
      preventStartupPresentation
      snapPoints={[modalSnapPoint]}
    >
      <View style={[Spaces.gap[sectionGap], { paddingBottom: modalBottomSpacer }]}>
        <View style={[Spaces.gap[titleGap]]}>
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>Rappel post-match</Text>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {nextPrompt?.actionType === 'player_self_report' ? 'Ton match est terminé' : 'Bilan de fin de match'}
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
                <Text style={[Fonts.p3, Fonts.neutral200]}>Équipe</Text>
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
                {`Il reste ${totalPending} actions post-match à compléter.`}
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
          {/*
            H8 — CETTE PORTE ETAIT LA SEULE, ET ELLE S OUVRAIT A PARTIR DE DEUX.
            Avec un seul match en retard, l ecran « Matchs en attente » existait
            (378 lignes) et RIEN N Y MENAIT : `git grep "PendingMatchStats"` ne
            rendait qu une seule navigation, celle-ci. Seuil ramene a 1, pour que
            la liste soit atteignable des qu elle a quelque chose a montrer.
          */}
          {totalPending > 0 ? (
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
          <Button
            onPress={dismissPromptForSession}
            style={modalButtonStyle}
            title="Plus tard"
            variant="Secondary"
          />
          <View pointerEvents="none" style={{ height: modalBottomSpacer }} />
        </View>
      </View>
    </BottomModal>
  );
}

export default MatchStatsPromptHost;
