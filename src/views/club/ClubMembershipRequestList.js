import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import { useGetClubMembershipRequests } from '@/services/clubMembershipRequest/clubMembershipRequestQueries';
import { acceptClubMembershipRequest, rejectClubMembershipRequest } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { RouteNames } from '@/navigation/routeNames';

const looksLikePhoneNumber = (value) => {
  if (!value) return false;
  const raw = String(value).trim();
  if (!raw || /[a-z]/i.test(raw)) return false;
  const digits = raw.replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

const resolveRequesterDisplay = (item, t) => {
  const firstName = String(
    item?.requesterFirstname
    || item?.requester?.firstname
    || item?.requester?.firstName
    || item?.user?.firstname
    || item?.user?.firstName
    || ''
  ).trim();
  const lastName = String(
    item?.requesterLastname
    || item?.requester?.lastname
    || item?.requester?.lastName
    || item?.user?.lastname
    || item?.user?.lastName
    || ''
  ).trim();
  const username = String(
    item?.requester?.username
    || item?.user?.username
    || ''
  ).trim();
  const safeUsername = looksLikePhoneNumber(username) ? '' : username;
  const requesterDisplayName = String(
    item?.requesterDisplayName
    || item?.requester?.displayName
    || ''
  ).trim();
  const safeRequesterDisplayName = looksLikePhoneNumber(requesterDisplayName) ? '' : requesterDisplayName;

  const fullName = [firstName, String(lastName).toUpperCase()].filter(Boolean).join(' ').trim();
  const title = fullName || safeUsername || safeRequesterDisplayName || t('common.user', 'Utilisateur');
  const pendingName = firstName || fullName || t('common.user', 'Utilisateur');

  return {
    pendingName,
    title,
  };
};

const extractApiErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  if (typeof error?.error === 'string') return error.error;
  if (typeof error?.details?.error === 'string') return error.details.error;
  return '';
};

/**
 * Club membership request list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Club membership request list screen component
 */
function ClubMembershipRequestList({ navigation, route }) {
  const { clubId } = route?.params ?? {};
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
  } = useGetClubMembershipRequests(clubId, {
    pageSize: 10,
  });

  /**
   * @type {ClubMembershipRequest[]}
   */
  const requests = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {ClubMembershipRequest[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);

  const acceptRequestMutation = useMutation({
    mutationFn: acceptClubMembershipRequest,
    onSuccess: (_data, requestId) => {
      const acceptedRequest = requests.find((item) => item?.documentId === requestId);
      const { title, pendingName } = resolveRequesterDisplay(acceptedRequest || {}, t);
      const trainerLabel = pendingName || title || t('common.user', 'Utilisateur');
      const trainerId = acceptedRequest?.requester?.documentId
        || acceptedRequest?.user?.documentId
        || undefined;

      refetch();

      Alert.alert(
        'Entraineur ajoute',
        `${trainerLabel} a bien ete ajoute a votre club.\n\nVoulez-vous l'assigner a une equipe maintenant ?`,
        [
          {
            style: 'cancel',
            text: t('common.actions.askLater', 'Plus tard'),
          },
          {
            onPress: () => {
              navigation.navigate(RouteNames.AssignCoachTeams, {
                clubId,
                trainerId,
                trainerName: trainerLabel,
              });
            },
            text: 'Assigner maintenant',
          },
        ]
      );
    },
    onError: (error) => {
      const rawMessage = extractApiErrorMessage(error);
      const isMissingRelation = rawMessage.includes('Membership request is missing user or club relation')
        || rawMessage.includes('utilisateur introuvable');
      Alert.alert(
        t('common.error', 'Erreur'),
        isMissingRelation
          ? t(
            'clubMembershipRequestList.errors.missingRequester',
            'Impossible de traiter cette demande. Demandez au joueur de renvoyer sa demande.'
          )
          : t(
            'clubMembershipRequestList.errors.accept',
            'Impossible de valider la demande pour le moment.'
          )
      );
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: rejectClubMembershipRequest,
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'clubMembershipRequestList.errors.reject',
          'Impossible de refuser la demande pour le moment.'
        )
      );
    },
  });

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
   * Render the request item
   * @param {object} param
   * @param {ClubMembershipRequest} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => (
    (() => {
      const { title, pendingName } = resolveRequesterDisplay(item, t);
      return (
    <View
      style={[
        Alignments.alignStart,
        Alignments.justifySpaceBetween,
        Spaces.gap[16],
        Spaces.padding[24],
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderWidth1,
        { borderColor: `${Colors.primary500}33` },
        ApplicationStyle.borderRadius24,
        Spaces.marginHorizontal[16],
        Spaces.marginVertical[8],
        ApplicationStyle.shadow100,
      ]}
    >
      <View
        style={[
          Alignments.row,
          Alignments.fullWidth,
          Alignments.alignStart,
          Spaces.gap[16],
        ]}
      >
        <ProfileAvatar
          imageUrl={item?.user?.avatar?.url || item?.requester?.avatar?.url}
          size={44}
          style={[
            ApplicationStyle.borderWidth1,
            ApplicationStyle.borderColor.neutral00,
            { borderRadius: 44 },
          ]}
          imageStyle={{ borderRadius: 44 }}
        />
        <View style={[
          Alignments.fill,
          Alignments.justifyStart,
          Alignments.alignStart,
          Spaces.gap[6],
        ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <Text
              numberOfLines={1}
              style={[
                Fonts.textLeft,
                Fonts.h4Bold,
                Fonts.neutral00,
                { flexShrink: 1 },
              ]}
            >
              {title}
            </Text>
            <View
              style={[
                ApplicationStyle.backgroundColor.gold900,
                ApplicationStyle.borderRadius12,
                ApplicationStyle.borderWidth1,
                { borderColor: `${Colors.gold500}66` },
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.gold500, Fonts.uppercase]}>
                En attente
              </Text>
            </View>
          </View>
          <Text
            style={[
              Fonts.textLeft,
              Fonts.p2,
              Fonts.neutral100]}
          >
            {t('clubMembershipRequestList.fields.pending', {
              firstname: pendingName,
            })}
          </Text>
        </View>
      </View>
      <View
        style={[
          ApplicationStyle.separator,
          {
            backgroundColor: `${Colors.primary500}33`,
            width: '100%',
          },
        ]}
      />
      <View style={[Alignments.row, Alignments.fullWidth, Spaces.gap[12]]}>
        <Button
          icon="check"
          isOption
          onPress={() => handleAcceptRequest(item.documentId)}
          title={t('clubMembershipRequestList.actions.accept')}
          variant="Primary"
          style={[Alignments.fill, { minHeight: 42 }]}
        />
        <Button
          icon="close"
          isOption
          onPress={() => handleRejectRequest(item.documentId)}
          title={t('clubMembershipRequestList.actions.reject')}
          variant="Secondary"
          style={[Alignments.fill, { minHeight: 42, borderColor: Colors.error500 }]}
          textStyle={[Fonts.error500]}
        />
      </View>
    </View>
      );
    })()
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
        {t('clubMembershipRequestList.noData')}
      </Text>
    </View>
  );

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialStartToken: undefined,
          tutorialSource: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.CLUB_MEMBERSHIP_REQUESTS}
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
          isLoading={isLoading && !isFetchingNextPage}
          wrapperStyle={[Alignments.fill]}
        >
          <OnboardingWrapper
            description="Traitez ici les demandes d adhesion au club et assignez les profils valides."
            id="club-membership-requests-list"
            order={1}
            spotlight={{
              borderRadius: 16,
              maxHeight: 280,
              overlayOpacity: 0.4,
              paddingX: 2,
              paddingY: 2,
            }}
            style={{ flex: 1 }}
            title="Demandes club"
          >
            <View style={[
              Alignments.fill,
              ApplicationStyle.borderRadius2]}
            >
              <FlashList
                data={requests}
                estimatedItemSize={150}
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

export default ClubMembershipRequestList;
