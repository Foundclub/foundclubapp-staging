import { useNavigation } from '@react-navigation/native';
import i18next from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetInAppPopupCampaigns } from '@/services/inAppPopupCampaign/inAppPopupCampaignQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const STATUS_FILTERS = [
  {
    get label() {
      return i18next.t('adminPopupCampaignList.filters.all', 'Tous');
    },
    value: '',
  },
  { label: 'Draft', value: 'draft' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Live', value: 'live' },
  { label: 'Paused', value: 'paused' },
  { label: 'Archived', value: 'archived' },
];

/**
 *
 */
function AdminPopupCampaignList() {
  const navigation = useNavigation();
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const params = useMemo(() => ({
    page: 1,
    pageSize: 50,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
  }), [search, statusFilter]);

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetInAppPopupCampaigns(params);

  const campaigns = Array.isArray(data?.data) ? data.data : [];

  if (isLoading) {
    return (
      <AdminStateView
        description={t(
          'adminPopupCampaignList.states.loadingDescription',
          'Nous préparons la liste des campagnes pop-up.',
        )}
        isLoading
        title={t('adminPopupCampaignList.states.loadingTitle', 'Chargement des campagnes')}
      />
    );
  }

  if (error) {
    return (
      <AdminStateView
        actionLabel={t('adminPopupCampaignList.states.retry', 'Réessayer')}
        description={getErrorMessage(error, 'generic') || t(
          'adminPopupCampaignList.states.errorDescription',
          'Impossible de charger les campagnes pop-up.',
        )}
        onAction={() => refetch()}
        title={t('adminPopupCampaignList.states.errorTitle', 'Chargement impossible')}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[24]]}
    >
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[24], Spaces.gap[16]]}>
        <Text style={[Fonts.h1, Fonts.neutral00]}>
          {t('adminPopupCampaignList.title', 'Campagnes pop-up')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
          {t(
            'adminPopupCampaignList.subtitle',
            'Crée, planifie et pilote les pop-ups in-app diffusés à l’ouverture.',
          )}
        </Text>
        <Button
          onPress={() => navigation.navigate(RouteNames.AdminPopupCampaignForm)}
          title={t('adminPopupCampaignList.create', 'Créer une campagne')}
        />
      </View>

      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[20], Spaces.gap[12]]}>
        <TextInput
          onChangeText={setSearch}
          placeholder={t(
            'adminPopupCampaignList.searchPlaceholder',
            'Rechercher par nom interne ou titre',
          )}
          placeholderTextColor={Colors.neutral300}
          style={[
            styles.input,
            ApplicationStyle.backgroundColor.neutral800,
            { borderColor: `${Colors.primary500}33`, color: Colors.neutral00 },
          ]}
          value={search}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[Spaces.gap[8], { flexDirection: 'row' }]}>
            {STATUS_FILTERS.map((filter) => {
              const isActive = filter.value === statusFilter;
              return (
                <TouchableOpacity
                  key={filter.value || 'all'}
                  onPress={() => setStatusFilter(filter.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? `${Colors.primary500}22` : Colors.neutral800,
                      borderColor: isActive ? Colors.primary500 : `${Colors.neutral300}33`,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, { color: isActive ? Colors.primary500 : Colors.neutral100 }]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[32], Spaces.gap[16]]}>
        {campaigns.map((campaign) => (
          <TouchableOpacity
            key={campaign.documentId}
            onPress={() => navigation.navigate(RouteNames.AdminPopupCampaignDetail, {
              campaignId: campaign.documentId,
            })}
            style={[
              styles.card,
              ApplicationStyle.backgroundColor.neutral800,
              { borderColor: `${Colors.primary500}26` },
            ]}
          >
            <View style={[styles.cardHeader, Spaces.marginBottom[8]]}>
              <Text style={[Fonts.h4, Fonts.neutral00, { flex: 1 }]}>{campaign.title || campaign.internalName}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}35` },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>{campaign.status}</Text>
              </View>
            </View>

            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              {campaign.internalName}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {campaign.templateKey}
              {' '}
              {t('adminPopupCampaignList.priority', '| Priorité')}
              {campaign.priority}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {campaign.summary?.audienceSummary || t(
                'adminPopupCampaignList.allUsers',
                'Tous les utilisateurs authentifiés',
              )}
            </Text>

            <View style={[styles.metricsRow, Spaces.marginTop[12]]}>
              <Text style={[Fonts.p4, { color: Colors.neutral200 }]}>
                Impressions
                {' '}
                {campaign.stats?.totalImpressions || 0}
              </Text>
              <Text style={[Fonts.p4, { color: Colors.neutral200 }]}>
                {t('adminPopupCampaignList.clicks', 'Clics')}
                {' '}
                {(campaign.stats?.primaryClickCount || 0) + (campaign.stats?.secondaryClickCount || 0)}
              </Text>
              <Text style={[Fonts.p4, { color: Colors.neutral200 }]}>
                Dismiss
                {' '}
                {campaign.stats?.dismissCount || 0}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {campaigns.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              ApplicationStyle.backgroundColor.neutral800,
              { borderColor: `${Colors.neutral300}22` },
            ]}
          >
            <Text style={[Fonts.h4, Fonts.neutral00]}>
              {t('adminPopupCampaignList.empty.title', 'Aucune campagne')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
              {t(
                'adminPopupCampaignList.empty.hint',
                'Ajuste les filtres ou crée une première campagne pop-up.',
              )}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
});

export default AdminPopupCampaignList;
