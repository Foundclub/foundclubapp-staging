import { useCallback, useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetPendingMatchStatsPrompts } from '@/services/matchStats/matchStatsQueries';

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

const getPromptPrimaryAction = (prompt) => {
  if (prompt?.reviewRequired) return 'Mettre a jour';
  if (prompt?.reportStatus === 'draft') return 'Reprendre';
  if (prompt?.score?.available) return 'Ouvrir';
  return 'Enregistrer le score';
};

const buildPromptScore = (prompt) => {
  if (!prompt?.score?.available) return 'Score a completer';
  return `${prompt?.score?.scoreFor ?? '-'} - ${prompt?.score?.scoreAgainst ?? '-'}`;
};

const getPromptActionSummary = (prompt) => {
  if (prompt?.reviewRequired) {
    return 'Verifier puis republier les stats de cette equipe.';
  }
  if (prompt?.reportStatus === 'draft') {
    return 'Reprendre le brouillon et finaliser le rapport.';
  }
  if (prompt?.score?.available) {
    return 'Completer les stats joueurs puis publier le rapport.';
  }
  return 'Enregistrer le score avant de remplir les stats.';
};

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 * @returns {import('react').ReactElement}
 */
function PendingMatchStatsScreen({ navigation }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { height, width } = useWindowDimensions();
  const isCompactMobile = width < 390 || height < 760;

  const {
    data: pendingPayload,
    isFetching,
    refetch,
  } = useGetPendingMatchStatsPrompts();

  const promptItems = useMemo(
    () => (Array.isArray(pendingPayload?.items) ? pendingPayload.items : []),
    [pendingPayload?.items],
  );

  const handleOpenPrompt = useCallback((prompt) => {
    if (!prompt) return;

    navigation.navigate(RouteNames.MatchStatsEditor, {
      ...(prompt?.sourceType === 'league' ? { matchId: prompt?.matchId } : { eventId: prompt?.eventId }),
      matchLabel: prompt?.label || 'Match',
      sourceType: prompt?.sourceType === 'league' ? 'league' : 'event',
      sport: prompt?.sport || 'football',
      teamId: prompt?.team?.documentId || undefined,
      teamName: prompt?.team?.name || null,
      title: 'Stats du match',
    });
  }, [navigation]);

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
        <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{item?.label || 'Match'}</Text>
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {item?.team?.name || 'Equipe'}
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

        <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p4, Fonts.neutral300]}>Fin du match</Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>{formatPromptDate(item?.endedAt || item?.updatedAt)}</Text>
          </View>
          <View style={{ minWidth: isCompactMobile ? 96 : 112 }}>
            <Text style={[Fonts.p4, Fonts.neutral300]}>Score</Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{buildPromptScore(item)}</Text>
          </View>
        </View>

        <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.padding[12], Spaces.gap[4]]}>
          <Text style={[Fonts.p4Bold, Fonts.primary100]}>Action attendue</Text>
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
      <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter, Spaces.marginBottom[16]]}>
        <HeaderBackButton
          borderColor="primary500"
          color="primary500"
          onPress={() => navigation.goBack()}
          withDefaultMargin={false}
        />
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { flex: 1, textAlign: 'center' }]}>
          Matchs en attente
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
        <Text style={[Fonts.p4Bold, Fonts.primary500]}>Suivi post-match</Text>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {`${promptItems.length} match${promptItems.length > 1 ? 's' : ''} a traiter`}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          Retrouve ici tous les rapports post-match encore a completer, republier ou verifier apres une mise a jour du score officiel.
        </Text>
      </View>

      <FlatList
        contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24], promptItems.length === 0 ? { flexGrow: 1 } : null]}
        data={promptItems}
        keyExtractor={(item, index) => String(item?.key || item?.eventId || item?.matchId || index)}
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
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>Aucun rapport en attente</Text>
            <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
              Quand un match termine demandera encore une action, il apparaitra ici automatiquement.
            </Text>
          </View>
        )}
        refreshControl={<RefreshControl onRefresh={refetch} refreshing={isFetching} tintColor={Colors.primary500} />}
        renderItem={renderPromptCard}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

export default PendingMatchStatsScreen;
