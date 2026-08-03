/* eslint-disable no-underscore-dangle, react/jsx-one-expression-per-line */

import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import {
  FlatList, RefreshControl, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetPendingClubOnboardingRequests,
  useProcessAffiliationHelpRequest,
  useRefuseAffiliationHelpRequest,
} from '@/services/admin/adminQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * Dedicated superadmin space for club onboarding requests.
 * @returns {import('react').ReactElement}
 */
function AdminClubOnboardingList() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetPendingClubOnboardingRequests();

  const processHelpMutation = useProcessAffiliationHelpRequest();
  const refuseHelpMutation = useRefuseAffiliationHelpRequest();

  const requests = useMemo(() => data?.data || [], [data?.data]);

  if (isLoading && !requests.length) {
    return (
      <AdminStateView
        description="Nous chargeons les demandes d'onboarding club."
        isLoading
        title="Chargement des onboardings"
      />
    );
  }

  if (error && !requests.length) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(error, 'generic') || 'Impossible de charger les demandes d\'onboarding.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  const handlePrimaryAction = (item) => {
    processHelpMutation.mutate(
      { documentId: item.documentId },
      { onSuccess: () => refetch() },
    );
  };

  const handleSecondaryAction = (item) => {
    refuseHelpMutation.mutate(
      { documentId: item.documentId },
      { onSuccess: () => refetch() },
    );
  };

  const isPrimaryLoading = (item) => (
    processHelpMutation.isPending
      && processHelpMutation.variables?.documentId === item.documentId
  );

  const isSecondaryLoading = (item) => (
    refuseHelpMutation.isPending
      && refuseHelpMutation.variables?.documentId === item.documentId
  );

  const renderItem = ({ item }) => {
    const requester = item?.user || {};
    const requesterLabel = [requester?.firstname, requester?.lastname].filter(Boolean).join(' ').trim() || 'Utilisateur';
    const managerLabel = [item?.holderFirstname, item?.holderLastname].filter(Boolean).join(' ').trim() || '-';
    const requestDate = item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => navigation.navigate(RouteNames.AdminClaimDetail, {
          requestId: item.documentId,
          requestType: item.__requestType,
        })}
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.marginBottom[16],
          Spaces.gap[14],
          {
            borderLeftColor: Colors.primary500,
            borderLeftWidth: 4,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {item?.clubName || 'Club non précisé'}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[4]]}>
              {requestDate}
            </Text>
          </View>
          <View
            style={{
              borderColor: Colors.primary500,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
              {item?.__typeLabel || 'CLUB A ONBOARDER'}
            </Text>
          </View>
        </View>

        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius16,
            Spaces.padding[16],
            Spaces.gap[10],
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>Dirigeant à contacter</Text>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{managerLabel}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Telephone: {item?.holderPhone || '-'}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Email: {item?.holderEmail || '-'}
          </Text>
        </View>

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <ProfileAvatar imageUrl={requester?.avatar?.url} name={requesterLabel} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{requesterLabel}</Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              Demandeur
            </Text>
          </View>
        </View>

        <View style={[Alignments.row, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Button
              isLoading={isSecondaryLoading(item)}
              onPress={() => handleSecondaryAction(item)}
              size="small"
              style={{ borderColor: Colors.error500 }}
              textStyle={{ color: Colors.error500 }}
              title="Refuser"
              variant="Secondary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => navigation.navigate(RouteNames.AdminClaimDetail, {
                requestId: item.documentId,
                requestType: item.__requestType,
              })}
              size="small"
              title="Voir detail"
              variant="Secondary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              isLoading={isPrimaryLoading(item)}
              onPress={() => handlePrimaryAction(item)}
              size="small"
              title="Traiter"
              variant="Primary"
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bgImage="bg2" title="Clubs à onboarder">
      <FlatList
        contentContainerStyle={[Spaces.padding[16]]}
        data={requests}
        keyExtractor={(item) => item.documentId}
        ListEmptyComponent={!isLoading ? (
          <View style={[Alignments.center, Spaces.marginTop[40]]}>
            <Text style={[Fonts.h4, Fonts.neutral200]}>Aucune demande en attente</Text>
            <Text style={[Fonts.p2, Fonts.neutral500, Spaces.marginTop[8], { textAlign: 'center' }]}>
              Les formulaires de clubs à onboarder apparaîtront ici.
            </Text>
          </View>
        ) : null}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
            tintColor={Colors.primary500}
          />
        )}
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

export default AdminClubOnboardingList;
