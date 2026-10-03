import { useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AppState,
  Platform,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import { useAppContext } from '@/store/appContext';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import {
  buildDraftFigures,
  describeDraftRemaining,
  describePromptResult,
  describePromptWhen,
  describeResponsesCount,
  resolveCoachStep,
} from '@/components/organisms/matchStats/matchStatsPromptModel';

import {
  getCurrentRouteName,
  navigate,
  navigationRef,
} from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import {
  PENDING_MATCH_STATS_STALE_MS,
  useGetEventMatchStats,
  useGetPendingMatchStatsPrompts,
} from '@/services/matchStats/matchStatsQueries';
import {
  saveEventMatchResult,
  saveEventMyMatchResponse,
  saveLeagueMyMatchResponse,
} from '@/services/matchStats/matchStatsService';

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
import { buildAccountCooldownKey } from '@/context/popupManagerUtils';

// ==========================================================================
// 🔔 ST-MATCH (écrans 3 et 4, design des statistiques validé le 02/10) — LA
// FENÊTRE « APRÈS LE MATCH ».
//
// JOUEUR (écran 3) : « As-tu joué ce match ? » est posée TOUT DE SUITE, avec
// trois réponses ; deux s'envoient d'un appui, sans ouvrir le formulaire. Le
// brouillon montre ce qui est déjà rempli.
// ENTRAÎNEUR (écran 4) : le score se saisit DANS la fenêtre (− / +), puis la
// même fenêtre enchaîne sur la feuille de match ; la vérification dit ce qui a
// changé. Sur le site, la feuille du bas devient une fenêtre centrée de 680
// (`webPresentation="dialog"`).
// Retirés : « Source : Retour perso / Evenement », la date en double, les quatre
// boutons empilés, l'état « Score officiel en attente » (le serveur ne sollicite
// pas l'entraîneur avant la fédération) et son doré.
// ==========================================================================

const BLOCKED_ROUTES = /** @type {Set<string>} */ (new Set([
  RouteNames.EventDetails,
  RouteNames.LeagueMatchDetails,
  RouteNames.MatchStatsEditor,
  RouteNames.PendingMatchStats,
  RouteNames.PlayerMatchResponse,
]));

/**
 * @param {any} prompt
 * @param {Record<string, any>} [overrides]
 * @returns {boolean}
 */
const navigateToPendingMatchStats = (prompt, overrides = {}) => {
  if (!prompt) return false;

  const commonParams = {
    ...(prompt?.sourceType === 'event'
      ? { eventId: prompt?.eventId }
      : { matchId: prompt?.matchId }),
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
    title: prompt?.actionType === 'player_self_report' ? i18next.t(
      'matchStatsPromptHost.myPostMatchFeedback',
      'Mon retour post-match',
    ) : i18next.t(
      'matchStatsPromptHost.teamReport',
      'Bilan équipe',
    ),
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
  const { t } = useTranslation();
  const [{ auth }] = useAppContext();
  const { isBootstrapResolved } = useAuth();
  const queryClient = useQueryClient();
  // FINITIONS8 (point 7) : la fenetre fermee est retenue sous `<compte>:<fenetre>`, ici aussi.
  const accountDocumentId = auth?.user?.documentId;
  const [dismissedPromptKey, setDismissedPromptKey] = useState(/** @type {string | null} */ (null));
  const [currentRouteName, setCurrentRouteName] = useState(/** @type {string | null} */ (null));
  const [isNavigationReady, setIsNavigationReady] = useState(navigationRef.isReady());
  const [allowPromptFallbackFetch, setAllowPromptFallbackFetch] = useState(false);
  // 🔔 ST-MATCH — ce que la fenêtre vient de FAIRE, pour dire merci sans se refermer :
  // la réponse d'un joueur envoyée d'un appui (écran 3, état 4), le score validé par
  // l'entraîneur (écran 4, état 2).
  const [sentAnswer, setSentAnswer] = useState(/** @type {any} */ (null));
  const [savedScore, setSavedScore] = useState(/** @type {any} */ (null));
  const [isSending, setIsSending] = useState(false);
  const [scoreDraft, setScoreDraft] = useState({ against: 0, for: 0 });
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
  // ST-MATCH — l'objet de la fenêtre : le rappel qu'elle vient de traiter tant qu'elle dit
  // merci, sinon le suivant. Les autres rappels en attente (« Encore 1 match à remplir »).
  const shownPrompt = sentAnswer?.prompt || savedScore?.prompt || nextPrompt;
  const otherPendingItems = useMemo(() => (
    Array.isArray(pendingPromptsPayload?.items) ? pendingPromptsPayload.items : []
  ).filter((/** @type {any} */ item) => item?.key && item.key !== shownPrompt?.key
    && item.key !== sentAnswer?.prompt?.key), [
    pendingPromptsPayload?.items,
    sentAnswer?.prompt?.key,
    shownPrompt?.key,
  ]);
  const isBlockedRoute = currentRouteName ? BLOCKED_ROUTES.has(currentRouteName) : false;
  const isCompactMobile = width < 390 || height < 760;
  const modalSnapPoint = isCompactMobile ? '88%' : '82%';
  const shouldShowPrompt = Boolean(
    ENABLE_MATCH_STATS_PROMPTS
    && auth?.token
    && shownPrompt
    && isNavigationReady
    && !isBlockedRoute
    && (
      !dismissedPromptKey
      || dismissedPromptKey !== buildAccountCooldownKey(accountDocumentId, shownPrompt.key)
    ),
  );
  // FINITIONS8 (tournee 9, point 7) — « Plus tard » par compte, 24 h, dans le stockage du
  // telephone (meme regle que l avis d entrainement).
  // Test : __tests__/MatchStatsPromptHost.FINITIONS8.test.js.
  const matchStatsPopup = usePopupEligibility(
    POPUP_IDS.MATCH_STATS_PROMPT,
    shouldShowPrompt,
    {
      cooldownKey: buildAccountCooldownKey(accountDocumentId, shownPrompt?.key),
      dismissScope: POPUP_DISMISS_SCOPES.DAY,
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
  const modalBottomSpacer = (isCompactMobile ? 28 : 36) + insets.bottom;

  const isPlayerPrompt = shownPrompt?.actionType === 'player_self_report';
  const coachStep = isPlayerPrompt ? null : resolveCoachStep(shownPrompt);
  // ST-MATCH (écran 4) — « x sur N ont répondu », la feuille déjà écrite (brouillon, score
  // officiel) : le rappel ne les porte pas, la feuille de l'entraîneur si. Lue seulement
  // quand la fenêtre de l'entraîneur est ouverte sur un match de club.
  const { data: coachMatchStats } = useGetEventMatchStats(
    shownPrompt?.eventId,
    shownPrompt?.team?.documentId,
    {
      enabled: Boolean(
        isVisible && !isPlayerPrompt && shownPrompt?.sourceType === 'event' && shownPrompt?.eventId,
      ),
    },
  );
  const responsesCountLine = describeResponsesCount(coachMatchStats);

  const dismissPromptForSession = useCallback(() => {
    if (shownPrompt?.key) {
      setDismissedPromptKey(buildAccountCooldownKey(accountDocumentId, shownPrompt.key));
    }
    setSentAnswer(null);
    setSavedScore(null);
    matchStatsPopup.dismiss(POPUP_DISMISS_SCOPES.DAY);
  }, [accountDocumentId, matchStatsPopup, shownPrompt?.key]);

  useEffect(() => {
    if (!isVisible || !shownPrompt?.key) {
      shownPromptKeyRef.current = null;
      return;
    }
    if (shownPromptKeyRef.current === shownPrompt.key) return;
    shownPromptKeyRef.current = shownPrompt.key;
    /** @type {any} */ (matchStatsPopup).markShown({ promptKey: shownPrompt.key });
  }, [isVisible, matchStatsPopup, shownPrompt?.key]);

  // Le score repart de celui que le rappel connaît déjà (0 - 0 sinon).
  useEffect(() => {
    if (coachStep !== 'score') return;
    setScoreDraft({
      against: Number(shownPrompt?.score?.scoreAgainst) || 0,
      for: Number(shownPrompt?.score?.scoreFor) || 0,
    });
  }, [coachStep, shownPrompt?.key, shownPrompt?.score?.scoreAgainst, shownPrompt?.score?.scoreFor]);

  const openShownPrompt = useCallback((/** @type {any} */ prompt = shownPrompt) => {
    if (!prompt) return;
    dismissPromptForSession();
    navigateToPendingMatchStats(prompt);
  }, [dismissPromptForSession, shownPrompt]);

  // 🔔 ST-MATCH (écran 3, amélioration 2) — « J'étais là sans jouer » et « Je n'étais
  // pas concerné·e » s'envoient SANS ouvrir le formulaire : même route que lui
  // (my-match-response), une réponse envoyée, sans note (le serveur l'accepte).
  const sendQuickAnswer = useCallback(async (/** @type {string} */ participation) => {
    if (!shownPrompt || isSending) return;
    setIsSending(true);
    try {
      const payload = { participation, teamId: shownPrompt?.team?.documentId || null };
      if (shownPrompt?.sourceType === 'league') {
        await saveLeagueMyMatchResponse(shownPrompt.matchId, payload);
      } else {
        await saveEventMyMatchResponse(shownPrompt.eventId, payload);
      }
      setSentAnswer({ participation, prompt: shownPrompt });
      invalidateAfterAction(queryClient, 'submitMatchStats');
    } catch (_error) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('stMatch.rappel.sendError', 'Ta réponse n\'a pas pu être envoyée. Réessaie.'),
      );
    } finally {
      setIsSending(false);
    }
  }, [isSending, queryClient, shownPrompt, t]);

  // 🔔 ST-MATCH (écran 4, amélioration 1) — le score se valide DANS la fenêtre (même route
  // que la feuille courte, match-result) ; la fenêtre enchaîne sur la feuille de match.
  const saveScoreFromPrompt = useCallback(async () => {
    if (!shownPrompt?.eventId || isSending) return;
    setIsSending(true);
    try {
      await saveEventMatchResult(shownPrompt.eventId, {
        scoreAgainst: scoreDraft.against,
        scoreFor: scoreDraft.for,
        teamId: shownPrompt?.team?.documentId,
      });
      setSavedScore({
        prompt: shownPrompt,
        scoreAgainst: scoreDraft.against,
        scoreFor: scoreDraft.for,
      });
      invalidateAfterAction(queryClient, 'submitMatchStats');
    } catch (_error) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('stMatch.rappel.scoreError', 'Le score n\'a pas pu être enregistré. Réessaie.'),
      );
    } finally {
      setIsSending(false);
    }
  }, [isSending, queryClient, scoreDraft.against, scoreDraft.for, shownPrompt, t]);

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

      const isReady = isBootstrapResolved || allowPromptFallbackFetch;
      if (wasBackground && nextState === 'active' && isReady) {
        setDismissedPromptKey(null);
        // FINITIONS6 · point 7 (tournee 8, reseau) — UNE lecture au retour, et seulement
        // si la donnee a plus que sa fraicheur (30 s). Avant : `invalidateQueries`
        // relancait deja la lecture (requete observee), puis `refetch()` une seconde ;
        // journal T8 : 386 appels, toujours par paires, a chaque retour — et des retours
        // toutes les 1 a 3 s (fenetre systeme, permission) relisaient a chaque fois.
        const requete = queryClient.getQueryCache()
          .find({ queryKey: ['pendingMatchStatsPrompts'] });
        if (!requete || requete.isStaleByTime(PENDING_MATCH_STATS_STALE_MS)) refetch();
      }
    });

    return () => subscription.remove();
  }, [allowPromptFallbackFetch, auth?.token, isBootstrapResolved, queryClient, refetch]);

  if (!ENABLE_MATCH_STATS_PROMPTS || !auth?.token || !shownPrompt || !isVisible) {
    return null;
  }

  // ------------------------------------------------------------------ rendu
  const sectionGap = isCompactMobile ? 16 : 24;
  const cardStyle = [
    ApplicationStyle.borderRadius12,
    Spaces.paddingHorizontal[16],
    Spaces.paddingVertical[12],
  ];
  const result = describePromptResult(shownPrompt?.score);
  const matchLine = describePromptWhen(shownPrompt, { withTeam: !isPlayerPrompt });

  const renderPill = (/** @type {string} */ label) => (
    <View
      style={[
        Spaces.paddingHorizontal[8],
        Spaces.paddingVertical[4],
        {
          backgroundColor: withAlpha(Colors.primary500, 0.14),
          borderColor: withAlpha(Colors.primary500, 0.45),
          borderRadius: 999,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[Fonts.p4Bold, Fonts.primary500]}>{label}</Text>
    </View>
  );

  const renderHead = (/** @type {string} */ eyebrow, /** @type {string | null} */ pill = null) => (
    <View style={[Spaces.gap[4]]}>
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          Spaces.gap[8],
        ]}
      >
        <Text style={[Fonts.p4Bold, Fonts.primary500, Fonts.uppercase]}>{eyebrow}</Text>
        {pill ? renderPill(pill) : null}
      </View>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{shownPrompt?.label || 'Match'}</Text>
      {matchLine || result ? (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {matchLine}
          {result ? (
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {`${matchLine ? ' · ' : ''}${result}`}
            </Text>
          ) : null}
        </Text>
      ) : null}
    </View>
  );

  const renderOkBlock = (/** @type {string} */ title, /** @type {string} */ body) => (
    <View
      style={[
        ...cardStyle,
        Alignments.row,
        Spaces.gap[12],
        {
          backgroundColor: withAlpha(Colors.success500, 0.1),
          borderColor: withAlpha(Colors.success500, 0.4),
          borderWidth: 1,
        },
      ]}
      testID="st-match-rappel-ok"
    >
      <SvgIcon color={Colors.success500} height={20} name="check" width={20} />
      <View style={[Spaces.gap[4], { flexShrink: 1 }]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{title}</Text>
        {body ? <Text style={[Fonts.p3, Fonts.neutral200]}>{body}</Text> : null}
      </View>
    </View>
  );

  const renderStep = (
    /** @type {string} */ number,
    /** @type {'fait' | 'encours' | 'afaire'} */ state,
    /** @type {string} */ title,
    /** @type {string} */ detail,
  ) => {
    let ringColor = Colors.neutral600;
    let textColor = Colors.neutral300;
    if (state === 'encours') {
      ringColor = Colors.primary500;
      textColor = Colors.primary200;
    }
    return (
      <View style={[Alignments.row, Spaces.gap[12]]} testID={`st-match-rappel-etape-${number}`}>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: state === 'encours'
                ? withAlpha(Colors.primary500, 0.14)
                : 'transparent',
              borderColor: ringColor,
              borderRadius: 16,
              borderWidth: 1,
              height: 32,
              width: 32,
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, { color: textColor }]}>{number}</Text>
        </View>
        <View style={[{ flexShrink: 1 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
          {detail ? <Text style={[Fonts.p3, Fonts.neutral300]}>{detail}</Text> : null}
        </View>
      </View>
    );
  };

  const laterButton = (
    <Button
      onPress={dismissPromptForSession}
      title={t('matchStatsPromptHost.later', 'Plus tard')}
      variant="Ghost"
    />
  );

  // --- JOUEUR (écran 3) ---------------------------------------------------
  const renderPlayer = () => {
    if (sentAnswer) {
      // État 4 — envoyé depuis la fenêtre : merci, et le match suivant s'il y en a un.
      const sentTitle = sentAnswer.participation === 'present_no_play'
        ? t('stMatch.rappel.sentPresent', 'C\'est noté : présent sans jouer.')
        : t('stMatch.rappel.sentNotInvolved', 'C\'est noté : pas concerné pour ce match.');
      const sentMatch = { match: sentAnswer.prompt?.label || 'Match', ...SANS_ECHAPPEMENT };
      const sentBody = sentAnswer.participation === 'present_no_play'
        ? t(
          'stMatch.rappel.sentPresentBody',
          '{{match}}. Tu peux encore ajouter une note depuis la page du match.',
          sentMatch,
        )
        : t(
          'stMatch.rappel.sentNotInvolvedBody',
          '{{match}}. Tu ne seras plus relancé·e pour ce match.',
          sentMatch,
        );
      return (
        <View style={[Spaces.gap[sectionGap]]}>
          {renderOkBlock(sentTitle, sentBody)}
          {otherPendingItems.length ? (
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p4Bold, Fonts.neutral300, Fonts.uppercase]}>
                {t('stMatch.rappel.remaining', {
                  count: otherPendingItems.length,
                  defaultValue_one: 'Il te reste {{count}} match',
                  defaultValue_other: 'Il te reste {{count}} matchs',
                })}
              </Text>
              {otherPendingItems.slice(0, 3).map((/** @type {any} */ item) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={item.key}
                  onPress={() => openShownPrompt(item)}
                  style={[
                    ApplicationStyle.borderRadius16,
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.gap[12],
                    Spaces.padding[12],
                    {
                      borderColor: withAlpha(Colors.neutral00, 0.12),
                      borderWidth: 1,
                      minHeight: 44,
                    },
                  ]}
                >
                  <View style={[Alignments.fill]}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{item.label || 'Match'}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>{describePromptWhen(item)}</Text>
                  </View>
                  <SvgIcon color={Colors.primary500} height={12} name="arrow-right" width={12} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Button
            onPress={dismissPromptForSession}
            title={t('stMatch.rappel.close', 'Fermer')}
            variant="Ghost"
          />
        </View>
      );
    }

    if (shownPrompt?.state === 'draft') {
      // État 3 — brouillon : ce qui est déjà rempli se voit, il reste un geste.
      return (
        <View style={[Spaces.gap[sectionGap]]}>
          {renderHead(
            t('stMatch.rappel.eyebrow', 'Après le match'),
            t('stMatch.rappel.draft', 'Brouillon'),
          )}
          <View
            style={[
              ApplicationStyle.borderRadius16,
              Alignments.row,
              Alignments.justifySpaceBetween,
              Spaces.gap[8],
              Spaces.paddingHorizontal[16],
              Spaces.paddingVertical[12],
              { borderColor: withAlpha(Colors.neutral00, 0.09), borderWidth: 1 },
            ]}
            testID="st-match-rappel-brouillon"
          >
            {buildDraftFigures(shownPrompt?.personalResponse, shownPrompt?.sport).map((figure) => (
              <View key={figure.key} style={[Alignments.alignCenter]}>
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>{figure.value}</Text>
                <Text style={[Fonts.p4, Fonts.neutral300]}>{figure.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {describeDraftRemaining(shownPrompt?.personalResponse)}
          </Text>
          <View style={[Spaces.gap[12]]}>
            <Button
              onPress={() => openShownPrompt()}
              title={t('stMatch.rappel.resume', 'Reprendre ma réponse')}
              variant="Primary"
            />
            {laterButton}
          </View>
        </View>
      );
    }

    // États 1 et 2 — la question qui commande tout, posée tout de suite.
    const choices = [
      {
        detail: t('stMatch.rappel.playedDetail', 'Tes chiffres et ta note'),
        key: 'played',
        onPress: () => openShownPrompt(),
        title: t('stMatch.rappel.played', 'J\'ai joué'),
      },
      {
        detail: t(
          'stMatch.rappel.presentDetail',
          'Envoyé tout de suite ; tu pourras ajouter une note',
        ),
        key: 'present_no_play',
        onPress: () => sendQuickAnswer('present_no_play'),
        title: t('stMatch.rappel.present', 'J\'étais là sans jouer'),
      },
      {
        detail: t('stMatch.rappel.notInvolvedDetail', 'Tu ne seras plus relancé·e pour ce match'),
        key: 'not_involved',
        onPress: () => sendQuickAnswer('not_involved'),
        title: t('stMatch.rappel.notInvolved', 'Je n\'étais pas concerné·e'),
      },
    ];
    return (
      <View style={[Spaces.gap[sectionGap]]}>
        {renderHead(t('stMatch.rappel.eyebrow', 'Après le match'))}
        {!shownPrompt?.score?.available ? (
          // État 2 — « Score en attente » devient une phrase : ce n'est pas à lui de le
          // saisir.
          <Text style={[Fonts.p3, Fonts.neutral300]} testID="st-match-rappel-score-attendu">
            {shownPrompt?.score?.waitingOfficial
              ? t(
                'stMatch.rappel.federationPending',
                'La fédération n\'a pas encore publié le score.',
              )
              : t('stMatch.rappel.scorePending', 'L\'entraîneur n\'a pas encore saisi le score.')}
          </Text>
        ) : null}
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('stMatch.rappel.question', 'As-tu joué ce match ?')}
          </Text>
          {choices.map((choice) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: isSending }}
              disabled={isSending}
              key={choice.key}
              onPress={choice.onPress}
              style={[
                ApplicationStyle.borderRadius16,
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[12],
                Spaces.padding[12],
                {
                  backgroundColor: withAlpha(Colors.primary700, 0.55),
                  borderColor: withAlpha(Colors.primary500, 0.24),
                  borderWidth: 1,
                  minHeight: 52,
                },
              ]}
              testID={`st-match-rappel-choix-${choice.key}`}
            >
              <View style={[Alignments.fill]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{choice.title}</Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>{choice.detail}</Text>
              </View>
              {choice.key === 'played' ? (
                <SvgIcon color={Colors.primary500} height={12} name="arrow-right" width={12} />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
        {otherPendingItems.length ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => {
              dismissPromptForSession();
              openPendingMatchStatsList();
            }}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Alignments.justifySpaceBetween,
              { minHeight: 44 },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('stMatch.rappel.morePending', {
                count: otherPendingItems.length,
                defaultValue_one: 'Encore {{count}} match à remplir',
                defaultValue_other: 'Encore {{count}} matchs à remplir',
              })}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('stMatch.rappel.seeAll', 'Tout voir')}
              </Text>
              <SvgIcon color={Colors.primary500} height={12} name="arrow-right" width={12} />
            </View>
          </TouchableOpacity>
        ) : null}
        {laterButton}
      </View>
    );
  };

  // --- ENTRAÎNEUR (écran 4) -----------------------------------------------
  const renderCoach = () => {
    const sheetDetail = t('stMatch.rappel.sheetDetail', 'Ta note, les buteurs, le temps de jeu');
    const stepTwoDetail = responsesCountLine || sheetDetail;
    if (savedScore || coachStep === 'sheet') {
      // État 2 — le score est là : la même fenêtre enchaîne sur la feuille de match.
      return (
        <View style={[Spaces.gap[sectionGap]]}>
          {renderHead(t('stMatch.rappel.coachStep2', 'Après le match · étape 2 sur 3'))}
          {savedScore ? renderOkBlock(
            t('stMatch.rappel.scoreSaved', 'Score enregistré : {{score}}', {
              score: `${savedScore.scoreFor} - ${savedScore.scoreAgainst}`, ...SANS_ECHAPPEMENT,
            }),
            t('stMatch.rappel.scoreSavedBody', 'Les joueurs le voient sur la page du match.'),
          ) : null}
          {renderStep(
            '2',
            'encours',
            t('stMatch.rappel.sheetTitle', 'La feuille de match'),
            sheetDetail,
          )}
          {renderStep(
            '3',
            'afaire',
            t('stMatch.rappel.feedbackTitle', 'Retours des joueurs'),
            responsesCountLine,
          )}
          <View style={[Spaces.gap[12]]}>
            <Button
              onPress={() => openShownPrompt(savedScore
                ? { ...savedScore.prompt, actionType: 'coach_team_review' }
                : shownPrompt)}
              title={t('stMatch.rappel.openSheet', 'Saisir la feuille')}
              variant="Primary"
            />
            {laterButton}
          </View>
        </View>
      );
    }

    if (coachStep === 'draft') {
      // État 3 — la feuille en brouillon : ce qui manque, en une ligne.
      const report = coachMatchStats?.report || null;
      const missing = report && !(Number(report?.collectiveRating) > 0)
        ? t('stMatch.rappel.missingTeamRating', 'Il manque ta note d\'équipe.')
        : '';
      return (
        <View style={[Spaces.gap[sectionGap]]}>
          {renderHead(
            t('stMatch.rappel.coachStep2', 'Après le match · étape 2 sur 3'),
            t('stMatch.rappel.draft', 'Brouillon'),
          )}
          <Text style={[Fonts.p2, Fonts.neutral200]} testID="st-match-rappel-feuille-brouillon">
            {[missing, responsesCountLine].filter(Boolean).join(' ')
              || t('stMatch.rappel.draftSheet', 'Ta feuille de match est commencée.')}
          </Text>
          <View style={[Spaces.gap[12]]}>
            <Button
              onPress={() => openShownPrompt()}
              title={t('stMatch.rappel.resumeSheet', 'Reprendre la feuille')}
              variant="Primary"
            />
            {laterButton}
          </View>
        </View>
      );
    }

    if (coachStep === 'review') {
      // État 4 — la vérification dit CE QUI a changé, pas seulement qu'il faut vérifier.
      const report = coachMatchStats?.report || null;
      const official = describePromptResult(shownPrompt?.score);
      const hasSheetScore = report && Number.isFinite(Number(report?.scoreFor))
        && Number.isFinite(Number(report?.scoreAgainst));
      const changedLine = hasSheetScore && shownPrompt?.score?.available
        ? t(
          'stMatch.rappel.reviewChanged',
          'La fédération indique {{official}}, ta feuille dit {{sheet}}. '
            + 'Vérifie les buts, puis republie.',
          {
            official: `${shownPrompt.score.scoreFor} - ${shownPrompt.score.scoreAgainst}`,
            sheet: `${report.scoreFor} - ${report.scoreAgainst}`,
            ...SANS_ECHAPPEMENT,
          },
        )
        : t(
          'stMatch.rappel.reviewGeneric',
          'Le score officiel ne correspond plus à ta feuille. '
            + 'Vérifie les buts, puis republie.',
        );
      return (
        <View style={[Spaces.gap[sectionGap]]}>
          {renderHead(t('stMatch.rappel.eyebrow', 'Après le match'))}
          <View
            style={[
              ...cardStyle,
              Spaces.gap[8],
              {
                backgroundColor: withAlpha(Colors.warning500, 0.1),
                borderColor: withAlpha(Colors.warning500, 0.4),
                borderWidth: 1,
              },
            ]}
            testID="st-match-rappel-verification"
          >
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <SvgIcon color={Colors.warning400} height={16} name="flag" width={16} />
              <Text style={[Fonts.p2Bold, { color: Colors.warning400 }]}>
                {t('stMatch.rappel.reviewTitle', 'Le score officiel a changé')}
              </Text>
            </View>
            <Text style={[Fonts.p2, Fonts.neutral100]}>{changedLine}</Text>
            {official && !hasSheetScore ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>{official}</Text>
            ) : null}
          </View>
          <View style={[Spaces.gap[12]]}>
            <Button
              onPress={() => openShownPrompt()}
              title={t('stMatch.rappel.reviewOpen', 'Vérifier la feuille')}
              variant="Primary"
            />
            {laterButton}
          </View>
        </View>
      );
    }

    // État 1 — le score, dans la fenêtre : − / + d'une main, au bord du terrain.
    const ourName = String(shownPrompt?.team?.name || '').trim()
      || t('stMatch.rappel.us', 'Mon équipe');
    const ourTeam = { team: ourName, ...SANS_ECHAPPEMENT };
    const changeScore = (/** @type {'for' | 'against'} */ side, /** @type {number} */ step) => {
      setScoreDraft((draft) => ({
        ...draft,
        [side]: Math.min(99, Math.max(0, draft[side] + step)),
      }));
    };
    const theirName = t('stMatch.rappel.opponent', 'Adversaire');
    return (
      <View style={[Spaces.gap[sectionGap]]}>
        {renderHead(t('stMatch.rappel.coachStep1', 'Après le match · étape 1 sur 3'))}
        <View
          style={[Alignments.row, Alignments.alignEnd, Spaces.gap[12]]}
          testID="st-match-rappel-score"
        >
          <View style={[Alignments.fill]}>
            <InputStepper
              decrementLabel={t(
                'stMatch.rappel.minusFor',
                'Un but de moins pour {{team}}',
                ourTeam,
              )}
              incrementLabel={t('stMatch.rappel.plusFor', 'Un but de plus pour {{team}}', ourTeam)}
              label={ourName}
              max={99}
              min={0}
              onDecrement={() => changeScore('for', -1)}
              onIncrement={() => changeScore('for', 1)}
              tone="tunnel"
              value={scoreDraft.for}
            />
          </View>
          <Text style={[Fonts.h3Black, Fonts.neutral300, Spaces.paddingBottom[16]]}>-</Text>
          <View style={[Alignments.fill]}>
            <InputStepper
              decrementLabel={t(
                'stMatch.rappel.minusAgainst',
                'Un but de moins pour l\'adversaire',
              )}
              incrementLabel={t('stMatch.rappel.plusAgainst', 'Un but de plus pour l\'adversaire')}
              label={theirName}
              max={99}
              min={0}
              onDecrement={() => changeScore('against', -1)}
              onIncrement={() => changeScore('against', 1)}
              tone="tunnel"
              value={scoreDraft.against}
            />
          </View>
        </View>
        {/* STATS-FIX2 · 8-9 (T10, ecran 9) — le bouton dit le score qu il enregistre, comme la
            feuille du score de la fiche du match (planche : « Enregistrer 2 - 1 »). */}
        <Button
          disabled={isSending}
          isLoading={isSending}
          onPress={saveScoreFromPrompt}
          title={t('stMatch.score.save', 'Enregistrer {{score}}', {
            score: `${scoreDraft.for} - ${scoreDraft.against}`,
            ...SANS_ECHAPPEMENT,
          })}
          variant="Primary"
        />
        {renderStep(
          '2',
          'afaire',
          t('stMatch.rappel.nextSheet', 'Ensuite : la feuille de match'),
          stepTwoDetail,
        )}
        {laterButton}
      </View>
    );
  };

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
      webPresentation="dialog"
    >
      <View
        style={[Spaces.gap[sectionGap], { paddingBottom: modalBottomSpacer }]}
        testID="st-match-rappel"
      >
        {isPlayerPrompt ? renderPlayer() : renderCoach()}
      </View>
    </BottomModal>
  );
}

export default MatchStatsPromptHost;
