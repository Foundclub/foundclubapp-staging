import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { navigateToRequestsHub, REQUESTS_HUB_LEGACY_REDIRECT } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeamMembershipRequests } from '@/services/teamMembershipRequest/teamMembershipRequestQueries';
import {
  acceptTeamMembershipRequest,
  rejectTeamMembershipRequest,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

const extractApiErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  if (typeof error?.error === 'string') return error.error;
  if (typeof error?.details?.error === 'string') return error.details.error;
  return '';
};

/**
 * Team membership request list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team membership request list screen component
 */
function TeamMembershipRequestList({ navigation, route }) {
  const routeParams = route?.params ?? {};
  const teamIds = Array.isArray(routeParams.teamIds)
    ? routeParams.teamIds
    : routeParams.teamIds
      ? [routeParams.teamIds]
      : routeParams.teamId
        ? [routeParams.teamId]
        : [];
  const { userData } = useAuth();

  // hooks
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetTeamMembershipRequests(teamIds, {
    pageSize: 10,
  });

  const acceptRequestMutation = useMutation({
    mutationFn: acceptTeamMembershipRequest,
    onError: (mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        extractApiErrorMessage(mutationError)
          || t(
            'teamMembershipRequestList.errors.accept',
            'Impossible de valider la demande pour le moment.',
          ),
      );
    },
    onSuccess: () => {
      refetch();
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: rejectTeamMembershipRequest,
    onError: (mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        extractApiErrorMessage(mutationError)
          || t(
            'teamMembershipRequestList.errors.reject',
            'Impossible de refuser la demande pour le moment.',
          ),
      );
    },
    onSuccess: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (!REQUESTS_HUB_LEGACY_REDIRECT) return;
    navigateToRequestsHub(navigation, {
      initialFilter: 'team',
      source: 'profile',
    });
  }, [navigation]);

  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Handle accept request
   * @param {string} requestId
   */
  const handleAcceptRequest = (requestId) => {
    if (requestId) {
      acceptRequestMutation.mutate(requestId);
    }
  };

  /**
   * Handle reject request
   * @param {string} requestId
   */
  const handleRejectRequest = (requestId) => {
    if (requestId) {
      rejectRequestMutation.mutate(requestId);
    }
  };

  /**
   * @type {TeamMembershipRequest[]}
   */
  const requests = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {TeamMembershipRequest[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);
  const isMissingTeamContext = teamIds.length === 0;
  const isMutating = acceptRequestMutation.isPending || rejectRequestMutation.isPending;
  const initialErrorMessage = extractApiErrorMessage(error)
    || t(
      'teamMembershipRequestList.errors.load',
      "Impossible de charger les demandes d'equipe pour le moment.",
    );

  /**
   * Render the request item
   * @param {object} param
   * @param {TeamMembershipRequest} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => (
    <View
      style={[
        Alignments.alignEnd,
        Alignments.justifySpaceBetween,
        Spaces.gap[12],
        Spaces.padding[24],
        Spaces.marginVertical[12],
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
      ]}
    >
      <Tag
        text={item.team?.name}
      />
      <View
        style={[
          Alignments.row,
          Alignments.fullWidth,
          Alignments.alignCenter,
          Spaces.gap[24],
        ]}
      >
        <ProfileAvatar
          imageStyle={{ borderRadius: 40 }}
          imageUrl={item?.user?.avatar?.url}
          size={40}
          style={[
            ApplicationStyle.borderWidth1,
            ApplicationStyle.borderColor.neutral00,
            { borderRadius: 40 },
          ]}
        />
        {item?.user?.firstname && item?.user?.lastname && (
          <View style={[
            { maxWidth: '70%' },
            Alignments.justifyStart,
            Alignments.alignStart,
            Spaces.gap[4],
          ]}
          >
            <Text
              numberOfLines={2}
              style={[
                Fonts.textCenter,
                Fonts.h4Black,
                Fonts.neutral00]}
            >
              {`${item?.user?.firstname} ${item?.user?.lastname?.toUpperCase()}`}
            </Text>
            <Text
              style={[
                Fonts.textLeft,
                Fonts.p3,
                Fonts.neutral00]}
            >
              {t('teamMembershipRequestList.fields.pending', {
                firstname: item?.user?.firstname,
              })}
              {' '}
              {item?.team?.name}
            </Text>
          </View>
        )}
      </View>
      <View style={[Alignments.row,
        Spaces.gap[12], Spaces.marginTop[12]]}
      >
        <Button
          disabled={isMutating}
          icon="check"
          isOption
          isLoading={acceptRequestMutation.isPending}
          onPress={() => handleAcceptRequest(item.documentId)}
          title={t('teamMembershipRequestList.actions.accept')}
          variant="Primary"
        />
        <Button
          disabled={isMutating}
          icon="close"
          isOption
          isLoading={rejectRequestMutation.isPending}
          onPress={() => handleRejectRequest(item.documentId)}
          title={t('teamMembershipRequestList.actions.reject')}
          variant="Secondary"
        />
      </View>
    </View>
  );

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius32,
      Alignments.alignCenter,
      Spaces.gap[32],
      Spaces.paddingHorizontal[12],
      Spaces.paddingVertical[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('teamMembershipRequestList.noData')}
      </Text>
    </View>
  );

  if (isMissingTeamContext) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Alignments.fill,
          Alignments.justifyCenter,
          Alignments.alignCenter,
          Spaces.gap[16],
          Spaces.paddingHorizontal[24],
          Spaces.paddingVertical[24],
        ]}
      >
        <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
          {t('teamMembershipRequestList.errors.missingTeamTitle', 'Equipe introuvable')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
          {t(
            'teamMembershipRequestList.errors.missingTeamBody',
            "Impossible d'ouvrir ces demandes sans identifiant d'equipe.",
          )}
        </Text>
        <View style={[Alignments.fullWidth, Spaces.gap[12], { maxWidth: 320 }]}>
          <Button
            onPress={() => navigation.navigate(RouteNames.TeamList)}
            title={t('teamMembershipRequestList.actions.backToTeams', 'Retour aux equipes')}
            variant="Primary"
          />
          <Button
            onPress={() => navigateToRequestsHub(navigation, {
              initialFilter: 'team',
              source: 'profile',
            })}
            title={t('requestsHub.migratedBannerAction', "Ouvrir l'onglet Demandes")}
            variant="Secondary"
          />
        </View>
      </ScreenContainer>
    );
  }

  if (error && requests.length === 0 && !isLoading) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Alignments.fill,
          Alignments.justifyCenter,
          Alignments.alignCenter,
          Spaces.gap[16],
          Spaces.paddingHorizontal[24],
          Spaces.paddingVertical[24],
        ]}
      >
        <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
          {t('teamMembershipRequestList.errors.loadTitle', 'Chargement impossible')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
          {initialErrorMessage}
        </Text>
        <View style={[Alignments.fullWidth, Spaces.gap[12], { maxWidth: 320 }]}>
          <Button
            onPress={() => refetch()}
            title={t('common.actions.retry', 'R\u00E9essayer')}
            variant="Primary"
          />
          <Button
            onPress={() => navigateToRequestsHub(navigation, {
              initialFilter: 'team',
              source: 'profile',
            })}
            title={t('common.actions.back', 'Retour')}
            variant="Secondary"
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.TEAM_MEMBERSHIP_REQUESTS}
      userId={userData?.documentId}
    >
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.justifySpaceBetween,
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={(isLoading && !isFetchingNextPage)
            || acceptRequestMutation.isPending
            || rejectRequestMutation.isPending}
          wrapperStyle={[Alignments.fill]}
        >
          <TouchableOpacity
            onPress={() => navigateToRequestsHub(navigation, {
              initialFilter: 'team',
              source: 'profile',
            })}
            style={[
              ApplicationStyle.borderRadius12,
              ApplicationStyle.borderWidth1,
              Spaces.padding[12],
              Spaces.marginBottom[12],
              {
                backgroundColor: 'rgba(1, 179, 244, 0.12)',
                borderColor: `${Colors.primary500}66`,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {t('requestsHub.migratedBannerTitle', 'Ce flux est migre vers Demandes.')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {t('requestsHub.migratedBannerAction', "Ouvrir l'onglet Demandes")}
            </Text>
          </TouchableOpacity>
          <OnboardingWrapper
            description="Ici vous pouvez accepter ou refuser les demandes d'adhésion à vos équipes."
            id="team-membership-requests-list"
            order={1}
            spotlight={{
              borderRadius: 16,
              maxHeight: 260,
              overlayOpacity: 0.4,
              paddingX: 2,
              paddingY: 2,
            }}
            style={{ flex: 1 }}
            title="Demandes équipe"
          >
            <View style={[
              Alignments.fill,
              ApplicationStyle.borderRadius2]}
            >
              <FlashList
                data={requests}
                keyExtractor={(item) => item?.documentId || 'unknown'}
                ListEmptyComponent={renderEmptyList}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                onRefresh={refetch}
                refreshing={isLoading && !isFetchingNextPage}
                renderItem={renderItem}
              />
            </View>
          </OnboardingWrapper>
        </WithDataWrapper>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default TeamMembershipRequestList;
