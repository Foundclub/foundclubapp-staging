import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { useGetLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { respondToJoinRequest } from '@/services/leagueTeam/leagueTeamService';
import useTheme from '@/theme/themeContext';
import { getEntityDocumentId } from '@/utils/entityId';

/**
 * @param {{ navigation: any, route: { params?: { teamId?: string } } }} props
 */
const SquadRequestsScreen = ({ navigation, route }) => {
  const teamId = route?.params?.teamId ? String(route.params.teamId) : '';
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const {
    data: team,
    error,
    isLoading,
    refetch,
  } = useGetLeagueTeam(teamId, {
    enabled: !!teamId,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState(/** @type {{ type: 'success' | 'error', message: string } | null} */ (null));

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 2400);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const requests = useMemo(() => (Array.isArray(team?.join_requests) ? team.join_requests : []), [team?.join_requests]);

  const isPhoneLike = (value) => {
    const normalized = String(value || '').replace(/\s+/g, '');
    if (!normalized) return false;
    return /^\+?\d{8,15}$/.test(normalized);
  };

  const getRequesterName = (/** @type {any} */ user) => {
    const firstname = String(user?.firstname || '').trim();
    const lastname = String(user?.lastname || '').trim();
    const fullname = [firstname, lastname].filter(Boolean).join(' ').trim();
    if (fullname.length > 0) return fullname;
    const username = String(user?.username || '').trim();
    if (username.length > 0 && !isPhoneLike(username)) return username;
    return 'Joueur';
  };

  const handleRespond = useCallback(async (/** @type {string} */ userId, /** @type {boolean} */ accept) => {
    if (!teamId || !userId) return;

    try {
      setIsProcessing(true);
      await respondToJoinRequest(teamId, userId, accept);
      await refetch();
      setFeedback({
        type: 'success',
        message: accept ? 'Demande acceptee.' : 'Demande refusee.',
      });
    } catch (requestError) {
      console.error('[SquadRequests] respond error:', requestError);
      setFeedback({
        type: 'error',
        message: 'Impossible de traiter cette demande.',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [refetch, teamId]);

  const renderRequestCard = useCallback((/** @type {{ item: any }} */ { item }) => {
    const userId = getEntityDocumentId(item);
    const requesterName = getRequesterName(item);

    return (
      <View
        style={[
          Spaces.marginHorizontal[8],
          Spaces.padding[24],
          Spaces.marginBottom[16],
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          {
            borderColor: Colors.neutral700,
            borderWidth: 1,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.marginBottom[16]]}>
          <Tag text={team?.name || 'Squad'} />
          <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>Nouvelle demande</Text>
        </View>

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16], Spaces.marginBottom[16]]}>
          <ProfileAvatar
            imageUrl={item?.avatar?.url}
            size={44}
            style={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 44 },
            ]}
            imageStyle={{ borderRadius: 44 }}
          />

          <View style={{ flex: 1 }}>
            <Text style={[Fonts.h4Black, { color: Colors.neutral00 }]} numberOfLines={1}>
              {requesterName}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral200 }]} numberOfLines={2}>
              Souhaite rejoindre votre squad.
            </Text>
          </View>
        </View>

        <View
          style={[
            {
              backgroundColor: Colors.neutral700,
              height: 1,
              marginBottom: 16,
              opacity: 0.5,
            },
          ]}
        />

        <View style={[Alignments.row, Spaces.gap[16]]}>
          <Button
            disabled={isProcessing || !userId}
            onPress={() => handleRespond(String(userId || ''), true)}
            style={{ flex: 1 }}
            title={t('teamMembershipRequestList.actions.accept', 'Accepter')}
            variant="Primary"
          />
          <Button
            disabled={isProcessing || !userId}
            onPress={() => handleRespond(String(userId || ''), false)}
            style={{ flex: 1 }}
            title={t('teamMembershipRequestList.actions.reject', 'Refuser')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  }, [
    Alignments.alignCenter,
    Alignments.justifySpaceBetween,
    Alignments.row,
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderColor.neutral00,
    ApplicationStyle.borderRadius24,
    ApplicationStyle.borderWidth1,
    Colors.neutral00,
    Colors.neutral200,
    Colors.neutral300,
    Colors.neutral700,
    Fonts.h4Black,
    Fonts.p3,
    Spaces.gap,
    Spaces.marginHorizontal,
    Spaces.marginBottom,
    Spaces.marginTop,
    Spaces.padding,
    handleRespond,
    isProcessing,
    t,
    team?.name,
  ]);

  const emptyState = useMemo(() => (
    <View
      style={[
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[20],
        Spaces.marginTop[24],
        Alignments.alignCenter,
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius24,
        {
          borderColor: Colors.neutral700,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[Fonts.p1Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
        {isLoading ? 'Chargement...' : t('teamMembershipRequestList.noData', 'Aucune demande d\'adhesion en attente')}
      </Text>
    </View>
  ), [
    Alignments.alignCenter,
    ApplicationStyle.backgroundColor.primary900,
    ApplicationStyle.borderRadius24,
    Colors.neutral00,
    Colors.neutral700,
    Fonts.p1Bold,
    Spaces.marginTop,
    Spaces.paddingHorizontal,
    Spaces.paddingVertical,
    isLoading,
    t,
  ]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Spaces.paddingVertical[16],
        Spaces.paddingHorizontal[4],
      ]}
    >
      <View style={[Spaces.paddingHorizontal[12], Spaces.marginBottom[16]]}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.marginBottom[16]]}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
            {t('teamMembershipRequestList.title', 'Demandes d\'adhesion')}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {requests.length > 0 ? `${requests.length} demande(s) en attente` : 'Aucune demande en attente'}
        </Text>

        {feedback ? (
          <View
            style={[
              Spaces.marginTop[12],
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[10],
              ApplicationStyle.borderRadius12,
              {
                alignItems: 'center',
                backgroundColor: feedback.type === 'success'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(239, 68, 68, 0.12)',
                borderColor: feedback.type === 'success'
                  ? 'rgba(34, 197, 94, 0.5)'
                  : 'rgba(239, 68, 68, 0.5)',
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                Fonts.p2Bold,
                {
                  color: feedback.type === 'success' ? '#4ADE80' : Colors.error500,
                  textAlign: 'center',
                },
              ]}
            >
              {feedback.message}
            </Text>
          </View>
        ) : null}
      </View>

      <WithDataWrapper
        error={error?.message}
        isLoading={Boolean(isLoading && !requests.length) || isProcessing}
        wrapperStyle={[Alignments.fill]}
      >
        <FlashList
          data={requests}
          estimatedItemSize={200}
          keyExtractor={(item, index) => String(getEntityDocumentId(item) || item?.id || `request-${index}`)}
          ListEmptyComponent={emptyState}
          onRefresh={refetch}
          refreshing={Boolean(isLoading && requests.length > 0)}
          renderItem={renderRequestCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
        />
      </WithDataWrapper>
    </ScreenContainer>
  );
};

export default SquadRequestsScreen;
