import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import {
  describeDraftRemaining,
  formatPromptDay,
  formatPromptTime,
  resolveCoachStep,
} from '@/components/organisms/matchStats/matchStatsPromptModel';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetPendingMatchStatsPrompts } from '@/services/matchStats/matchStatsQueries';

import {
  describeMatchStatsEmptyReason,
  MATCH_STATS_EMPTY_REASONS,
} from '@/utils/matchStatsEmptyReason';

// ==========================================================================
// 📋 ST-MATCH (écran 6, design des statistiques validé le 02/10) — « MATCHS EN
// ATTENTE ».
//
// « Pour moi » et « Pour mon équipe » deviennent de vraies sections, avec leur
// nombre ; une ligne d'état par carte, et la carte ENTIÈRE se touche. L'en-tête
// et le retour restent pendant le chargement et l'erreur (sur Android, l'erreur
// n'offrait aucun retour). Sur grand écran : un tableau quand il n'y a qu'une
// famille, deux colonnes côte à côte quand le compte joue ET entraîne.
// Retirés : la carte « Suivi post-match · 3 actions à traiter » (les nombres
// sont dans les titres de section), le bouton plein de chaque carte (il faisait
// la même chose que la carte), l'encadré « Mon action / Action d'équipe ».
// Les cinq états vides gardent leurs mots (`matchStatsEmptyReason`).
// ==========================================================================

/** Au-delà, le site passe au tableau et aux colonnes (règle de mise en page du site). */
const WIDE_LAYOUT_MIN_WIDTH = 1024;

/**
 * La ligne d'état d'une carte : sa pastille et ce qui reste, en mots.
 * @param {any} prompt - Le rappel.
 * @param {Function} t - La traduction.
 * @returns {{ detail: string, label: string, tone: 'cyan' | 'neutral' | 'warning' }} L'état.
 */
export const describePendingState = (prompt, t) => {
  if (prompt?.actionType === 'player_self_report') {
    if (prompt?.state === 'draft') {
      return {
        detail: describeDraftRemaining(prompt?.personalResponse),
        label: t('stMatch.attente.draft', 'Brouillon'),
        tone: 'cyan',
      };
    }
    return {
      detail: t('stMatch.attente.toAnswerDetail', 'Ta participation, tes chiffres, ta note'),
      label: t('stMatch.attente.toAnswer', 'À répondre'),
      tone: 'cyan',
    };
  }
  const step = resolveCoachStep(prompt);
  if (step === 'review') {
    return {
      detail: t('stMatch.attente.reviewDetail', 'Le score officiel a changé'),
      label: t('stMatch.attente.review', 'Vérification requise'),
      tone: 'warning',
    };
  }
  if (step === 'score') {
    return {
      detail: t('stMatch.attente.scoreDetail', 'Puis la feuille de match'),
      label: t('stMatch.attente.score', 'Score à saisir'),
      tone: 'neutral',
    };
  }
  if (step === 'draft') {
    return {
      detail: t(
        'stMatch.attente.sheetDraftDetail',
        'Reprends la feuille là où tu l\'as laissée',
      ),
      label: t('stMatch.attente.draft', 'Brouillon'),
      tone: 'cyan',
    };
  }
  return {
    detail: t('stMatch.attente.sheetDetail', 'Ta note, les buteurs, le temps de jeu'),
    label: t('stMatch.attente.sheet', 'Feuille à saisir'),
    tone: 'neutral',
  };
};

/**
 * « U15 · Sam. 5 sept. · 2 - 1 » (ou « score en attente », ou « fin à 22:00 »).
 * @param {any} prompt - Le rappel.
 * @param {Function} t - La traduction.
 * @returns {string} La ligne.
 */
export const describePendingLine = (prompt, t) => {
  const score = prompt?.score;
  let last = t('stMatch.attente.scorePending', 'score en attente');
  if (score?.available) {
    last = `${score.scoreFor} - ${score.scoreAgainst}`;
  } else if (prompt?.actionType !== 'player_self_report' && prompt?.endedAt) {
    last = t('stMatch.attente.endedAt', 'fin à {{time}}', {
      time: formatPromptTime(prompt.endedAt),
      ...SANS_ECHAPPEMENT,
    });
  }
  return [prompt?.team?.name, formatPromptDay(prompt?.endedAt || prompt?.updatedAt), last]
    .filter(Boolean)
    .join(' · ');
};

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 * @returns {import('react').ReactElement}
 */
function PendingMatchStatsScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;

  const {
    data: pendingPayload,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useGetPendingMatchStatsPrompts();

  const promptItems = useMemo(
    () => (Array.isArray(pendingPayload?.items) ? pendingPayload.items : []),
    [pendingPayload?.items],
  );
  const personalPromptItems = useMemo(
    () => promptItems.filter((item) => item?.actionType === 'player_self_report'),
    [promptItems],
  );
  const teamPromptItems = useMemo(
    () => promptItems.filter((item) => item?.actionType !== 'player_self_report'),
    [promptItems],
  );

  // H1 — quand il n'y a rien, on DIT pourquoi. Huit verrous peuvent fermer cette
  // liste et ils étaient tous muets : un écran blanc ne se distingue pas d'une panne.
  const emptyExplanation = useMemo(
    () => describeMatchStatsEmptyReason(pendingPayload?.emptyReason),
    [pendingPayload?.emptyReason],
  );

  const handleOpenPrompt = useCallback((prompt) => {
    if (!prompt) return;

    const targetRoute = prompt?.actionType === 'player_self_report'
      ? RouteNames.PlayerMatchResponse
      : RouteNames.MatchStatsEditor;

    navigation.navigate(targetRoute, {
      ...(prompt?.sourceType === 'league'
        ? { matchId: prompt?.matchId }
        : { eventId: prompt?.eventId }),
      actionType: prompt?.actionType || 'coach_team_review',
      actorRole: prompt?.actorRole || 'player',
      matchLabel: prompt?.label || 'Match',
      sourceType: prompt?.sourceType === 'league' ? 'league' : 'event',
      sport: prompt?.sport || 'football',
      teamId: prompt?.team?.documentId || undefined,
      teamName: prompt?.team?.name || null,
      title: prompt?.actionType === 'player_self_report' ? t(
        'pendingMatchStatsScreen.myPostMatchFeedback',
        'Mon retour post-match',
      ) : t(
        'pendingMatchStatsScreen.teamReport',
        'Bilan équipe',
      ),
    });
  }, [navigation, t]);

  // L'en-tête et le retour, dans TOUS les états (amélioration 4).
  const header = (
    <View style={[Spaces.gap[4], Spaces.marginBottom[16]]}>
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <HeaderBackButton
          borderColor="primary500"
          color="primary500"
          onPress={() => navigation.goBack()}
          withDefaultMargin={false}
        />
        <Text
          accessibilityRole="header"
          style={[Fonts.h3Bold, Fonts.neutral00, { flex: 1, textAlign: 'center' }]}
        >
          {t('pendingMatchStatsScreen.pendingMatches', 'Matchs en attente')}
        </Text>
        <View style={{ width: 44 }} />
      </View>
      {isWide ? (
        <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter]}>
          {t('stMatch.attente.subtitle', 'Ce qu\'il reste à faire après tes matchs.')}
        </Text>
      ) : null}
    </View>
  );

  const pillColors = (/** @type {'cyan' | 'neutral' | 'warning'} */ tone) => {
    if (tone === 'cyan') {
      return { background: withAlpha(Colors.primary500, 0.14), text: Colors.primary500 };
    }
    if (tone === 'warning') {
      return { background: withAlpha(Colors.warning500, 0.14), text: Colors.warning400 };
    }
    return { background: withAlpha(Colors.neutral00, 0.1), text: Colors.neutral100 };
  };

  const renderPill = (/** @type {string} */ label, /** @type {any} */ tone) => {
    const colors = pillColors(tone);
    return (
      <View
        style={[
          Spaces.paddingHorizontal[8],
          Spaces.paddingVertical[4],
          { backgroundColor: colors.background, borderRadius: 999 },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: colors.text }]}>{label}</Text>
      </View>
    );
  };

  const renderCard = (/** @type {any} */ item) => {
    const etat = describePendingState(item, t);
    return (
      <TouchableOpacity
        accessibilityLabel={`${item?.label || 'Match'}, ${etat.label}`}
        accessibilityRole="button"
        activeOpacity={0.85}
        key={item?.key}
        onPress={() => handleOpenPrompt(item)}
        style={[
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
          Spaces.gap[8],
          {
            backgroundColor: withAlpha(Colors.primary700, 0.55),
            borderColor: withAlpha(Colors.primary500, 0.24),
            borderWidth: 1,
          },
        ]}
        testID={`st-match-attente-carte-${item?.key}`}
      >
        <View
          style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}>
            {item?.label || 'Match'}
          </Text>
          <SvgIcon color={Colors.primary500} height={12} name="arrow-right" width={12} />
        </View>
        <Text style={[Fonts.p3, Fonts.neutral300]}>{describePendingLine(item, t)}</Text>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], { flexWrap: 'wrap' }]}>
          {renderPill(etat.label, etat.tone)}
          <Text style={[Fonts.p3, Fonts.neutral200, { flexShrink: 1 }]}>{etat.detail}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionTitle = (/** @type {string} */ title, /** @type {number} */ count) => (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{title}</Text>
      {renderPill(String(count), 'neutral')}
    </View>
  );

  // 🖥️ Le tableau du site : une ligne par match, ce qui reste, le geste en bout de ligne.
  const renderTable = (/** @type {any[]} */ items) => (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        Spaces.paddingHorizontal[16],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderWidth: 1,
        },
      ]}
      testID="st-match-attente-tableau"
    >
      <View style={[Alignments.row, Spaces.gap[12], Spaces.paddingVertical[12]]}>
        {[
          ['match', t('stMatch.attente.colMatch', 'Match'), 3],
          ['team', t('stMatch.attente.colTeam', 'Équipe'), 1],
          ['end', t('stMatch.attente.colEnd', 'Fin du match'), 2],
          ['left', t('stMatch.attente.colLeft', 'Ce qui reste'), 2],
          ['action', '', 2],
        ].map(([key, label, flex]) => (
          <Text
            key={String(key)}
            style={[Fonts.p4Bold, Fonts.neutral300, Fonts.uppercase, { flex: Number(flex) }]}
          >
            {label}
          </Text>
        ))}
      </View>
      {items.map((item) => {
        const etat = describePendingState(item, t);
        return (
          <View
            key={item?.key}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[12],
              Spaces.paddingVertical[12],
              {
                borderTopColor: withAlpha(Colors.neutral00, 0.08),
                borderTopWidth: 1,
                minHeight: 52,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 3 }]}>
              {item?.label || 'Match'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200, { flex: 1 }]}>{item?.team?.name || ''}</Text>
            <Text style={[Fonts.p2, Fonts.neutral200, { flex: 2 }]}>
              {[formatPromptDay(item?.endedAt), formatPromptTime(item?.endedAt)]
                .filter(Boolean)
                .join(', ')}
            </Text>
            <View style={[{ flex: 2 }, Alignments.alignStart]}>
              {renderPill(etat.label, etat.tone)}
            </View>
            <View style={[{ flex: 2 }, Alignments.alignEnd]}>
              <Button
                onPress={() => handleOpenPrompt(item)}
                size="sm"
                title={etat.label === t('stMatch.attente.score', 'Score à saisir')
                  ? t('stMatch.attente.enterScore', 'Saisir le score')
                  : t('stMatch.attente.open', 'Ouvrir')}
                variant="Primary"
              />
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderSection = (
    /** @type {string} */ title,
    /** @type {any[]} */ items,
    /** @type {string} */ testID,
    /** @type {boolean} */ asTable = false,
  ) => (
    <View style={[Spaces.gap[12], isWide && !asTable ? { flex: 1 } : null]} testID={testID}>
      {renderSectionTitle(title, items.length)}
      {asTable ? renderTable(items) : items.map(renderCard)}
    </View>
  );

  let body;
  if (isLoading && !promptItems.length) {
    // Le squelette garde la forme des cartes (amélioration 4) : rien ne saute à l'arrivée.
    body = (
      <View
        accessibilityLabel={t('stMatch.attente.loading', 'Chargement des matchs en attente')}
        style={[Spaces.gap[12]]}
        testID="st-match-attente-chargement"
      >
        {[24, 120, 120].map((hauteur, index) => (
          <View
            key={`squelette-${String(index)}`}
            style={[
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.06),
                borderRadius: index === 0 ? 8 : 24,
                height: hauteur,
              },
              index === 0 ? { width: '40%' } : null,
            ]}
          />
        ))}
      </View>
    );
  } else if (error && !promptItems.length) {
    body = (
      <View
        accessibilityRole="alert"
        style={[
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.gap[8],
          {
            backgroundColor: withAlpha(Colors.error500, 0.1),
            borderColor: withAlpha(Colors.error500, 0.4),
            borderWidth: 1,
          },
        ]}
        testID="st-match-attente-erreur"
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('stMatch.attente.errorTitle', 'Les matchs en attente n\'ont pas pu être lus.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'stMatch.attente.errorBody',
            'Vérifie ta connexion, puis réessaie. Rien n\'a été perdu.',
          )}
        </Text>
        <View style={[Alignments.selfStart]}>
          <Button
            onPress={() => refetch()}
            size="sm"
            title={t('pendingMatchStatsScreen.tryAgain', 'Réessayer')}
            variant="SecondaryLight"
          />
        </View>
      </View>
    );
  } else if (!promptItems.length) {
    const isDone = pendingPayload?.emptyReason === MATCH_STATS_EMPTY_REASONS.NOTHING_PENDING;
    body = (
      <View
        style={[Alignments.alignCenter, Spaces.gap[8], Spaces.paddingVertical[32]]}
        testID="st-match-attente-vide"
      >
        {isDone ? (
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: withAlpha(Colors.success500, 0.14),
                borderRadius: 28,
                height: 56,
                width: 56,
              },
            ]}
          >
            <SvgIcon color={Colors.success500} height={24} name="check" width={24} />
          </View>
        ) : null}
        <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
          {emptyExplanation.title}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter]}>{emptyExplanation.body}</Text>
      </View>
    );
  } else {
    const forMe = t('pendingMatchStatsScreen.forMe', 'Pour moi');
    const forTeam = t('pendingMatchStatsScreen.forMyTeam', 'Pour mon équipe');
    const bothFamilies = personalPromptItems.length > 0 && teamPromptItems.length > 0;
    body = (
      <View
        style={[isWide && bothFamilies ? Alignments.row : null, Spaces.gap[24]]}
        testID="st-match-attente-sections"
      >
        {personalPromptItems.length
          ? renderSection(forMe, personalPromptItems, 'st-match-attente-pour-moi')
          : null}
        {teamPromptItems.length
          ? renderSection(
            forTeam,
            teamPromptItems,
            'st-match-attente-pour-mon-equipe',
            isWide && !bothFamilies,
          )
          : null}
      </View>
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[24], { flexGrow: 1 }]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isFetching && !isLoading}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        {header}
        {body}
      </ScrollView>
    </ScreenContainer>
  );
}

export default PendingMatchStatsScreen;
