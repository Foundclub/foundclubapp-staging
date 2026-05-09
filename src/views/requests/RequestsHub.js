import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceAction, emitGuidanceInteraction } from '@/domains/guidance/guidanceRuntime';
import {
  REQUEST_HUB_FILTERS,
} from '@/domains/requests/requestMappers';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import MissionDock from '@/components/molecules/guidance/MissionDock';
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
  acceptEventParticipation,
  declineEventParticipation,
} from '@/services/eventParticipation/eventParticipationService';
import {
  approveFacilityOverrideRequest,
  refuseFacilityOverrideRequest,
} from '@/services/facility/facilityService';
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
    case 'installation':
      return t('requestsHub.types.installation', 'Installation');
    case 'team':
      return t('requestsHub.types.team', 'Équipe');
    default:
      return t('requestsHub.types.unknown', 'Demande');
  }
};

const getSourceErrorDescription = (sourceError, t) => {
  const status = Number(sourceError?.status || 0);
  if (status === 403) {
    return t(
      'requestsHub.partialErrorForbidden',
      'Cette section n est pas disponible pour ce compte.',
    );
  }

  if (status >= 500) {
    return t(
      'requestsHub.partialErrorServer',
      'Le chargement est temporairement indisponible. Reessaie dans un instant.',
    );
  }

  return t(
    'requestsHub.partialErrorDescription',
    'Certaines demandes n ont pas pu etre chargees. Le reste reste disponible.',
  );
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
  const {
    canEditClub,
    canManageTeam,
    userData,
  } = useAuth();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState(() => normalizeFilter(route?.params?.initialFilter));
  const [installationRefusalItem, setInstallationRefusalItem] = useState(null);
  const [installationRefusalReason, setInstallationRefusalReason] = useState('');
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
  const canManageInstallationRequests = useMemo(
    () => Boolean(clubId && canEditClub(clubId)),
    [canEditClub, clubId],
  );

  const context = useMemo(() => ({
    canManageInstallationRequests,
    clubId,
    cmId,
    teamIds: trainedTeamIds,
  }), [canManageInstallationRequests, clubId, cmId, trainedTeamIds]);

  const requestsQuery = useRequestsHubData(context, {
    enabled: canManageTeam,
  });

  const availableFilters = useMemo(() => {
    /** @type {('all' | 'team' | 'club' | 'event' | 'featured' | 'installation')[]} */
    const filters = ['all'];
    if (trainedTeamIds.length || clubId) filters.push('team');
    if (clubId) filters.push('club', 'event');
    if (clubId || cmId) filters.push('featured');
    if (canManageInstallationRequests) filters.push('installation');
    return filters;
  }, [canManageInstallationRequests, clubId, cmId, trainedTeamIds.length]);

  useEffect(() => {
    if (!availableFilters.includes(activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, availableFilters]);

  useEffect(() => {
    emitGuidanceInteraction(`requests.filter.${activeFilter}`);
  }, [activeFilter]);

  const filteredItems = useMemo(() => {
    const items = requestsQuery?.data?.items || [];
    return (
      activeFilter === 'all'
        ? items
        : items.filter((item) => item?.type === activeFilter)
    );
  }, [activeFilter, requestsQuery?.data?.items]);

  const invalidateRequests = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['requestsHub'] }),
      queryClient.invalidateQueries({ queryKey: getRequestsHubQueryKey(context) }),
      queryClient.invalidateQueries({ queryKey: ['teamMembershipRequests'] }),
      queryClient.invalidateQueries({ queryKey: ['clubMembershipRequests'] }),
      queryClient.invalidateQueries({ queryKey: ['pendingEvents'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['facility-override-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ]);
  }, [context, queryClient]);

  const closeInstallationRefusalModal = useCallback(() => {
    setInstallationRefusalItem(null);
    setInstallationRefusalReason('');
  }, []);

  const handleClubAssignPrompt = useCallback((item) => {
    const trainerName = item?.meta?.requesterName || t('common.user', 'Utilisateur');
    const trainerId = item?.meta?.requesterId;
    const targetClubId = item?.meta?.clubId || clubId;
    const isClaimRequest = item?.meta?.requestType === 'claim';

    if (isClaimRequest) {
      Alert.alert(
        t('requestsHub.clubClaimAssignedTitle', 'Dirigeant ajouté'),
        t(
          'requestsHub.clubClaimAssignedMessage',
          '{{name}} a été ajouté comme dirigeant du club.',
        ).replace('{{name}}', trainerName),
      );
      return;
    }

    Alert.alert(
      t('requestsHub.clubAssignedTitle', 'Entraîneur ajouté'),
      t(
        'requestsHub.clubAssignedMessage',
        "{{name}} a été ajouté au club. Voulez-vous l'assigner à une équipe maintenant ?",
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

  const runItemAction = useCallback(async (item, actionPosition, overrideReason = '') => {
    const itemId = item?.id;
    if (!itemId) return;
    const action = actionPosition === 'primary' ? item?.actions?.primary : item?.actions?.secondary;
    if (!action) return;

    const requestId = item?.meta?.requestId;
    const eventId = item?.meta?.eventId;
    const featuredRequestId = item?.meta?.requestId;
    const participationRequestId = item?.meta?.participationRequestId;

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

    if (action === 'reject' && item?.type === 'installation' && actionPosition === 'secondary') {
      setInstallationRefusalItem(item);
      setInstallationRefusalReason(item?.meta?.reason || '');
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
        if (participationRequestId) {
          if (action === 'validate') await acceptEventParticipation(participationRequestId);
          if (action === 'reject') {
            await declineEventParticipation({ requestId: participationRequestId });
          }
        } else {
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
      }

      if (item?.type === 'featured') {
        if (!featuredRequestId) throw new Error('Missing featured request identifier');
        if (action === 'accept') await approveFeatured(featuredRequestId);
        if (action === 'reject') await rejectFeatured({ requestId: featuredRequestId });
      }

      if (item?.type === 'installation') {
        if (!requestId) throw new Error('Missing installation request identifier');
        if (action === 'accept') await approveFacilityOverrideRequest(requestId);
        if (action === 'reject') {
          await refuseFacilityOverrideRequest(
            requestId,
            overrideReason
            || t(
              'requestsHub.installation.defaultRefusalReason',
              'Creneau complet, depassement refuse par le dirigeant.',
            ),
          );
        }
      }

      await invalidateRequests();
      emitGuidanceAction('requests.processed', {
        requestType: item?.type || 'unknown',
      });
      if (item?.type === 'installation' && action === 'reject') {
        closeInstallationRefusalModal();
      }
    } catch (actionError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        actionError?.message || t('requestsHub.actionError', 'Impossible de traiter la demande.'),
      );
    } finally {
      setProcessingItemId('');
    }
  }, [closeInstallationRefusalModal, handleClubAssignPrompt, invalidateRequests, t]);

  const handlePrimaryPress = useCallback((item) => {
    runItemAction(item, 'primary');
  }, [runItemAction]);

  const handleSecondaryPress = useCallback((item) => {
    runItemAction(item, 'secondary');
  }, [runItemAction]);

  const handleInstallationRefusalConfirm = useCallback(() => {
    if (!installationRefusalItem) return;

    const trimmedReason = installationRefusalReason.trim();
    if (!trimmedReason) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'requestsHub.installation.refusalReasonRequired',
          'Ajoute un motif pour refuser cette demande d installation.',
        ),
      );
      return;
    }

    runItemAction(installationRefusalItem, 'secondary-confirmed', trimmedReason);
  }, [installationRefusalItem, installationRefusalReason, runItemAction, t]);

  const handleRequesterPress = useCallback((item) => {
    const requesterId = String(item?.meta?.requesterId || '').trim();
    if (!requesterId) return;

    if (requesterId === userData?.documentId) {
      navigation.navigate(RouteNames.ProfileStack);
      return;
    }

    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: requesterId },
      screen: RouteNames.UserDetails,
    });
  }, [navigation, userData?.documentId]);

  const handleEventPress = useCallback((item) => {
    const eventId = String(item?.meta?.eventId || '').trim();
    if (!eventId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const filterChips = useMemo(() => ([
    { key: 'all', label: t('requestsHub.filters.all', 'Toutes') },
    { key: 'team', label: t('requestsHub.filters.team', 'Équipe') },
    { key: 'club', label: t('requestsHub.filters.club', 'Club') },
    { key: 'event', label: t('requestsHub.filters.event', 'Événement') },
    { key: 'featured', label: t('requestsHub.filters.featured', 'À la une') },
    { key: 'installation', label: t('requestsHub.filters.installation', 'Installation') },
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
      <Modal
        animationType="fade"
        onRequestClose={closeInstallationRefusalModal}
        transparent
        visible={Boolean(installationRefusalItem)}
      >
        <View
          style={[
            Alignments.fill,
            Alignments.justifyCenter,
            Spaces.padding[24],
            { backgroundColor: 'rgba(0, 0, 0, 0.55)' },
          ]}
        >
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[20],
              Spaces.gap[16],
              {
                borderColor: `${Colors.warning500}66`,
              },
            ]}
          >
            <View style={[Spaces.gap[6]]}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                {t('requestsHub.installation.refusalModalTitle', 'Refuser la demande')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'requestsHub.installation.refusalModalDescription',
                  'Explique pourquoi cette exception installation est refusee.',
                )}
              </Text>
            </View>

            <TextInput
              multiline
              onChangeText={setInstallationRefusalReason}
              placeholder={t(
                'requestsHub.installation.refusalModalPlaceholder',
                'Exemple: capacite deja atteinte pour ce creneau.',
              )}
              placeholderTextColor={Colors.neutral400}
              style={[
                ApplicationStyle.borderRadius16,
                ApplicationStyle.borderWidth1,
                Fonts.p2,
                Fonts.neutral00,
                Spaces.padding[16],
                {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderColor: `${Colors.primary500}44`,
                  minHeight: 110,
                  textAlignVertical: 'top',
                },
              ]}
              value={installationRefusalReason}
            />

            <View style={[Alignments.row, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={Boolean(processingItemId)}
                  onPress={closeInstallationRefusalModal}
                  title={t('common.actions.cancel', 'Annuler')}
                  variant="Secondary"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={Boolean(processingItemId)}
                  onPress={handleInstallationRefusalConfirm}
                  title={t('common.reject', 'Refuser')}
                  variant="Primary"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
        <MissionDock />
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
            {sourceErrors.map((sourceError) => (
              <View
                key={`${sourceError?.source || 'source'}-${sourceError?.message || 'message'}`}
                style={[
                  ApplicationStyle.backgroundColor.primary700,
                  ApplicationStyle.borderRadius12,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[12],
                  Spaces.gap[4],
                  {
                    borderColor: `${Colors.primary500}44`,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                  {getSourceErrorLabel(sourceError?.source, t)}
                  {' '}
                  {t('requestsHub.partialErrorLabel', 'indisponible')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {getSourceErrorDescription(sourceError, t)}
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
              onEventPress={handleEventPress}
              onPrimaryPress={handlePrimaryPress}
              onRequesterPress={handleRequesterPress}
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
