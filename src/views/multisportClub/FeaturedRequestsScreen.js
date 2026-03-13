import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View,
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

/**
 * Screen for multisport club admins to manage featured event requests
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function FeaturedRequestsScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const { userData } = useAuth();

  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
    isLoading,
    refetch,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => getPendingFeaturedRequests(cmId),
    queryKey: ['pending-featured-requests', cmId],
  });

  const approveMutation = useMutation({
    mutationFn: approveFeatured,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests', cmId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      Alert.alert(
        t('featuredRequests.approveSuccess.title', 'Demande acceptee'),
        t('featuredRequests.approveSuccess.message', "L'événement est maintenant à la une du club."),
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectFeatured,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests', cmId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      Alert.alert(
        t('featuredRequests.rejectSuccess.title', 'Demande refusee'),
        t('featuredRequests.rejectSuccess.message', 'Le demandeur a été notifie.'),
      );
    },
  });

  const handleApprove = useCallback((eventId) => {
    Alert.alert(
      t('featuredRequests.confirm.approve.title', 'Accepter la demande ?'),
      t('featuredRequests.confirm.approve.message', 'Cet événement sera visible dans le planning de tous les adherents du club.'),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: () => approveMutation.mutate(eventId),
          text: t('common.confirm', 'Accepter'),
        },
      ],
    );
  }, [approveMutation, t]);

  const handleReject = useCallback((eventId) => {
    Alert.alert(
      t('featuredRequests.confirm.reject.title', 'Refuser la demande ?'),
      t('featuredRequests.confirm.reject.message', 'Le demandeur sera notifie du refus.'),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: () => rejectMutation.mutate({ eventId }),
          style: 'destructive',
          text: t('common.confirm', 'Refuser'),
        },
      ],
    );
  }, [rejectMutation, t]);

  const handleEventPress = useCallback((event) => {
    if (event?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.documentId },
        screen: RouteNames.EventDetails,
      });
    }
  }, [navigation]);

  const requests = pendingRequests?.data || [];

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
          refreshControl={<RefreshControl onRefresh={refetch} refreshing={isLoading} />}
          showsVerticalScrollIndicator={false}
        >
          <WithDataWrapper error={error?.message} isLoading={isLoading} wrapperStyle={[Spaces.gap[16]]}>
            <OnboardingWrapper
              description="Analysez les demandes et validez les événements à la une."
              id="featured-requests-list"
              order={1}
              spotlight={{
                borderRadius: 16,
                maxHeight: 280,
                overlayOpacity: 0.4,
                paddingX: 2,
                paddingY: 2,
              }}
              title="Demandes à la une"
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
                requests.map((event) => (
                  <TouchableOpacity
                    key={event.documentId}
                    onPress={() => handleEventPress(event)}
                    style={[ApplicationStyle.borderRadius16, ApplicationStyle.backgroundColor.primary700, Spaces.padding[16], Spaces.gap[12]]}
                  >
                    <View style={[Spaces.gap[4]]}>
                      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{event.name || event.type?.name || 'Événement'}</Text>
                      <Text style={[Fonts.p2, Fonts.primary100]}>{event.team?.club?.name}</Text>
                      <Text style={[Fonts.p2, Fonts.primary100]}>
                        Date:
                        {event.date ? formatDateWithDayPrefix(event.date) : '-'}
                      </Text>
                    </View>
                    <View style={[Alignments.row, Spaces.gap[12]]}>
                      <Button icon="check" isLoading={approveMutation.isPending} isOption onPress={() => handleApprove(event.documentId)} style={{ flex: 1 }} title={t('common.accept', 'Accepter')} variant="Primary" />
                      <Button icon="close" isLoading={rejectMutation.isPending} isOption onPress={() => handleReject(event.documentId)} style={{ flex: 1 }} title={t('common.refuse', 'Refuser')} variant="Secondary" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </OnboardingWrapper>
          </WithDataWrapper>
        </ScrollView>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default FeaturedRequestsScreen;
