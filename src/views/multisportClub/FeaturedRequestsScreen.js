import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { navigateToRequestsHub, REQUESTS_HUB_LEGACY_REDIRECT } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { approveFeatured, getPendingFeaturedRequests, rejectFeatured } from '@/services/event/eventService';

import { formatDateWithDayPrefix } from '@/utils/date';

import MultisportStateView from './components/MultisportStateView';
import useResolvedMultisportClub from './useResolvedMultisportClub';

/**
 * Screen for multisport club admins to manage featured event requests
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function FeaturedRequestsScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const { userData } = useAuth();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const {
    cmData,
    cmError,
    isFetchingCmData,
    isLoadingCmData,
    isLoadingUserData,
    refetchCm,
    refetchUserData,
    resolvedCmId,
    userDataError,
  } = useResolvedMultisportClub(cmId);

  const [pendingRequestId, setPendingRequestId] = useState(/** @type {string | null} */ (null));
  const [pendingAction, setPendingAction] = useState(/** @type {'approve' | 'reject' | null} */ (null));

  useEffect(() => {
    if (!REQUESTS_HUB_LEGACY_REDIRECT) return;
    navigateToRequestsHub(navigation, {
      initialFilter: 'featured',
      source: 'cm_dashboard',
    });
  }, [navigation]);

  const {
    data: pendingRequests,
    error,
    isFetching,
    isLoading,
    refetch: refetchRequests,
  } = useQuery({
    enabled: !!resolvedCmId,
    queryFn: () => getPendingFeaturedRequests({
      cmId: resolvedCmId,
      scope: 'CM',
      status: 'PENDING',
    }),
    queryKey: ['pending-featured-requests', resolvedCmId],
  });

  const handleMutationSettled = useCallback(() => {
    setPendingAction(null);
    setPendingRequestId(null);
  }, []);

  const approveMutation = useMutation({
    mutationFn: approveFeatured,
    onSettled: handleMutationSettled,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests', resolvedCmId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetchRequests();
      Alert.alert(
        t('featuredRequests.approveSuccess.title', 'Demande acceptee'),
        t('featuredRequests.approveSuccess.message', "L'evenement est maintenant a la une du club."),
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectFeatured,
    onSettled: handleMutationSettled,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests', resolvedCmId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetchRequests();
      Alert.alert(
        t('featuredRequests.rejectSuccess.title', 'Demande refusee'),
        t('featuredRequests.rejectSuccess.message', 'Le demandeur a ete notifie.'),
      );
    },
  });

  const handleApprove = useCallback((requestId) => {
    Alert.alert(
      t('featuredRequests.confirm.approve.title', 'Accepter la demande ?'),
      t('featuredRequests.confirm.approve.message', 'Cet evenement sera visible dans le planning de tous les adherents du club.'),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: () => {
            setPendingAction('approve');
            setPendingRequestId(requestId);
            approveMutation.mutate(requestId);
          },
          text: t('common.confirm', 'Accepter'),
        },
      ],
    );
  }, [approveMutation, t]);

  const handleReject = useCallback((requestId) => {
    Alert.alert(
      t('featuredRequests.confirm.reject.title', 'Refuser la demande ?'),
      t('featuredRequests.confirm.reject.message', 'Le demandeur sera notifie du refus.'),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: () => {
            setPendingAction('reject');
            setPendingRequestId(requestId);
            rejectMutation.mutate({ requestId });
          },
          style: 'destructive',
          text: t('common.confirm', 'Refuser'),
        },
      ],
    );
  }, [rejectMutation, t]);

  const handleEventPress = useCallback((request) => {
    const event = request?.event;
    if (!event?.documentId) return;
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    refetchRequests();
    refetchCm();
    if (!resolvedCmId) {
      refetchUserData();
    }
  }, [refetchCm, refetchRequests, refetchUserData, resolvedCmId]);

  const requests = pendingRequests?.data || [];
  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  if (isLoadingUserData && !resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.featured.loadingUser', 'Nous preparons les demandes a la une de votre structure multisport.')}
        isLoading
        title={t('multisport.featured.loadingUserTitle', 'Chargement du club')}
      />
    );
  }

  if (userDataError && !resolvedCmId) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.featured.userError', "Impossible de retrouver votre structure multisport pour le moment.")}
        onAction={() => refetchUserData()}
        title={t('multisport.featured.userErrorTitle', 'Demandes indisponibles')}
      />
    );
  }

  if (!resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.fallback.noClub', 'Aucun club multisport associe a ce compte.')}
        title={t('multisport.fallback.noClubTitle', 'Aucun club multisport')}
      />
    );
  }

  if (isLoadingCmData && !cmData) {
    return (
      <MultisportStateView
        description={t('multisport.featured.loading', 'Nous chargeons les informations de votre structure multisport.')}
        isLoading
        title={t('multisport.featured.loadingTitle', 'Chargement des demandes')}
      />
    );
  }

  if (cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.featured.error', "Impossible de charger cette structure multisport pour le moment.")}
        onAction={() => refetchCm()}
        title={t('multisport.featured.errorTitle', 'Demandes indisponibles')}
      />
    );
  }

  if (!isLoadingCmData && !cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Actualiser')}
        description={t('multisport.featured.notFound', "Cette structure multisport est introuvable ou n'est plus accessible.")}
        onAction={() => refetchCm()}
        title={t('multisport.featured.notFoundTitle', 'Club introuvable')}
      />
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
      tutorialId={TutorialIds.FEATURED_REQUESTS}
      userId={userData?.documentId}
    >
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <ScrollView
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[40]]}
          refreshControl={(
            <RefreshControl
              onRefresh={handleRefresh}
              refreshing={isLoading || isFetching || isFetchingCmData}
            />
          )}
          showsVerticalScrollIndicator={false}
        >
          <WithDataWrapper error={error} isLoading={isLoading} wrapperStyle={[Spaces.gap[16]]}>
            <OnboardingWrapper
              description="Analysez les demandes et validez les evenements a la une."
              id="featured-requests-list"
              order={1}
              spotlight={{
                borderRadius: 16,
                maxHeight: 280,
                overlayOpacity: 0.4,
                paddingX: 2,
                paddingY: 2,
              }}
              title="Demandes a la une"
            >
              <TouchableOpacity
                onPress={() => navigateToRequestsHub(navigation, {
                  initialFilter: 'featured',
                  source: 'cm_dashboard',
                })}
                style={[
                  ApplicationStyle.borderRadius12,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[12],
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.12)',
                    borderColor: 'rgba(1, 179, 244, 0.45)',
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
              {requests.length === 0 ? (
                <View style={[ApplicationStyle.borderRadius16, ApplicationStyle.backgroundColor.primary700, Spaces.padding[24], Alignments.alignCenter]}>
                  <Text style={[Fonts.p1, Fonts.neutral00, Fonts.textCenter]}>
                    {t('featuredRequests.empty', 'Aucune demande en attente')}
                  </Text>
                </View>
              ) : (
                requests.map((request) => {
                  const event = request?.event || {};
                  const isApproveLoading = pendingRequestId === request.documentId && pendingAction === 'approve';
                  const isRejectLoading = pendingRequestId === request.documentId && pendingAction === 'reject';

                  return (
                    <TouchableOpacity
                      key={request.documentId}
                      onPress={() => handleEventPress(request)}
                      style={[ApplicationStyle.borderRadius16, ApplicationStyle.backgroundColor.primary700, Spaces.padding[16], Spaces.gap[12]]}
                    >
                      <View style={[Spaces.gap[4]]}>
                        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                          {event.name || event.type?.name || request?.name || 'Evenement'}
                        </Text>
                        <Text style={[Fonts.p2, Fonts.primary100]}>
                          {event.team?.club?.name || cmData?.name || '-'}
                        </Text>
                        <Text style={[Fonts.p2, Fonts.primary100]}>
                          Date:
                          {event.date ? formatDateWithDayPrefix(event.date) : '-'}
                        </Text>
                      </View>
                      <View style={[Alignments.row, Spaces.gap[12]]}>
                        <Button
                          disabled={isMutating}
                          icon="check"
                          isLoading={isApproveLoading}
                          isOption
                          onPress={() => handleApprove(request.documentId)}
                          style={{ flex: 1 }}
                          title={t('common.accept', 'Accepter')}
                          variant="Primary"
                        />
                        <Button
                          disabled={isMutating}
                          icon="close"
                          isLoading={isRejectLoading}
                          isOption
                          onPress={() => handleReject(request.documentId)}
                          style={{ flex: 1 }}
                          title={t('common.refuse', 'Refuser')}
                          variant="Secondary"
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </OnboardingWrapper>
          </WithDataWrapper>
        </ScrollView>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default FeaturedRequestsScreen;
