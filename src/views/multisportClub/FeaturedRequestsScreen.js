import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import { getPendingFeaturedRequests, approveFeatured, rejectFeatured } from '@/services/event/eventService';
import { formatDateWithDayPrefix } from '@/utils/date';

/**
 * Screen for multisport club admins to manage featured event requests
 */
function FeaturedRequestsScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: pendingRequests,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['pending-featured-requests', cmId],
    queryFn: () => getPendingFeaturedRequests(cmId),
    enabled: !!cmId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: approveFeatured,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests', cmId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      Alert.alert(
        t('featuredRequests.approveSuccess.title', 'Demande acceptée'),
        t('featuredRequests.approveSuccess.message', "L'événement est maintenant à la une du club.")
      );
    },
    onError: (error) => {
      console.error('Error approving featured request:', error);
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('featuredRequests.approveError', 'Une erreur est survenue')
      );
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: rejectFeatured,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests', cmId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      Alert.alert(
        t('featuredRequests.rejectSuccess.title', 'Demande refusée'),
        t('featuredRequests.rejectSuccess.message', 'Le demandeur a été notifié.')
      );
    },
    onError: (error) => {
      console.error('Error rejecting featured request:', error);
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('featuredRequests.rejectError', 'Une erreur est survenue')
      );
    },
  });

  const handleApprove = useCallback((eventId) => {
    Alert.alert(
      t('featuredRequests.confirm.approve.title', 'Accepter la demande ?'),
      t('featuredRequests.confirm.approve.message', "Cet événement sera visible dans le planning de tous les adhérents du club."),
      [
        { text: t('common.cancel', 'Annuler'), style: 'cancel' },
        {
          text: t('common.confirm', 'Accepter'),
          onPress: () => approveMutation.mutate(eventId),
        },
      ]
    );
  }, [approveMutation, t]);

  const handleReject = useCallback((eventId) => {
    Alert.alert(
      t('featuredRequests.confirm.reject.title', 'Refuser la demande ?'),
      t('featuredRequests.confirm.reject.message', 'Le demandeur sera notifié du refus.'),
      [
        { text: t('common.cancel', 'Annuler'), style: 'cancel' },
        {
          text: t('common.confirm', 'Refuser'),
          style: 'destructive',
          onPress: () => rejectMutation.mutate({ eventId }),
        },
      ]
    );
  }, [rejectMutation, t]);

  const handleEventPress = useCallback((event) => {
    if (event?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        screen: RouteNames.EventDetails,
        params: { eventId: event.documentId },
      });
    }
  }, [navigation]);

  const requests = pendingRequests?.data || [];

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[16],
          Spaces.paddingBottom[40],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Spaces.gap[16]]}
        >
          {requests.length === 0 ? (
            <View style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.backgroundColor.primary700,
              Spaces.padding[24],
              Alignments.alignCenter,
            ]}>
              <Text style={[Fonts.p1, Fonts.neutral00, Fonts.textCenter]}>
                {t('featuredRequests.empty', 'Aucune demande en attente')}
              </Text>
            </View>
          ) : (
            requests.map((event) => (
              <TouchableOpacity
                key={event.documentId}
                onPress={() => handleEventPress(event)}
                style={[
                  ApplicationStyle.borderRadius16,
                  ApplicationStyle.backgroundColor.primary700,
                  Spaces.padding[16],
                  Spaces.gap[12],
                ]}
              >
                {/* Event Info */}
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                    {event.name || event.type?.name || 'Événement'}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {event.team?.club?.name}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    📅 {event.date ? formatDateWithDayPrefix(event.date) : '-'}
                  </Text>
                  {event.featuredBy && (
                    <Text style={[Fonts.p3, Fonts.neutral00]}>
                      Demandé par: {event.featuredBy.firstname} {event.featuredBy.lastname}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={[Alignments.row, Spaces.gap[12]]}>
                  <Button
                    icon="check"
                    isOption
                    isLoading={approveMutation.isPending}
                    onPress={() => handleApprove(event.documentId)}
                    style={{ flex: 1 }}
                    title={t('common.accept', 'Accepter')}
                    variant="Primary"
                  />
                  <Button
                    icon="close"
                    isOption
                    isLoading={rejectMutation.isPending}
                    onPress={() => handleReject(event.documentId)}
                    style={{ flex: 1 }}
                    title={t('common.refuse', 'Refuser')}
                    variant="Secondary"
                  />
                </View>
              </TouchableOpacity>
            ))
          )}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default FeaturedRequestsScreen;
