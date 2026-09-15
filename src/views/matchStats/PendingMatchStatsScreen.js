import i18next from 'i18next';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetPendingMatchStatsPrompts } from '@/services/matchStats/matchStatsQueries';

import { describeMatchStatsEmptyReason } from '@/utils/matchStatsEmptyReason';

const formatPromptDate = (value) => {
  if (!value) return i18next.t('pendingMatchStatsScreen.dateUnavailable', 'Date indisponible');

  try {
    return new Date(value).toLocaleString(localeDesFormats(), {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'long',
    });
  } catch (_error) {
    return i18next.t('pendingMatchStatsScreen.dateUnavailable', 'Date indisponible');
  }
};

const getPromptStatusMeta = (prompt, Colors) => {
  if (prompt?.actionType === 'player_self_report') {
    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: prompt?.state === 'draft' ? i18next.t(
        'pendingMatchStatsScreen.personalDraft',
        'Brouillon perso',
      ) : i18next.t(
        'pendingMatchStatsScreen.toAnswer',
        'A répondre',
      ),
      textColor: Colors.primary500,
    };
  }

  if (prompt?.reviewRequired) {
    return {
      backgroundColor: `${Colors.warning500}20`,
      borderColor: `${Colors.warning500}45`,
      label: i18next.t('pendingMatchStatsScreen.checkRequired', 'Vérification requise'),
      textColor: Colors.warning500,
    };
  }

  if (prompt?.reportStatus === 'draft') {
    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: i18next.t('pendingMatchStatsScreen.draftInProgress', 'Brouillon en cours'),
      textColor: Colors.primary500,
    };
  }

  if (prompt?.score?.waitingOfficial) {
    return {
      backgroundColor: `${Colors.gold500}20`,
      borderColor: `${Colors.gold500}45`,
      label: i18next.t('pendingMatchStatsScreen.officialScorePending', 'Score officiel en attente'),
      textColor: Colors.gold500,
    };
  }

  if (prompt?.score?.available) {
    return {
      backgroundColor: `${Colors.success500}20`,
      borderColor: `${Colors.success500}45`,
      label: i18next.t('pendingMatchStatsScreen.toFinalise', 'A finaliser'),
      textColor: Colors.success500,
    };
  }

  return {
    backgroundColor: `${Colors.neutral00}14`,
    borderColor: `${Colors.neutral00}24`,
    label: i18next.t('pendingMatchStatsScreen.scoreToComplete', 'Score à compléter'),
    textColor: Colors.neutral00,
  };
};

const getPromptPrimaryAction = (prompt) => {
  if (prompt?.actionType === 'player_self_report') {
    return prompt?.state === 'draft'
      ? i18next.t('pendingMatchStatsScreen.resume', 'Reprendre')
      : i18next.t('pendingMatchStatsScreen.fillIn', 'Renseigner');
  }
  if (prompt?.reviewRequired) return i18next.t('pendingMatchStatsScreen.update', 'Mettre à jour');
  if (prompt?.reportStatus === 'draft') {
    return i18next.t(
      'pendingMatchStatsScreen.resume',
      'Reprendre',
    );
  }
  if (prompt?.score?.available) return i18next.t('pendingMatchStatsScreen.open', 'Ouvrir');
  return i18next.t('pendingMatchStatsScreen.saveTheScore', 'Enregistrer le score');
};

const buildPromptScore = (prompt) => {
  if (!prompt?.score?.available) {
    return i18next.t(
      'pendingMatchStatsScreen.scoreToComplete',
      'Score à compléter',
    );
  }
  return `${prompt?.score?.scoreFor ?? '-'} - ${prompt?.score?.scoreAgainst ?? '-'}`;
};

const getPromptActionSummary = (prompt) => {
  if (prompt?.actionType === 'player_self_report') {
    if (prompt?.state === 'draft') {
      return i18next.t(
        'pendingMatchStatsScreen.resumeYourPersonalDraftFinalise',
        'Reprendre ton brouillon perso, finaliser tes stats et ta note de match.',
      );
    }
    return i18next.t(
      'pendingMatchStatsScreen.giveYourIndividualPostMatch',
      'Donner ton retour individuel post-match, avec stats perso et note sur 10.',
    );
  }
  if (prompt?.reviewRequired) {
    return i18next.t(
      'pendingMatchStatsScreen.checkThenRepublishThisTeam',
      'Vérifier puis republier les stats de cette équipe.',
    );
  }
  if (prompt?.reportStatus === 'draft') {
    return i18next.t(
      'pendingMatchStatsScreen.resumeTheDraftAndFinalise',
      'Reprendre le brouillon et finaliser le rapport.',
    );
  }
  if (prompt?.score?.available) {
    return i18next.t(
      'pendingMatchStatsScreen.completeThePlayerStatsThen',
      'Compléter les stats joueurs puis publier le rapport.',
    );
  }
  return i18next.t(
    'pendingMatchStatsScreen.saveTheScoreBeforeFilling',
    'Enregistrer le score avant de remplir les stats.',
  );
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
  const { height, width } = useWindowDimensions();
  const isCompactMobile = width < 390 || height < 760;

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
      ...(prompt?.sourceType === 'league' ? { matchId: prompt?.matchId } : { eventId: prompt?.eventId }),
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

  if (isLoading && !promptItems.length) {
    return (
      <ScreenContainer bgImage="bg2">
        <View
          style={[
            ApplicationStyle.backgroundColor.primary900,
            ApplicationStyle.borderRadius24,
            ApplicationStyle.borderColor.primary500,
            ApplicationStyle.borderWidth1,
            Alignments.justifyCenter,
            Alignments.alignCenter,
            Spaces.padding[24],
            Spaces.gap[8],
            { flex: 1, minHeight: 220 },
          ]}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
            {t(
              'pendingMatchStatsScreen.loadingPendingMatches',
              'Chargement des matchs en attente',
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
            {t(
              'pendingMatchStatsScreen.weReFetchingYourAvailable',
              'Nous récupérons tes retours post-match disponibles.',
            )}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error && !promptItems.length) {
    return (
      <ScreenContainer bgImage="bg2">
        <View
          style={[
            ApplicationStyle.backgroundColor.primary900,
            ApplicationStyle.borderRadius24,
            ApplicationStyle.borderColor.primary500,
            ApplicationStyle.borderWidth1,
            Alignments.justifyCenter,
            Alignments.alignCenter,
            Spaces.padding[24],
            Spaces.gap[12],
            { flex: 1, minHeight: 220 },
          ]}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
            {t(
              'pendingMatchStatsScreen.loadingFailed',
              'Chargement impossible',
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
            {error?.message || t(
              'pendingMatchStatsScreen.unableToLoadPostMatch',
              'Impossible de charger les actions post-match pour le moment.',
            )}
          </Text>
          <Button
            onPress={() => refetch()}
            title={t('pendingMatchStatsScreen.tryAgain', 'Réessayer')}
            variant="Primary"
          />
        </View>
      </ScreenContainer>
    );
  }

  const renderPromptCard = ({ item }) => {
    const statusMeta = getPromptStatusMeta(item, Colors);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenPrompt(item)}
        style={[
          ApplicationStyle.backgroundColor.primary900,
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderColor.primary500,
          ApplicationStyle.borderWidth1,
          Spaces.padding[isCompactMobile ? 14 : 16],
          Spaces.gap[isCompactMobile ? 10 : 12],
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{item?.label || 'Match'}</Text>
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {item?.team?.name || t('pendingMatchStatsScreen.teamFallback', 'Equipe')}
            </Text>
          </View>
          <View
            style={[
              Spaces.paddingHorizontal[10],
              Spaces.paddingVertical[6],
              {
                backgroundColor: statusMeta.backgroundColor,
                borderColor: statusMeta.borderColor,
                borderRadius: 999,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: statusMeta.textColor }]}>{statusMeta.label}</Text>
          </View>
        </View>

        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {t('pendingMatchStatsScreen.endOfMatch', 'Fin du match')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>{formatPromptDate(item?.endedAt || item?.updatedAt)}</Text>
          </View>
          <View style={{ minWidth: isCompactMobile ? 96 : 112 }}>
            <Text style={[Fonts.p4, Fonts.neutral300]}>Score</Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{buildPromptScore(item)}</Text>
          </View>
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[12], Spaces.gap[4]]}>
          <Text style={[Fonts.p4Bold, Fonts.primary100]}>
            {item?.actionType === 'player_self_report' ? t(
              'pendingMatchStatsScreen.myAction',
              'Mon action',
            ) : t(
              'pendingMatchStatsScreen.teamAction',
              "Action d'équipe",
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {getPromptActionSummary(item)}
          </Text>
        </View>

        <Button
          onPress={() => handleOpenPrompt(item)}
          title={getPromptPrimaryAction(item)}
          variant="Primary"
        />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bgImage="bg2">
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.marginBottom[16]]}>
        <HeaderBackButton
          borderColor="primary500"
          color="primary500"
          onPress={() => navigation.goBack()}
          withDefaultMargin={false}
        />
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { flex: 1, textAlign: 'center' }]}>
          {t('pendingMatchStatsScreen.pendingMatches', 'Matchs en attente')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View
        style={[
          ApplicationStyle.backgroundColor.primary900,
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderColor.primary500,
          ApplicationStyle.borderWidth1,
          Spaces.padding[isCompactMobile ? 14 : 16],
          Spaces.marginBottom[16],
          Spaces.gap[isCompactMobile ? 6 : 8],
        ]}
      >
        <Text style={[Fonts.p4Bold, Fonts.primary500]}>
          {t('pendingMatchStatsScreen.postMatchFollowUp', 'Suivi post-match')}
        </Text>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t(
            'pendingMatchStatsScreen.actionsToHandle',
            {
              count: promptItems.length,
              defaultValue_one: '{{count}} action à traiter',
              defaultValue_other: '{{count}} actions à traiter',
            },
          )}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t(
            'pendingMatchStatsScreen.findHereYourPersonalFeedback',
            'Retrouve ici tes retours perso et les bilans équipe encore en attente après les '
              + 'matchs.',
          )}
        </Text>
      </View>

      <FlatList
        contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24], promptItems.length === 0 ? { flexGrow: 1 } : null]}
        data={[
          ...(personalPromptItems.length ? [{
            key: 'header-personal',
            title: t(
              'pendingMatchStatsScreen.forMe',
              'Pour moi',
            ),
            type: 'header',
          }] : []),
          ...personalPromptItems.map((item) => ({ ...item, type: 'item' })),
          ...(teamPromptItems.length ? [{
            key: 'header-team',
            title: t(
              'pendingMatchStatsScreen.forMyTeam',
              'Pour mon équipe',
            ),
            type: 'header',
          }] : []),
          ...teamPromptItems.map((item) => ({ ...item, type: 'item' })),
        ]}
        keyExtractor={(item, index) => String(item?.key || index)}
        ListEmptyComponent={(
          <View
            style={[
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderColor.primary500,
              ApplicationStyle.borderWidth1,
              Alignments.justifyCenter,
              Alignments.alignCenter,
              Spaces.padding[24],
              Spaces.gap[8],
              { flex: 1, minHeight: 220 },
            ]}
          >
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>{emptyExplanation.title}</Text>
            <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
              {emptyExplanation.body}
            </Text>
          </View>
        )}
        refreshControl={<RefreshControl onRefresh={refetch} refreshing={isFetching} tintColor={Colors.primary500} />}
        renderItem={({ item }) => {
          if (item?.type === 'header') {
            return (
              <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginTop[4]]}>
                {item.title}
              </Text>
            );
          }
          return renderPromptCard({ item });
        }}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

export default PendingMatchStatsScreen;
