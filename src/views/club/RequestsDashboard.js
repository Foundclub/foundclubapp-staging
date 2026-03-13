import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, FlatList, Text, TouchableOpacity, View,
} from 'react-native';

import { navigateToRequestsHub, REQUESTS_HUB_LEGACY_REDIRECT } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMe } from '@/services/auth/authQueries';
import { cancelEvent, getEvents, updateEvent } from '@/services/event/eventService';

/**
 * RequestsDashboard component
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function RequestsDashboard({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const { data: userData } = useGetMe();

  const clubId = route?.params?.clubId || userData?.trainedTeams?.[0]?.club?.documentId;

  useEffect(() => {
    if (!REQUESTS_HUB_LEGACY_REDIRECT) return;
    navigateToRequestsHub(navigation, {
      initialFilter: 'event',
      source: 'home',
    });
  }, [navigation]);

  const { data: pendingEvents, isLoading } = useQuery({
    enabled: !!clubId,
    queryFn: async () => {
      if (!clubId) return [];
      const res = await getEvents({
        club: { value: clubId },
        sessionStatus: 'open',
        startDateAfter: new Date(),
        validationMode: 'manual',
      });
      return res.data;
    },
    queryKey: ['pendingEvents', clubId],
  });

  const updateMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] });
      Alert.alert(t('common.success'), t('requests.approvedSuccess'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] });
      Alert.alert(t('common.success'), t('requests.rejectedSuccess'));
    },
  });

  const handleApprove = (event) => {
    updateMutation.mutate({
      documentId: event.documentId,
      eventData: { validationMode: 'auto' },
    });
  };

  const handleReject = (event) => {
    Alert.alert(
      t('requests.rejectConfirmTitle'),
      t('requests.rejectConfirmMessage'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          onPress: () => cancelMutation.mutate(event.documentId),
          style: 'destructive',
          text: t('common.confirm'),
        },
      ],
    );
  };

  const renderItem = ({ item }) => {
    const date = new Date(item.date);
    const dateStr = format(date, 'EEEE d MMMM yyyy', { locale: fr });

    return (
      <View style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.marginBottom[16],
        { borderLeftColor: Colors.warning500, borderLeftWidth: 4 },
      ]}
      >
        <View style={[Alignments.row, Alignments.spaceBetween, Alignments.alignStart]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>{item.type?.name || 'Événement'}</Text>
            <Text style={[Fonts.p2, Fonts.neutral00, Spaces.marginTop[4]]}>
              {dateStr}
              {' '}
              •
              {' '}
              {item.startTime?.substring(0, 5)}
              {' '}
              -
              {' '}
              {item.endTime?.substring(0, 5)}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral00, Spaces.marginTop[4]]}>
              Lieu:
              {item.facility?.name || item.locationDetails || 'Non defini'}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary500, Spaces.marginTop[4]]}>
              Équipe:
              {item.team?.name || 'Équipe inconnue'}
            </Text>
          </View>
        </View>

        <View style={[Alignments.row, Spaces.gap[16], Spaces.marginTop[16]]}>
          <View style={{ flex: 1 }}>
            <Button
              isLoading={cancelMutation.isPending}
              onPress={() => handleReject(item)}
              style={{ borderColor: Colors.error500 }}
              textStyle={{ color: Colors.error500 }}
              title={t('common.reject', 'Refuser')}
              variant="Secondary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              isLoading={updateMutation.isPending}
              onPress={() => handleApprove(item)}
              title={t('common.validate', 'Valider')}
              variant="Primary"
            />
          </View>
        </View>
      </View>
    );
  };

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
      tutorialId={TutorialIds.REQUESTS_DASHBOARD}
      userId={userData?.documentId}
    >
      <ScreenContainer title={t('requests.title', 'Demandes en attente')}>
        <OnboardingWrapper
          description="Consultez puis validez ou refusez les demandes d événements en attente."
          id="requests-dashboard-list"
          order={1}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          style={{ flex: 1 }}
          title="Demandes en attente"
        >
          <TouchableOpacity
            onPress={() => navigateToRequestsHub(navigation, {
              initialFilter: 'event',
              source: 'home',
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
          <FlatList
            contentContainerStyle={[Spaces.padding[16]]}
            data={pendingEvents}
            keyExtractor={(item) => item.documentId}
            ListEmptyComponent={
              !isLoading && (
                <View style={[Alignments.center, Spaces.marginTop[40]]}>
                  <Text style={[Fonts.p1, Fonts.neutral00]}>{t('requests.empty', 'Aucune demande en attente')}</Text>
                </View>
              )
            }
            renderItem={renderItem}
          />
        </OnboardingWrapper>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default RequestsDashboard;
