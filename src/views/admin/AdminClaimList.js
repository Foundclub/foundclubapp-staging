/* eslint-disable no-underscore-dangle */

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
  useApproveClubClaim,
  useGetClubClaimsRequestList,
  useProcessAffiliationHelpRequest,
  useRefuseAffiliationHelpRequest,
  useRefuseClubClaim,
} from '@/services/admin/adminQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 *
 */
function AdminClaimList() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetClubClaimsRequestList();

  const approveMutation = useApproveClubClaim();
  const refuseClaimMutation = useRefuseClubClaim();
  const processHelpMutation = useProcessAffiliationHelpRequest();
  const refuseHelpMutation = useRefuseAffiliationHelpRequest();

  const requests = useMemo(() => data?.data || [], [data?.data]);

  if (isLoading && !requests.length) {
    return (
      <AdminStateView
        description="Nous chargeons les revendications et demandes en attente."
        isLoading
        title="Chargement des demandes"
      />
    );
  }

  if (error && !requests.length) {
    return (
      <AdminStateView
        actionLabel="R\u00E9essayer"
        description={getErrorMessage(error, 'generic') || 'Impossible de charger les demandes admin.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  const handlePrimaryAction = (item) => {
    if (item?.__isAffiliationHelp) {
      processHelpMutation.mutate(
        { documentId: item.documentId },
        { onSuccess: () => refetch() },
      );
      return;
    }

    approveMutation.mutate(item.documentId, {
      onSuccess: () => refetch(),
    });
  };

  const handleSecondaryAction = (item) => {
    if (item?.__isAffiliationHelp) {
      refuseHelpMutation.mutate(
        { documentId: item.documentId },
        { onSuccess: () => refetch() },
      );
      return;
    }

    refuseClaimMutation.mutate(item.documentId, {
      onSuccess: () => refetch(),
    });
  };

  const isPrimaryLoading = (item) => {
    if (item?.__isAffiliationHelp) {
      return processHelpMutation.isPending
                && processHelpMutation.variables?.documentId === item.documentId;
    }
    return approveMutation.isPending && approveMutation.variables === item.documentId;
  };

  const isSecondaryLoading = (item) => {
    if (item?.__isAffiliationHelp) {
      return refuseHelpMutation.isPending
                && refuseHelpMutation.variables?.documentId === item.documentId;
    }
    return refuseClaimMutation.isPending && refuseClaimMutation.variables === item.documentId;
  };

  const renderItem = ({ item }) => {
    const user = item?.user || {};
    const fullName = [user?.firstname, user?.lastname].filter(Boolean).join(' ').trim()
            || [item?.holderFirstname, item?.holderLastname].filter(Boolean).join(' ').trim()
            || 'Utilisateur';
    const date = item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';

    let subtitle = `Revendique: ${item?.club?.name || 'club inconnu'}`;
    if (item?.__isAffiliationHelp) {
      if (item?.requestKind === 'club_creation') {
        subtitle = `Club a onboarder: ${item?.clubName || 'non precise'}`;
      } else {
        subtitle = `Recherche: ${item?.clubName || 'non precise'}`;
      }
    }

    return (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.marginBottom[16],
          {
            borderLeftColor: item?.__isAffiliationHelp ? Colors.primary500 : Colors.warning500,
            borderLeftWidth: 4,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate(RouteNames.AdminClaimDetail, {
            requestId: item.documentId,
            requestType: item.__requestType,
          })}
          style={[Alignments.row, Alignments.alignStart]}
        >
          <ProfileAvatar
            imageUrl={user?.avatar?.url}
            size={50}
          />

          <View style={[Spaces.marginLeft[12], { flex: 1 }]}>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
              <Text numberOfLines={1} style={[Fonts.h4Black, { color: Colors.neutral00, flex: 1 }]}>
                {fullName}
              </Text>
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
                  {item?.__typeLabel || 'REVENDICATION'}
                </Text>
              </View>
            </View>

            <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[6]]}>
              {subtitle}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {date}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[16]]}>
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
              isLoading={isPrimaryLoading(item)}
              onPress={() => handlePrimaryAction(item)}
              size="small"
              title={item?.__isAffiliationHelp ? 'Traiter' : 'Accepter'}
              variant="Primary"
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer bgImage="bg2" title="Revendications et demandes">
      <FlatList
        contentContainerStyle={[Spaces.padding[16]]}
        data={requests}
        keyExtractor={(item) => item.documentId}
        ListEmptyComponent={!isLoading ? (
          <View style={[Alignments.center, Spaces.marginTop[40]]}>
            <Text style={[Fonts.h4, Fonts.neutral200]}>Aucune demande en attente</Text>
            <Text style={[Fonts.p2, Fonts.neutral500, Spaces.marginTop[8], { textAlign: 'center' }]}>
              Les revendications et demandes superadmin apparaitront ici.
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

export default AdminClaimList;
