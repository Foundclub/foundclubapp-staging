import { useNavigation } from '@react-navigation/native';
import i18next from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetAdminReports } from '@/services/admin/adminQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const SOURCE_FILTERS = [
  {
    get label() {
      return i18next.t('adminReports.filters.all', 'Tous');
    },
    value: 'all',
  },
  {
    get label() {
      return i18next.t('adminReports.filters.events', 'Evenements');
    },
    value: 'event',
  },
  { label: 'Messages', value: 'message' },
];

const STATUS_FILTERS = [
  {
    get label() {
      return i18next.t('adminReports.filters.all', 'Tous');
    },
    value: 'all',
  },
  {
    get label() {
      return i18next.t('adminReports.status.pending', 'En attente');
    },
    value: 'pending',
  },
  {
    get label() {
      return i18next.t('adminReports.filters.resolved', 'Resolus');
    },
    value: 'resolved',
  },
  {
    get label() {
      return i18next.t('adminReports.filters.rejected', 'Refuses');
    },
    value: 'rejected',
  },
];

const formatDate = (value) => {
  if (!value) {
    return i18next.t('adminReports.unknownDate', 'Date inconnue');
  }

  try {
    return new Date(value).toLocaleString(localeDesFormats(), {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (_error) {
    return i18next.t('adminReports.unknownDate', 'Date inconnue');
  }
};

const getStatusLabel = (value) => {
  if (value === 'resolved') {
    return i18next.t('adminReports.status.resolved', 'Resolu');
  }
  if (value === 'rejected') {
    return i18next.t('adminReports.status.rejected', 'Refuse');
  }
  return i18next.t('adminReports.status.pending', 'En attente');
};

const getSourceLabel = (value) => (value === 'message' ? 'Message' : i18next.t(
  'adminReports.source.event',
  'Evenement',
));

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
  const { t } = useTranslation();
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
        description={t(
          'adminReports.states.loadingDescription',
          'Nous récupérons les signalements événements et messages.',
        )}
        isLoading
        title={t('adminReports.states.loadingTitle', 'Chargement des signalements')}
      />
    );
  }

  if (error && !reports.length) {
    return (
      <AdminStateView
        actionLabel={t('adminReports.states.retry', 'Réessayer')}
        description={getErrorMessage(error, 'generic') || t(
          'adminReports.states.errorDescription',
          'Impossible de charger les signalements admin.',
        )}
        onAction={refetch}
        title={t('adminReports.states.errorTitle', 'Chargement impossible')}
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
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            {item?.targetLabel || t('adminReports.targetUnavailable', 'Cible indisponible')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[4]]}>
            {getSourceLabel(item?.source)}
            {' • '}
            {getStatusLabel(item?.status)}
          </Text>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral300]}>{formatDate(item?.createdAt)}</Text>
      </View>

      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {item?.message || t('adminReports.noDetail', 'Signalement sans detail.')}
      </Text>

      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t('adminReports.by', 'Par')}
        {' '}
        {item?.authorLabel || t('adminReports.unknownUser', 'Utilisateur inconnu')}
      </Text>

      {item?.targetDocumentId ? (
        <Button
          onPress={() => handleOpenTarget(item)}
          size="small"
          title={item?.targetKind === 'conversation' ? t(
            'adminReports.openConversation',
            'Ouvrir la conversation',
          ) : t(
            'adminReports.openEvent',
            "Ouvrir l'événement",
          )}
          variant="Primary"
        />
      ) : null}
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" title={t('adminReports.title', 'Signalements')}>
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
            <Text style={[Fonts.h4, Fonts.neutral00]}>
              {t('adminReports.empty.title', 'Aucun signalement à traiter')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral300, Fonts.textCenter]}>
              {t('adminReports.empty.hint', 'Aucun element ne correspond aux filtres actuels.')}
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
              <Text style={[Fonts.p3Bold, Fonts.primary100]}>
                {t('adminReports.statusLabel', 'Statut')}
              </Text>
              {renderFilterGroup(STATUS_FILTERS, statusFilter, setStatusFilter)}
            </View>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {filteredReports.length}
              {' '}
              {t('adminReports.shownCount', 'signalement(s) affiche(s)')}
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
