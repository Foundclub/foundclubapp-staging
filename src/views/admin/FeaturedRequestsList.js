import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  approveFeatured,
  getPendingFeaturedRequests,
  rejectFeatured,
} from '@/services/event/eventService';

function RequestItemSeparator() {
  return <View style={{ height: 16 }} />;
}

const getScopeLabel = (kind) => {
  if (kind === 'PUBLIC') return 'Public';
  if (kind === 'SECTION') return 'Club';
  return 'Multisport';
};

/**
 *
 */
function FeaturedRequestsList() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState('pending');

  const {
    data: requestsResponse,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryFn: () => getPendingFeaturedRequests({
      status: filterStatus === 'pending' ? 'PENDING' : ['APPROVED', 'REJECTED'],
    }),
    queryKey: ['admin-featured-requests', filterStatus],
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ action, requestId }) => {
      if (action === 'approve') return approveFeatured(requestId);
      return rejectFeatured({ requestId });
    },
    onSuccess: (_data, variables) => {
      const isApproved = variables.action === 'approve';
      queryClient.invalidateQueries({ queryKey: ['admin-featured-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-requests-count'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      Alert.alert(
        isApproved ? 'Demande validee' : 'Demande refusee',
        isApproved ? "L'evenement est maintenant mis en avant." : 'La demande a ete rejetee.',
        [{ onPress: () => refetch(), text: 'OK' }],
      );
    },
  });

  const requests = useMemo(() => requestsResponse?.data || [], [requestsResponse?.data]);

  const handleAcceptRequest = (request) => {
    if (!request?.documentId) return;
    updateRequestMutation.mutate({
      action: 'approve',
      requestId: request.documentId,
    });
  };

  const handleRejectRequest = (request) => {
    if (!request?.documentId) return;
    updateRequestMutation.mutate({
      action: 'reject',
      requestId: request.documentId,
    });
  };

  const handleEventPress = (request) => {
    const eventId = request?.event?.documentId;
    if (!eventId) return;
    navigation.navigate(RouteNames.EventStack, { params: { eventId }, screen: RouteNames.EventDetails });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleEventPress(item)}
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius24,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        { borderColor: `${Colors.primary500}33` },
      ]}
    >
      <View style={Spaces.gap[4]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {item?.event?.name || item?.event?.type?.name || 'Evenement'}
        </Text>
        <Text style={[Fonts.p2, Fonts.primary100]}>
          {item?.event?.team?.club?.name || item?.targetClub?.name || item?.multisportClub?.name || '-'}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          Scope:
          {' '}
          {getScopeLabel(item?.kind)}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          Statut:
          {' '}
          {item?.status || '-'}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          Demandeur:
          {' '}
          {[item?.requester?.firstname, item?.requester?.lastname].filter(Boolean).join(' ') || 'Inconnu'}
        </Text>
      </View>
      {filterStatus === 'pending' ? (
        <View style={[Alignments.row, Spaces.gap[12]]}>
          <Button
            icon="check"
            isLoading={updateRequestMutation.isPending}
            isOption
            onPress={() => handleAcceptRequest(item)}
            style={{ flex: 1 }}
            title={t('common.accept', 'Accepter')}
            variant="Primary"
          />
          <Button
            icon="close"
            isLoading={updateRequestMutation.isPending}
            isOption
            onPress={() => handleRejectRequest(item)}
            style={{ flex: 1 }}
            title={t('common.refuse', 'Refuser')}
            variant="Secondary"
          />
        </View>
      ) : null}
    </TouchableOpacity>
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
        {filterStatus === 'pending' ? 'Aucune demande en attente' : 'Aucun historique'}
      </Text>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.fill,
      ]}
    >
      <WithDataWrapper
        error={error}
        isLoading={isLoading}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[
          Alignments.fill,
          Spaces.paddingHorizontal[16],
          ApplicationStyle.borderRadius2]}
        >
          <View style={[Alignments.row, Spaces.marginBottom[16], { backgroundColor: '#173844', borderRadius: 12, padding: 4 }]}>
            <TouchableOpacity
              onPress={() => setFilterStatus('pending')}
              style={[
                Alignments.fill,
                Alignments.alignCenter,
                Spaces.paddingVertical[8],
                { backgroundColor: filterStatus === 'pending' ? '#01B3F4' : 'transparent', borderRadius: 8 },
              ]}
            >
              <Text style={[Fonts.p2Bold, { color: filterStatus === 'pending' ? '#001218' : '#FFFFFF' }]}>
                En attente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterStatus('history')}
              style={[
                Alignments.fill,
                Alignments.alignCenter,
                Spaces.paddingVertical[8],
                { backgroundColor: filterStatus === 'history' ? '#01B3F4' : 'transparent', borderRadius: 8 },
              ]}
            >
              <Text style={[Fonts.p2Bold, { color: filterStatus === 'history' ? '#001218' : '#FFFFFF' }]}>
                Historique
              </Text>
            </TouchableOpacity>
          </View>

          <FlashList
            contentContainerStyle={{ paddingBottom: 24 }}
            data={requests}
            estimatedItemSize={200}
            ItemSeparatorComponent={RequestItemSeparator}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={renderEmptyList}
            onRefresh={refetch}
            refreshing={isLoading}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default FeaturedRequestsList;
