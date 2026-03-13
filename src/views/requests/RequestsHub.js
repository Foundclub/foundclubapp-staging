import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  REQUEST_HUB_FILTERS,
} from '@/domains/requests/requestMappers';
import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import RequestFeedItem from '@/components/molecules/requestFeedItem/RequestFeedItem';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { acceptClubMembershipRequest, rejectClubMembershipRequest } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import {
  approveFeatured,
  cancelEvent,
  rejectFeatured,
  updateEvent,
} from '@/services/event/eventService';
import {
  getRequestsHubQueryKey,
  useRequestsHubData,
} from '@/services/requests/requestsHubQueries';
import {
  acceptTeamMembershipRequest,
  rejectTeamMembershipRequest,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

const isValidFilter = (value) => REQUEST_HUB_FILTERS.includes(value);

const normalizeFilter = (value) => {
  if (typeof value !== 'string') return 'all';
  return isValidFilter(value) ? value : 'all';
};

const getSourceErrorLabel = (source, t) => {
  switch (source) {
    case 'club':
      return t('requestsHub.types.club', 'Club');
    case 'event':
      return t('requestsHub.types.event', 'Événement');
    case 'featured':
      return t('requestsHub.types.featured', 'À la une');
    case 'team':
      return t('requestsHub.types.team', 'Équipe');
    default:
      return t('requestsHub.types.unknown', 'Demande');
  }
};

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function RequestsHub({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { canManageTeam, userData } = useAuth();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState(() => normalizeFilter(route?.params?.initialFilter));
  const [processingItemId, setProcessingItemId] = useState('');

  useEffect(() => {
    const nextFilter = normalizeFilter(route?.params?.initialFilter);
    setActiveFilter(nextFilter);
  }, [route?.params?.initialFilter]);

  const trainedTeamIds = useMemo(
    () => (userData?.trainedTeams || []).map((team) => team?.documentId).filter(Boolean),
    [userData?.trainedTeams],
  );
  const clubId = userData?.club?.documentId || userData?.trainedTeams?.[0]?.club?.documentId || '';
  const cmId = userData?.multisportClubs?.[0]?.documentId || '';

  const context = useMemo(() => ({
    clubId,
    cmId,
    teamIds: trainedTeamIds,
  }), [clubId, cmId, trainedTeamIds]);

  const requestsQuery = useRequestsHubData(context, {
    enabled: canManageTeam,
  });

  const availableFilters = useMemo(() => {
    /** @type {('all' | 'team' | 'club' | 'event' | 'featured')[]} */
    const filters = ['all'];
    if (trainedTeamIds.length) filters.push('team');
    if (clubId) filters.push('club', 'event');
    if (cmId) filters.push('featured');
    return filters;
  }, [clubId, cmId, trainedTeamIds.length]);

  useEffect(() => {
    if (!availableFilters.includes(activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, availableFilters]);

  const items = requestsQuery?.data?.items || [];
  const filteredItems = useMemo(() => (
    activeFilter === 'all'
      ? items
      : items.filter((item) => item?.type === activeFilter)
  ), [activeFilter, items]);

  const invalidateRequests = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requestsHub'] }),
      queryClient.invalidateQueries({ queryKey: getRequestsHubQueryKey(context) }),
      queryClient.invalidateQueries({ queryKey: ['teamMembershipRequests'] }),
      queryClient.invalidateQueries({ queryKey: ['clubMembershipRequests'] }),
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ]);
  }, [context, queryClient]);

  const handleClubAssignPrompt = useCallback((item) => {
    const trainerName = item?.meta?.requesterName || t('common.user', 'Utilisateur');
    const trainerId = item?.meta?.requesterId;
    const targetClubId = item?.meta?.clubId || clubId;

    Alert.alert(
      t('requestsHub.clubAssignedTitle', 'Entraîneur ajoute'),
      t(
        'requestsHub.clubAssignedMessage',
        "{{name}} a été ajoute au club. Voulez-vous l'assigner a une équipe maintenant ?",
      ).replace('{{name}}', trainerName),
      [
        { style: 'cancel', text: t('common.actions.askLater', 'Plus tard') },
        {
          onPress: () => {
            if (!targetClubId || !trainerId) return;
            navigation.navigate(RouteNames.ClubStack, {
              params: {
                clubId: targetClubId,
                trainerId,
                trainerName,
              },
              screen: RouteNames.AssignCoachTeams,
            });
          },
          text: t('requestsHub.assignNow', 'Assigner maintenant'),
        },
      ],
    );
  }, [clubId, navigation, t]);

  const runItemAction = useCallback(async (item, actionPosition) => {
    const itemId = item?.id;
    if (!itemId) return;
    const action = actionPosition === 'primary' ? item?.actions?.primary : item?.actions?.secondary;
    if (!action) return;

    const requestId = item?.meta?.requestId;
    const eventId = item?.meta?.eventId;

    if (action === 'reject' && item?.type === 'event' && actionPosition === 'secondary') {
      Alert.alert(
        t('requestsHub.rejectEventTitle', 'Refuser la demande ?'),
        t('requestsHub.rejectEventMessage', "L'événement sera annulé."),
        [
          { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
          {
            onPress: () => {
              runItemAction(item, 'secondary-confirmed');
            },
            style: 'destructive',
            text: t('common.actions.confirm', 'Confirmer'),
          },
        ],
      );
      return;
    }

    if (action === 'reject' && item?.type === 'featured' && actionPosition === 'secondary') {
      Alert.alert(
        t('requestsHub.rejectFeaturedTitle', 'Refuser la demande ?'),
        t('requestsHub.rejectFeaturedMessage', 'Le demandeur sera notifie du refus.'),
        [
          { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
          {
            onPress: () => {
              runItemAction(item, 'secondary-confirmed');
            },
            style: 'destructive',
            text: t('common.actions.confirm', 'Confirmer'),
          },
        ],
      );
      return;
    }

    try {
      setProcessingItemId(itemId);

      if (item?.type === 'team') {
        if (!requestId) throw new Error('Missing request identifier');
        if (action === 'accept') await acceptTeamMembershipRequest(requestId);
        if (action === 'reject') await rejectTeamMembershipRequest(requestId);
      }

      if (item?.type === 'club') {
        if (!requestId) throw new Error('Missing request identifier');
        if (action === 'accept') {
          await acceptClubMembershipRequest(requestId);
          handleClubAssignPrompt(item);
        }
        if (action === 'reject') await rejectClubMembershipRequest(requestId);
      }

      if (item?.type === 'event') {
        if (!eventId) throw new Error('Missing event identifier');
        if (action === 'validate') {
          await updateEvent({
            documentId: eventId,
            eventData: { validationMode: 'auto' },
          });
        }
        if (action === 'reject') {
          await cancelEvent({ documentId: eventId });
        }
      }

      if (item?.type === 'featured') {
        if (!eventId) throw new Error('Missing event identifier');
        if (action === 'accept') await approveFeatured(eventId);
        if (action === 'reject') await rejectFeatured({ eventId });
      }

      await invalidateRequests();
    } catch (actionError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        actionError?.message || t('requestsHub.actionError', 'Impossible de traiter la demande.'),
      );
    } finally {
      setProcessingItemId('');
    }
  }, [handleClubAssignPrompt, invalidateRequests, t]);

  const handlePrimaryPress = useCallback((item) => {
    runItemAction(item, 'primary');
  }, [runItemAction]);

  const handleSecondaryPress = useCallback((item) => {
    runItemAction(item, 'secondary');
  }, [runItemAction]);

  const filterChips = useMemo(() => ([
    { key: 'all', label: t('requestsHub.filters.all', 'Toutes') },
    { key: 'team', label: t('requestsHub.filters.team', 'Équipe') },
    { key: 'club', label: t('requestsHub.filters.club', 'Club') },
    { key: 'event', label: t('requestsHub.filters.event', 'Événement') },
    { key: 'featured', label: t('requestsHub.filters.featured', 'À la une') },
  ]).filter((chip) => availableFilters.includes(chip.key)), [availableFilters, t]);

  const sourceErrors = requestsQuery?.data?.errors || [];
  const canGoBack = typeof navigation?.canGoBack === 'function' && navigation.canGoBack();

  const handleBackPress = useCallback(() => {
    if (canGoBack) {
      navigation.goBack();
      return;
    }

    navigation.navigate(RouteNames.HomeTab);
  }, [canGoBack, navigation]);

  if (!canManageTeam) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.justifyCenter, Alignments.alignCenter, Spaces.padding[24]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
            {t('requestsHub.forbidden', 'Cet onglet est reserve aux coachs et dirigeants.')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill]}
    >
      <WithDataWrapper
        error={requestsQuery?.error?.message}
        isLoading={requestsQuery.isLoading}
        wrapperStyle={[Alignments.fill, Spaces.gap[16], Spaces.paddingTop[16]]}
      >
        <View style={[Alignments.row, Alignments.alignCenter]}>
          <HeaderBackButton
            onPress={handleBackPress}
            withDefaultMargin={false}
          />
        </View>

        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('requestsHub.title', 'Demandes')}
        </Text>
        <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], Spaces.marginBottom[8]]}>
          {filterChips.map((chip) => {
            const isActive = chip.key === activeFilter;
            return (
              <TouchableOpacity
                key={chip.key}
                onPress={() => setActiveFilter(chip.key)}
                style={[
                  ApplicationStyle.borderRadius24,
                  ApplicationStyle.borderWidth1,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  {
                    backgroundColor: isActive ? Colors.primary500 : 'rgba(11, 63, 80, 0.6)',
                    borderColor: isActive ? Colors.primary500 : `${Colors.primary500}66`,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, isActive ? Fonts.neutral00 : Fonts.primary100]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {sourceErrors.length > 0 ? (
          <View style={[Spaces.gap[8], Spaces.marginBottom[8]]}>
            {sourceErrors.map((sourceError, index) => (
              <View
                key={`${sourceError?.source || 'source'}-${index}`}
                style={[
                  ApplicationStyle.borderRadius12,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[12],
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: `${Colors.error500}88`,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.error500]}>
                  {t('requestsHub.partialError', 'Source indisponible')}
                  :
                  {getSourceErrorLabel(sourceError?.source, t)}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {sourceError?.message}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <FlatList
          contentContainerStyle={[Spaces.gap[12], { paddingBottom: 56 }]}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={(
            <View
              style={[
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius16,
                ApplicationStyle.borderWidth1,
                Spaces.padding[20],
                Alignments.alignCenter,
                {
                  borderColor: `${Colors.primary500}33`,
                },
              ]}
            >
              <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
                {t('requestsHub.empty', 'Aucune demande en attente')}
              </Text>
            </View>
          )}
          refreshControl={(
            <RefreshControl
              onRefresh={requestsQuery.refetch}
              refreshing={requestsQuery.isRefetching}
              tintColor={Colors.primary500}
            />
          )}
          renderItem={({ item }) => (
            <RequestFeedItem
              isBusy={processingItemId === item.id}
              item={item}
              onPrimaryPress={handlePrimaryPress}
              onSecondaryPress={handleSecondaryPress}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default RequestsHub;
