import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { navigateToRequestsHub, REQUESTS_HUB_LEGACY_REDIRECT } from '@/domains/requests/requestNavigation';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubMembershipRequests } from '@/services/clubMembershipRequest/clubMembershipRequestQueries';
import { acceptClubMembershipRequest, rejectClubMembershipRequest } from '@/services/clubMembershipRequest/clubMembershipRequestService';

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
    || '',
  ).trim();
  const lastName = String(
    item?.requesterLastname
    || item?.requester?.lastname
    || item?.requester?.lastName
    || item?.user?.lastname
    || item?.user?.lastName
    || '',
  ).trim();
  const username = String(
    item?.requester?.username
    || item?.user?.username
    || '',
  ).trim();
  const safeUsername = looksLikePhoneNumber(username) ? '' : username;
  const requesterDisplayName = String(
    item?.requesterDisplayName
    || item?.requester?.displayName
    || '',
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
  const {
    clubVerificationSummary,
    userData,
  } = useAuth();
  const isSuperAdmin = getUserRoleKey(userData?.role?.type || userData?.role?.name) === 'superAdmin';

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
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  /**
   * @type {ClubMembershipRequest[]}
   */
  const requests = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {ClubMembershipRequest[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);
  const isMissingClubId = !clubId;
  const initialErrorMessage = extractApiErrorMessage(error)
    || t(
      'clubMembershipRequestList.errors.load',
      'Impossible de charger les demandes du club pour le moment.',
    );

  const acceptRequestMutation = useMutation({
    mutationFn: acceptClubMembershipRequest,
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      const rawMessage = extractApiErrorMessage(mutationError);
      const isMissingRelation = rawMessage.includes('Membership request is missing user or club relation')
        || rawMessage.includes('utilisateur introuvable');
      Alert.alert(
        t('common.error', 'Erreur'),
        isMissingRelation
          ? t(
            'clubMembershipRequestList.errors.missingRequester',
            'Impossible de traiter cette demande. Demandez au joueur de renvoyer sa demande.',
          )
          : t(
            'clubMembershipRequestList.errors.accept',
            'Impossible de valider la demande pour le moment.',
          ),
      );
    },
    onSuccess: (_data, requestId) => {
      const acceptedRequest = requests.find((item) => item?.documentId === requestId);
      const { pendingName, title } = resolveRequesterDisplay(acceptedRequest || {}, t);
      const trainerLabel = pendingName || title || t('common.user', 'Utilisateur');
      const trainerId = acceptedRequest?.requester?.documentId
        || acceptedRequest?.user?.documentId
        || undefined;
      const isClaimRequest = acceptedRequest?.type === 'claim';

      refetch();

      if (isClaimRequest) {
        Alert.alert(
          t('clubMembershipRequestList.fields.claimAcceptedTitle', 'Dirigeant ajouté'),
          t(
            'clubMembershipRequestList.fields.claimAccepted',
            '{{firstname}} a bien été ajouté comme dirigeant du club.',
            { firstname: trainerLabel },
          ),
        );
        return;
      }

      Alert.alert(
        'Entraîneur ajouté',
        `${trainerLabel} a bien été ajouté ? votre club.\n\nVoulez-vous l'assigner ? une équipe maintenant ?`,
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
        ],
      );
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: rejectClubMembershipRequest,
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'clubMembershipRequestList.errors.reject',
          'Impossible de refuser la demande pour le moment.',
        ),
      );
    },
    onSuccess: () => {
      refetch();
    },
  });
  const isMutating = acceptRequestMutation.isPending || rejectRequestMutation.isPending;

  useEffect(() => {
    if (!REQUESTS_HUB_LEGACY_REDIRECT) return;
    navigateToRequestsHub(navigation, {
      initialFilter: 'club',
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
   * Render the request item
   * @param {object} param
   * @param {ClubMembershipRequest} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => (
    (() => {
      const { pendingName, title } = resolveRequesterDisplay(item, t);
      const isClaimRequest = item?.type === 'claim';
      const isClaimReadOnly = isClaimRequest && !isSuperAdmin;
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
              imageStyle={{ borderRadius: 44 }}
              imageUrl={item?.user?.avatar?.url || item?.requester?.avatar?.url}
              size={44}
              style={[
                ApplicationStyle.borderWidth1,
                ApplicationStyle.borderColor.neutral00,
                { borderRadius: 44 },
              ]}
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
                {isClaimRequest
                  ? t('clubMembershipRequestList.fields.pendingClaim', {
                    firstname: pendingName,
                  })
                  : t('clubMembershipRequestList.fields.pending', {
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
          {isClaimReadOnly ? (
            <View
              style={[
                Alignments.fullWidth,
                ApplicationStyle.backgroundColor.primary900,
                ApplicationStyle.borderRadius12,
                ApplicationStyle.borderWidth1,
                { borderColor: `${Colors.primary500}66` },
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
              ]}
            >
              <Text style={[Fonts.p3, Fonts.neutral100, Fonts.textCenter]}>
                {t(
                  'clubMembershipRequestList.fields.claimPendingVerification',
                  'Revendication en cours de verification FoundClub',
                )}
              </Text>
            </View>
          ) : (
            <View style={[Alignments.row, Alignments.fullWidth, Spaces.gap[12]]}>
              <Button
                disabled={isMutating}
                icon="check"
                isLoading={acceptRequestMutation.isPending}
                isOption
                onPress={() => handleAcceptRequest(item.documentId)}
                style={[Alignments.fill, { minHeight: 42 }]}
                title={t('clubMembershipRequestList.actions.accept')}
                variant="Primary"
              />
              <Button
                disabled={isMutating}
                icon="close"
                isLoading={rejectRequestMutation.isPending}
                isOption
                onPress={() => handleRejectRequest(item.documentId)}
                style={[Alignments.fill, { borderColor: Colors.error500, minHeight: 42 }]}
                textStyle={[Fonts.error500]}
                title={t('clubMembershipRequestList.actions.reject')}
                variant="Secondary"
              />
            </View>
          )}
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

  if (isMissingClubId) {
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
          {t('clubMembershipRequestList.errors.missingClubTitle', 'Club introuvable')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
          {t(
            'clubMembershipRequestList.errors.missingClubBody',
            "Impossible d'ouvrir ces demandes sans identifiant de club.",
          )}
        </Text>
        <Button
          onPress={() => navigateToRequestsHub(navigation, {
            initialFilter: 'club',
            source: 'profile',
          })}
          title={t('requestsHub.migratedBannerAction', "Ouvrir l'onglet Demandes")}
          variant="Primary"
        />
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
          {t('clubMembershipRequestList.errors.loadTitle', 'Chargement impossible')}
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
              initialFilter: 'club',
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
          <TouchableOpacity
            onPress={() => navigateToRequestsHub(navigation, {
              initialFilter: 'club',
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
            description="Traitez ici les demandes d'adhésion au club et assignez les profils valides."
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

        <SubscriptionPaywallSheet
          close={() => setSubscriptionPaywallDecision(null)}
          clubDocumentId={
            clubId
            || clubVerificationSummary?.clubDocumentId
            || userData?.club?.documentId
            || null
          }
          decision={subscriptionPaywallDecision}
          isVisible={Boolean(subscriptionPaywallDecision)}
          navigation={navigation}
        />
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default ClubMembershipRequestList;
