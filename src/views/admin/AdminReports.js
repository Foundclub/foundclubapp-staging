import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetAdminReports } from '@/services/admin/adminQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const SOURCE_FILTERS = [
  { label: 'Tous', value: 'all' },
  { label: 'Evenements', value: 'event' },
  { label: 'Messages', value: 'message' },
];

const STATUS_FILTERS = [
  { label: 'Tous', value: 'all' },
  { label: 'En attente', value: 'pending' },
  { label: 'Resolus', value: 'resolved' },
  { label: 'Refuses', value: 'rejected' },
];

const formatDate = (value) => {
  if (!value) return 'Date inconnue';

  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (_error) {
    return 'Date inconnue';
  }
};

const getStatusLabel = (value) => {
  if (value === 'resolved') return 'Resolu';
  if (value === 'rejected') return 'Refuse';
  return 'En attente';
};

const getSourceLabel = (value) => (value === 'message' ? 'Message' : 'Evenement');

/**
 * Admin Reports screen component.
 * @returns {import('react').ReactElement}
 */
function AdminReports() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetAdminReports();

  const reports = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data?.data]);

  const filteredReports = useMemo(() => reports.filter((item) => {
    if (sourceFilter !== 'all' && item?.source !== sourceFilter) return false;
    if (statusFilter !== 'all' && item?.status !== statusFilter) return false;
    return true;
  }), [reports, sourceFilter, statusFilter]);

  if (isLoading && !reports.length) {
    return (
      <AdminStateView
        description="Nous récupérons les signalements evenements et messages."
        isLoading
        title="Chargement des signalements"
      />
    );
  }

  if (error && !reports.length) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(error, 'generic') || 'Impossible de charger les signalements admin.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  const handleOpenTarget = (item) => {
    if (item?.targetKind === 'event' && item?.targetDocumentId) {
      navigation.navigate(RouteNames.EventDetails, { eventId: item.targetDocumentId });
      return;
    }

    if (item?.targetKind === 'conversation' && item?.targetDocumentId) {
      navigation.navigate(RouteNames.Conversation, { chatId: item.targetDocumentId });
    }
  };

  const renderFilterGroup = (items, selectedValue, setValue) => (
    <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
      {items.map((item) => {
        const isSelected = item.value === selectedValue;
        return (
          <TouchableOpacity
            key={item.value}
            onPress={() => setValue(item.value)}
            style={{
              backgroundColor: isSelected ? `${Colors.primary500}22` : Colors.neutral800,
              borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: isSelected ? Colors.primary500 : Colors.neutral200 }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderItem = ({ item }) => (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          borderLeftColor: item?.source === 'message' ? Colors.warning500 : Colors.primary500,
          borderLeftWidth: 4,
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>{item?.targetLabel || 'Cible indisponible'}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[4]]}>
            {getSourceLabel(item?.source)}
            {' • '}
            {getStatusLabel(item?.status)}
          </Text>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral300]}>{formatDate(item?.createdAt)}</Text>
      </View>

      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {item?.message || 'Signalement sans detail.'}
      </Text>

      <Text style={[Fonts.p3, Fonts.neutral300]}>
        Par
        {' '}
        {item?.authorLabel || 'Utilisateur inconnu'}
      </Text>

      {item?.targetDocumentId ? (
        <Button
          onPress={() => handleOpenTarget(item)}
          size="small"
          title={item?.targetKind === 'conversation' ? 'Ouvrir la conversation' : "Ouvrir l'evenement"}
          variant="Primary"
        />
      ) : null}
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" title="Signalements">
      <FlatList
        contentContainerStyle={[Spaces.padding[16], Spaces.gap[16], { paddingBottom: 24 }]}
        data={filteredReports}
        keyExtractor={(item, index) => item?.documentId || `${item?.source || 'report'}-${index}`}
        ListEmptyComponent={(
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[8],
              Alignments.alignCenter,
              { marginTop: 12 },
            ]}
          >
            <Text style={[Fonts.h4, Fonts.neutral00]}>Aucun signalement a traiter</Text>
            <Text style={[Fonts.p2, Fonts.neutral300, Fonts.textCenter]}>
              Aucun element ne correspond aux filtres actuels.
            </Text>
          </View>
        )}
        ListHeaderComponent={(
          <View style={[Spaces.gap[16]]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p3Bold, Fonts.primary100]}>Source</Text>
              {renderFilterGroup(SOURCE_FILTERS, sourceFilter, setSourceFilter)}
            </View>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p3Bold, Fonts.primary100]}>Statut</Text>
              {renderFilterGroup(STATUS_FILTERS, statusFilter, setStatusFilter)}
            </View>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {filteredReports.length}
              {' '}
              signalement(s) affiche(s)
            </Text>
          </View>
        )}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
            tintColor={Colors.primary500}
          />
        )}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

export default AdminReports;
