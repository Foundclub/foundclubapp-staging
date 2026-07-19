// @ts-nocheck
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { RouteNames } from '@/navigation/routeNames';

import { useGetSuperadminEntries } from '@/services/admin/superadminQueries';
import {
  connectLicenseHelloAsso,
  getLicensePaymentStatus,
} from '@/services/license/licenseService';

import { getErrorMessage } from '@/utils/errors/displayError';

import {
  formatLicenseMoney,
  getLicenseStatusTone,
  LicenseCard,
  licenseSpacing,
  LicenseStatusChip,
  paymentModeLabels,
} from '../license/licenseDesignSystem';
import AdminStateView from './components/AdminStateView';
import SuperAdminLeagueCard from './components/SuperAdminLeagueCard';
import SuperAdminLeagueLayout from './components/SuperAdminLeagueLayout';

const CAMPAIGN_UID = 'api::license-campaign.license-campaign';
const PAYMENT_UID = 'api::license-payment.license-payment';
const PROVIDER_ACCOUNT_UID = 'api::license-payment-provider-account.license-payment-provider-account';
const PROVIDER_EVENT_UID = 'api::license-provider-event.license-provider-event';
const MAX_PAGE_SIZE = 100;

const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const readString = (value) => (typeof value === 'string' ? value.trim() : '');
const formatTimestamp = (value) => {
  const normalized = readString(value);
  if (!normalized) return 'Jamais';
  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) return normalized;
  return parsedDate.toLocaleString('fr-FR');
};

const firstNonEmptyString = (...values) => (
  values
    .map((value) => readString(value))
    .find(Boolean)
  || ''
);

const readEntityLabel = (entity) => {
  const source = safeObject(entity);
  return firstNonEmptyString(
    source.name,
    source.title,
    source.label,
    [source.firstname, source.lastname].filter(Boolean).join(' '),
    source.username,
    source.email,
    source.documentId,
  );
};

const readEntityDocumentId = (entity) => readString(safeObject(entity).documentId);

const readPaymentModes = (campaign) => safeObject(safeObject(campaign).paymentModes);
const readHelloAssoConfig = (providerAccount) => safeObject(safeObject(providerAccount).publicConfig);
const readHelloAssoHealth = (providerAccount) => safeObject(readHelloAssoConfig(providerAccount).health);

const getCampaignMode = (campaign) => {
  const modes = readPaymentModes(campaign);
  if (modes.helloasso) return 'helloasso';
  if (modes.external_link) return 'external_link';
  return 'offline';
};

const getCampaignScope = (campaign) => {
  const source = safeObject(campaign);
  const club = safeObject(source.club);
  const parentMultisport = safeObject(club.parentMultisport);
  const paymentOwner = readString(source.paymentOwner) || 'section';

  if (paymentOwner === 'multisport') {
    return {
      club,
      key: readEntityDocumentId(parentMultisport)
        ? `multisport:${readEntityDocumentId(parentMultisport)}`
        : 'multisport:missing',
      label: readEntityLabel(parentMultisport) || 'Multisport manquant',
      mode: 'multisport',
      multisport: parentMultisport,
    };
  }

  return {
    club,
    key: readEntityDocumentId(club) ? `club:${readEntityDocumentId(club)}` : 'club:missing',
    label: readEntityLabel(club) || 'Club manquant',
    mode: 'section',
    multisport: parentMultisport,
  };
};

const getProviderScope = (account) => {
  const source = safeObject(account);
  const club = safeObject(source.club);
  const multisport = safeObject(source.multisportClub);
  if (readEntityDocumentId(multisport)) {
    return {
      key: `multisport:${readEntityDocumentId(multisport)}`,
      label: readEntityLabel(multisport) || 'Multisport',
      mode: 'multisport',
    };
  }

  return {
    key: readEntityDocumentId(club) ? `club:${readEntityDocumentId(club)}` : 'club:missing',
    label: readEntityLabel(club) || 'Club',
    mode: 'section',
  };
};

const getProviderReadiness = (account) => {
  const source = safeObject(account);
  const health = readHelloAssoHealth(source);
  const status = readString(source.status) || 'not_configured';
  const explicit = readString(health.readiness);
  if (explicit) return explicit;
  if (status === 'disabled') return 'disabled';
  if (!health.hasClientId || !health.hasClientSecret || !readString(readHelloAssoConfig(source).organizationSlug)) {
    return 'credentials_missing';
  }
  if (status === 'error') return 'oauth_failed';
  if (status === 'pending') return 'pending';
  if (status === 'active') {
    return health.lastWebhookAt ? 'ready' : 'webhook_pending';
  }
  return status || 'not_configured';
};

const getProviderReadinessLabel = (status) => ({
  checkout_failed: 'Test checkout en erreur',
  credentials_missing: 'Configuration incomplète',
  disabled: 'Desactive',
  error: 'Erreur provider',
  not_configured: 'A configurer',
  oauth_failed: 'OAuth en erreur',
  pending: 'En attente',
  ready: 'Pret',
  webhook_pending: 'Webhook à confirmer',
  webhook_stale: 'Webhook à vérifier',
}[status] || status || 'Inconnu');

const isAttentionReadiness = (status) => !['ready'].includes(status);

const buildProviderFormDraft = (account) => {
  const config = readHelloAssoConfig(account);
  const health = readHelloAssoHealth(account);
  return {
    clientId: readString(config.clientId),
    clientSecret: '',
    environment: readString(config.environment) || 'production',
    organizationSlug: readString(config.organizationSlug),
    secretConfigured: health.hasClientSecret === true,
  };
};

const getCampaignDocumentIdFromPayment = (payment) => {
  const assignment = safeObject(safeObject(payment).assignment);
  const campaign = safeObject(assignment.campaign);
  return readEntityDocumentId(campaign);
};

const getCampaignDocumentIdFromEvent = (event) => {
  const payment = safeObject(safeObject(event).payment);
  return getCampaignDocumentIdFromPayment(payment);
};

const matchesFilter = (value, filterValue) => {
  if (!filterValue || filterValue === 'all') return true;
  return value === filterValue;
};

const includesSearch = (campaign, searchValue, seasonValue) => {
  const normalizedSearch = readString(searchValue).toLowerCase();
  const normalizedSeason = readString(seasonValue).toLowerCase();
  const scope = getCampaignScope(campaign);
  const haystack = [
    safeObject(campaign).name,
    safeObject(campaign).seasonLabel,
    scope.label,
    readEntityLabel(scope.multisport),
  ]
    .map((item) => readString(item).toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
  if (normalizedSeason && !readString(safeObject(campaign).seasonLabel).toLowerCase().includes(normalizedSeason)) return false;
  return true;
};

/**
 *
 * @param root0
 * @param root0.color
 * @param root0.label
 * @param root0.value
 */
function MetricCard({ color, label, value }) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <SuperAdminLeagueCard
      style={{
        borderColor: `${color || Colors.primary500}55`,
        flexBasis: '48%',
        flexGrow: 1,
        justifyContent: 'center',
        marginBottom: 0,
        minHeight: 92,
      }}
    >
      <Text style={[Fonts.h2Bold, { color: color || Colors.primary500 }]}>{value}</Text>
      <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[6]]}>{label}</Text>
    </SuperAdminLeagueCard>
  );
}

/**
 *
 * @param root0
 * @param root0.isActive
 * @param root0.label
 * @param root0.onPress
 */
function FilterButton({
  isActive,
  label,
  onPress,
}) {
  return (
    <Button
      onPress={onPress}
      size="sm"
      title={label}
      variant={isActive ? 'Primary' : 'Secondary'}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.value
 */
function DetailRow({
  label,
  value,
}) {
  const { Fonts, Spaces } = useTheme();

  return (
    <View style={[Spaces.gap[4]]}>
      <Text style={[Fonts.p3, Fonts.neutral300]}>{label}</Text>
      <Text style={[Fonts.p2, Fonts.neutral00]}>{value || '-'}</Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.campaign
 * @param root0.isSelected
 * @param root0.onPress
 * @param root0.providerSnapshot
 */
function CampaignListCard({
  campaign,
  isSelected,
  onPress,
  providerSnapshot,
}) {
  const {
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const scope = getCampaignScope(campaign);
  const campaignMode = getCampaignMode(campaign);
  const status = readString(campaign.status) || 'draft';
  const readiness = providerSnapshot?.readiness || 'not_configured';

  return (
    <LicenseCard
      style={[
        styles.selectableCard,
        isSelected ? { borderColor: Colors.primary500 } : null,
      ]}
      tone={isSelected ? Colors.primary500 : undefined}
      variant={isSelected ? 'default' : 'muted'}
    >
      <View style={Spaces.gap[licenseSpacing.titleGap]}>
        <View style={styles.cardHeader}>
          <View style={[Spaces.gap[6], { flex: 1 }]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{readString(campaign.name) || 'Campagne sans nom'}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {scope.label}
              {' - '}
              {readString(campaign.seasonLabel) || 'Saison non définie'}
            </Text>
          </View>
          <View style={[Spaces.gap[6], styles.cardStatusColumn]}>
            <LicenseStatusChip status={status} />
            {campaignMode === 'helloasso' ? <LicenseStatusChip status={readiness} /> : null}
          </View>
        </View>

        <Text style={[Fonts.p3, Fonts.neutral300]}>
          Owner:
          {' '}
          {scope.mode === 'multisport' ? 'multisport' : 'section'}
          {' - '}
          Paiement:
          {' '}
          {paymentModeLabels[campaignMode] || campaignMode}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Maj
            {' '}
            {formatTimestamp(campaign.updatedAt)}
          </Text>
          <Button
            onPress={onPress}
            size="sm"
            title={isSelected ? 'Ouverte' : 'Ouvrir'}
            variant={isSelected ? 'Primary' : 'Secondary'}
          />
        </View>
      </View>
    </LicenseCard>
  );
}

/**
 *
 * @param root0
 * @param root0.onRefresh
 * @param root0.payment
 * @param root0.refreshing
 */
function PaymentRow({
  onRefresh,
  payment,
  refreshing,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const status = readString(payment.status) || 'pending';

  return (
    <LicenseCard tone={getLicenseStatusTone(Colors, status)} variant="muted">
      <View style={[Spaces.gap[8]]}>
        <View style={styles.cardHeader}>
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {formatLicenseMoney(payment.amountCents, payment.currency)}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {paymentModeLabels[readString(payment.method)] || readString(payment.method) || 'Paiement'}
              {' - '}
              {readString(payment.provider) || 'manual'}
            </Text>
          </View>
          <LicenseStatusChip status={status} />
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          Payment ID:
          {' '}
          {readString(payment.documentId) || '-'}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          Externe:
          {' '}
          {firstNonEmptyString(payment.externalPaymentId, payment.providerCheckoutId, payment.providerPaymentIntentId, '-')}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{formatTimestamp(payment.updatedAt || payment.paidAt)}</Text>
          <Button
            onPress={onRefresh}
            size="sm"
            title={refreshing ? 'Verification...' : 'Reverifier'}
            variant="Secondary"
          />
        </View>
      </View>
    </LicenseCard>
  );
}

/**
 *
 * @param root0
 * @param root0.event
 */
function EventRow({ event }) {
  const { Fonts, Spaces } = useTheme();
  const failureReason = readString(event.failureReason);

  return (
    <LicenseCard variant="muted">
      <View style={[Spaces.gap[8]]}>
        <View style={styles.cardHeader}>
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {readString(event.eventType) || 'Événement provider'}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {readString(event.provider) || 'helloasso'}
              {' - '}
              {formatTimestamp(event.processedAt || event.updatedAt)}
            </Text>
          </View>
          <LicenseStatusChip status={readString(event.status) || 'pending'} />
        </View>
        {failureReason ? <Text style={[Fonts.p3, Fonts.neutral200]}>{failureReason}</Text> : null}
      </View>
    </LicenseCard>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 */
function SuperAdminLicensesDashboard({ navigation }) {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const [searchText, setSearchText] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [readinessFilter, setReadinessFilter] = useState('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [providerDraft, setProviderDraft] = useState(buildProviderFormDraft(null));

  const campaignParams = useMemo(() => ({
    fields: [
      'documentId',
      'name',
      'seasonLabel',
      'status',
      'paymentOwner',
      'paymentModes',
      'updatedAt',
    ],
    pagination: {
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    },
    populate: {
      club: {
        fields: ['documentId', 'name'],
        populate: {
          parentMultisport: {
            fields: ['documentId', 'name'],
          },
        },
      },
    },
    sort: ['updatedAt:desc'],
  }), []);

  const providerParams = useMemo(() => ({
    fields: [
      'documentId',
      'provider',
      'status',
      'publicConfig',
      'lastSyncAt',
      'updatedAt',
    ],
    filters: {
      provider: {
        $eq: 'helloasso',
      },
    },
    pagination: {
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    },
    populate: {
      club: {
        fields: ['documentId', 'name'],
      },
      multisportClub: {
        fields: ['documentId', 'name'],
      },
    },
    sort: ['updatedAt:desc'],
  }), []);

  const paymentParams = useMemo(() => ({
    fields: [
      'documentId',
      'amountCents',
      'currency',
      'method',
      'provider',
      'status',
      'paidAt',
      'updatedAt',
      'externalPaymentId',
      'providerCheckoutId',
      'providerPaymentIntentId',
    ],
    pagination: {
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    },
    populate: {
      assignment: {
        fields: ['documentId'],
        populate: {
          campaign: {
            fields: ['documentId', 'name'],
          },
        },
      },
    },
    sort: ['updatedAt:desc'],
  }), []);

  const providerEventParams = useMemo(() => ({
    fields: [
      'documentId',
      'provider',
      'eventType',
      'status',
      'processedAt',
      'failureReason',
      'updatedAt',
    ],
    pagination: {
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    },
    populate: {
      payment: {
        fields: ['documentId', 'status', 'provider'],
        populate: {
          assignment: {
            fields: ['documentId'],
            populate: {
              campaign: {
                fields: ['documentId', 'name'],
              },
            },
          },
        },
      },
    },
    sort: ['updatedAt:desc'],
  }), []);

  const campaignsQuery = useGetSuperadminEntries(CAMPAIGN_UID, campaignParams);
  const providersQuery = useGetSuperadminEntries(PROVIDER_ACCOUNT_UID, providerParams);
  const paymentsQuery = useGetSuperadminEntries(PAYMENT_UID, paymentParams);
  const providerEventsQuery = useGetSuperadminEntries(PROVIDER_EVENT_UID, providerEventParams);

  const refreshAll = async () => {
    await Promise.all([
      campaignsQuery.refetch(),
      providersQuery.refetch(),
      paymentsQuery.refetch(),
      providerEventsQuery.refetch(),
    ]);
  };

  const providerMutation = useMutation({
    mutationFn: (payload) => connectLicenseHelloAsso(payload),
    onSuccess: async () => {
      await refreshAll();
    },
  });

  const paymentRefreshMutation = useMutation({
    mutationFn: (paymentId) => getLicensePaymentStatus(paymentId, { refresh: true }),
    onSuccess: async () => {
      await Promise.all([paymentsQuery.refetch(), providerEventsQuery.refetch()]);
    },
  });

  const allCampaigns = safeArray(campaignsQuery.data?.data);
  const allProviders = safeArray(providersQuery.data?.data);
  const allPayments = safeArray(paymentsQuery.data?.data);
  const allProviderEvents = safeArray(providerEventsQuery.data?.data);

  const providersByScope = useMemo(() => {
    const map = new Map();
    allProviders.forEach((providerAccount) => {
      map.set(getProviderScope(providerAccount).key, providerAccount);
    });
    return map;
  }, [allProviders]);

  const decoratedCampaigns = useMemo(() => allCampaigns.map((campaign) => {
    const scope = getCampaignScope(campaign);
    const providerAccount = providersByScope.get(scope.key) || null;
    return {
      campaign,
      mode: getCampaignMode(campaign),
      providerAccount,
      readiness: providerAccount ? getProviderReadiness(providerAccount) : 'not_configured',
      scope,
    };
  }), [allCampaigns, providersByScope]);

  const filteredCampaigns = useMemo(() => decoratedCampaigns.filter((entry) => {
    if (!includesSearch(entry.campaign, searchText, seasonFilter)) return false;
    if (!matchesFilter(entry.scope.mode, ownerFilter)) return false;
    if (!matchesFilter(entry.mode, modeFilter)) return false;
    if (!matchesFilter(readString(entry.campaign.status) || 'draft', statusFilter)) return false;
    if (!matchesFilter(readinessFilter === 'attention' ? 'attention' : entry.readiness, readinessFilter)) {
      if (readinessFilter !== 'attention') return false;
      return isAttentionReadiness(entry.readiness);
    }
    if (readinessFilter === 'attention' && !isAttentionReadiness(entry.readiness)) return false;
    return true;
  }), [decoratedCampaigns, modeFilter, ownerFilter, readinessFilter, searchText, seasonFilter, statusFilter]);

  useEffect(() => {
    if (!filteredCampaigns.length) {
      setSelectedCampaignId('');
      return;
    }

    const stillExists = filteredCampaigns.some((entry) => readEntityDocumentId(entry.campaign) === selectedCampaignId);
    if (!stillExists) {
      setSelectedCampaignId(readEntityDocumentId(filteredCampaigns[0].campaign));
    }
  }, [filteredCampaigns, selectedCampaignId]);

  const selectedCampaignEntry = useMemo(
    () => filteredCampaigns.find((entry) => readEntityDocumentId(entry.campaign) === selectedCampaignId) || null,
    [filteredCampaigns, selectedCampaignId],
  );

  const selectedCampaign = selectedCampaignEntry?.campaign || null;
  const selectedProviderAccount = selectedCampaignEntry?.providerAccount || null;
  const selectedScope = selectedCampaignEntry?.scope || null;
  const selectedReadiness = selectedCampaignEntry?.readiness || 'not_configured';

  useEffect(() => {
    setProviderDraft(buildProviderFormDraft(selectedProviderAccount));
  }, [selectedProviderAccount, selectedCampaignId]);

  const selectedCampaignPayments = useMemo(() => {
    const campaignId = readEntityDocumentId(selectedCampaign);
    if (!campaignId) return [];
    return allPayments.filter((payment) => getCampaignDocumentIdFromPayment(payment) === campaignId);
  }, [allPayments, selectedCampaign]);

  const selectedCampaignProviderEvents = useMemo(() => {
    const campaignId = readEntityDocumentId(selectedCampaign);
    if (!campaignId) return [];
    return allProviderEvents.filter((event) => getCampaignDocumentIdFromEvent(event) === campaignId);
  }, [allProviderEvents, selectedCampaign]);

  const selectedPaymentStats = useMemo(() => selectedCampaignPayments.reduce((accumulator, payment) => {
    const status = readString(payment.status) || 'pending';
    accumulator.total += 1;
    if (status === 'confirmed') accumulator.confirmed += 1;
    if (status === 'pending' || status === 'manual_review') accumulator.pending += 1;
    if (['cancelled', 'disputed', 'failed', 'rejected'].includes(status)) accumulator.failed += 1;
    return accumulator;
  }, {
    confirmed: 0,
    failed: 0,
    pending: 0,
    total: 0,
  }), [selectedCampaignPayments]);

  const globalMetrics = useMemo(() => {
    const helloassoCampaigns = decoratedCampaigns.filter((entry) => entry.mode === 'helloasso').length;
    const providerErrors = allProviders.filter((providerAccount) => isAttentionReadiness(getProviderReadiness(providerAccount))).length;
    const pendingPayments = allPayments.filter((payment) => ['manual_review', 'pending'].includes(readString(payment.status))).length;
    const confirmedPayments = allPayments.filter((payment) => readString(payment.status) === 'confirmed').length;
    const ignoredEvents = allProviderEvents.filter((event) => readString(event.status) === 'ignored').length;

    return {
      campaigns: decoratedCampaigns.length,
      confirmedPayments,
      helloassoCampaigns,
      ignoredEvents,
      pendingPayments,
      providerErrors,
    };
  }, [allPayments, allProviderEvents, allProviders, decoratedCampaigns]);

  const partialDataWarnings = [
    campaignsQuery.data?.meta?.pagination,
    providersQuery.data?.meta?.pagination,
    paymentsQuery.data?.meta?.pagination,
    providerEventsQuery.data?.meta?.pagination,
  ]
    .filter(Boolean)
    .filter((pagination) => Number(pagination.total || 0) > Number(pagination.pageSize || 0));

  const canManageSelectedProvider = selectedCampaignEntry?.mode === 'helloasso' && selectedScope;

  const selectedScopePayload = selectedScope?.mode === 'multisport'
    ? { multisportClubId: readEntityDocumentId(selectedScope.multisport) }
    : { clubId: readEntityDocumentId(selectedScope?.club) };

  const handleVerifyProvider = async (status = undefined) => {
    if (!canManageSelectedProvider) return;
    if (!providerDraft.organizationSlug) {
      Alert.alert('HelloAsso', 'Le slug organisation est obligatoire.');
      return;
    }

    try {
      await providerMutation.mutateAsync({
        ...selectedScopePayload,
        clientId: providerDraft.clientId || undefined,
        clientSecret: providerDraft.clientSecret || undefined,
        environment: providerDraft.environment || 'production',
        organizationSlug: providerDraft.organizationSlug,
        status,
      });
      Alert.alert(
        'HelloAsso',
        status === 'disabled'
          ? 'Le mode HelloAsso a été désactivé pour ce scope.'
          : 'La configuration HelloAsso a été vérifiée avec succès.',
      );
      setProviderDraft((currentDraft) => ({
        ...currentDraft,
        clientSecret: '',
        secretConfigured: currentDraft.secretConfigured || Boolean(providerDraft.clientSecret),
      }));
    } catch (error) {
      Alert.alert('HelloAsso', getErrorMessage(error, 'generic') || 'Impossible de vérifier cette configuration HelloAsso.');
    }
  };

  const handleReverifyPayment = async (paymentId) => {
    try {
      await paymentRefreshMutation.mutateAsync(paymentId);
      Alert.alert('Paiement', 'La reverification du paiement est terminée.');
    } catch (error) {
      Alert.alert('Paiement', getErrorMessage(error, 'generic') || 'Impossible de reverifier ce paiement.');
    }
  };

  if (campaignsQuery.isLoading && !campaignsQuery.data) {
    return (
      <AdminStateView
        description="Nous consolidons les campagnes, providers et paiements cotisations."
        isLoading
        title="Chargement du cockpit cotisations"
      />
    );
  }

  if (campaignsQuery.error && !campaignsQuery.data) {
    return (
      <AdminStateView
        actionLabel="Reessayer"
        description={getErrorMessage(campaignsQuery.error, 'generic') || 'Impossible de charger les campagnes cotisations.'}
        onAction={campaignsQuery.refetch}
        title="Chargement impossible"
      />
    );
  }

  return (
    <SuperAdminLeagueLayout
      activeRouteNames={[RouteNames.SuperAdminLicenses]}
      description="Supervise les campagnes, les connexions HelloAsso, les paiements et les anomalies de cotisation depuis un cockpit support unique."
      rightAction={{
        label: 'Explorer brut',
        onPress: () => navigation.navigate(RouteNames.SuperAdminContentExplorer),
        variant: 'Secondary',
      }}
      title="Cockpit cotisations"
    >
      <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
        <MetricCard color={Colors.primary500} label="Campagnes" value={globalMetrics.campaigns} />
        <MetricCard color={Colors.success500} label="Campagnes HelloAsso" value={globalMetrics.helloassoCampaigns} />
        <MetricCard color={Colors.warning500} label="Connexions à surveiller" value={globalMetrics.providerErrors} />
        <MetricCard color={Colors.primary300} label="Paiements en attente" value={globalMetrics.pendingPayments} />
        <MetricCard color={Colors.success500} label="Paiements confirmes" value={globalMetrics.confirmedPayments} />
        <MetricCard color={Colors.error500} label="Webhooks ignores" value={globalMetrics.ignoredEvents} />
      </View>

      {partialDataWarnings.length ? (
        <LicenseCard tone={Colors.warning500}>
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            Certaines listes dépassent 100 éléments. Le cockpit montre pour l instant les 100 plus recentes données par famille.
          </Text>
        </LicenseCard>
      ) : null}

      <SuperAdminLeagueCard style={{ marginBottom: 0 }}>
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>Filtres</Text>
          <View style={[Spaces.gap[10]]}>
            <TextInput
              onChangeText={setSearchText}
              placeholder="Club, multisport ou campagne"
              placeholderTextColor={Colors.neutral400}
              style={[styles.input, Fonts.p2, { color: Colors.neutral00 }]}
              value={searchText}
            />
            <TextInput
              onChangeText={setSeasonFilter}
              placeholder="Filtrer par saison"
              placeholderTextColor={Colors.neutral400}
              style={[styles.input, Fonts.p2, { color: Colors.neutral00 }]}
              value={seasonFilter}
            />
          </View>

          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>Owner</Text>
            <View style={styles.filterGroup}>
              {[
                ['all', 'Tous'],
                ['section', 'Section'],
                ['multisport', 'Multisport'],
              ].map(([value, label]) => (
                <FilterButton
                  isActive={ownerFilter === value}
                  key={value}
                  label={label}
                  onPress={() => setOwnerFilter(value)}
                />
              ))}
            </View>
          </View>

          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>Mode de paiement</Text>
            <View style={styles.filterGroup}>
              {[
                ['all', 'Tous'],
                ['helloasso', 'HelloAsso'],
                ['external_link', 'Lien externe'],
                ['offline', 'Hors ligne'],
              ].map(([value, label]) => (
                <FilterButton
                  isActive={modeFilter === value}
                  key={value}
                  label={label}
                  onPress={() => setModeFilter(value)}
                />
              ))}
            </View>
          </View>

          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>Statut campagne</Text>
            <View style={styles.filterGroup}>
              {[
                ['all', 'Tous'],
                ['draft', 'Brouillon'],
                ['active', 'Active'],
                ['paused', 'Pause'],
                ['closed', 'Cloturee'],
              ].map(([value, label]) => (
                <FilterButton
                  isActive={statusFilter === value}
                  key={value}
                  label={label}
                  onPress={() => setStatusFilter(value)}
                />
              ))}
            </View>
          </View>

          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>Readiness HelloAsso</Text>
            <View style={styles.filterGroup}>
              {[
                ['all', 'Tous'],
                ['ready', 'Pret'],
                ['attention', 'Attention'],
                ['webhook_pending', 'Webhook'],
              ].map(([value, label]) => (
                <FilterButton
                  isActive={readinessFilter === value}
                  key={value}
                  label={label}
                  onPress={() => setReadinessFilter(value)}
                />
              ))}
            </View>
          </View>
        </View>
      </SuperAdminLeagueCard>

      <View style={[Spaces.gap[12]]}>
        <Text style={[Fonts.h4, Fonts.neutral00]}>
          Campagnes visibles (
          {filteredCampaigns.length}
          )
        </Text>
        {filteredCampaigns.length === 0 ? (
          <LicenseCard variant="muted">
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Aucun résultat avec les filtres actuels.
            </Text>
          </LicenseCard>
        ) : (
          filteredCampaigns.map((entry) => (
            <CampaignListCard
              campaign={entry.campaign}
              isSelected={readEntityDocumentId(entry.campaign) === selectedCampaignId}
              key={readEntityDocumentId(entry.campaign)}
              onPress={() => setSelectedCampaignId(readEntityDocumentId(entry.campaign))}
              providerSnapshot={{ readiness: entry.readiness }}
            />
          ))
        )}
      </View>

      {selectedCampaign ? (
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>Detail campagne</Text>
          <SuperAdminLeagueCard style={{ marginBottom: 0 }}>
            <View style={[Spaces.gap[12]]}>
              <View style={styles.cardHeader}>
                <View style={[Spaces.gap[6], { flex: 1 }]}>
                  <Text style={[Fonts.h3, Fonts.neutral00]}>{readString(selectedCampaign.name) || 'Campagne sans nom'}</Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {selectedScope?.label || 'Scope manquant'}
                    {' - '}
                    {readString(selectedCampaign.seasonLabel) || 'Saison non définie'}
                  </Text>
                </View>
                <View style={[Spaces.gap[6], styles.cardStatusColumn]}>
                  <LicenseStatusChip status={readString(selectedCampaign.status) || 'draft'} />
                  {selectedCampaignEntry?.mode === 'helloasso' ? <LicenseStatusChip status={selectedReadiness} /> : null}
                </View>
              </View>

              <View style={[styles.detailGrid, Spaces.gap[12]]}>
                <DetailRow label="Owner" value={selectedScope?.mode || '-'} />
                <DetailRow label="Paiement" value={paymentModeLabels[selectedCampaignEntry?.mode] || selectedCampaignEntry?.mode || '-'} />
                <DetailRow label="Dernière mise à jour campagne" value={formatTimestamp(selectedCampaign.updatedAt)} />
                <DetailRow label="Readiness HelloAsso" value={getProviderReadinessLabel(selectedReadiness)} />
              </View>
            </View>
          </SuperAdminLeagueCard>

          <SuperAdminLeagueCard style={{ marginBottom: 0 }}>
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>Cockpit paiements</Text>
              <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
                <MetricCard color={Colors.success500} label="Confirmes" value={selectedPaymentStats.confirmed} />
                <MetricCard color={Colors.warning500} label="En attente" value={selectedPaymentStats.pending} />
                <MetricCard color={Colors.error500} label="En anomalie" value={selectedPaymentStats.failed} />
              </View>
            </View>
          </SuperAdminLeagueCard>

          {selectedCampaignEntry?.mode === 'helloasso' ? (
            <SuperAdminLeagueCard style={{ marginBottom: 0 }}>
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>Configuration HelloAsso</Text>
                <View style={[styles.detailGrid, Spaces.gap[12]]}>
                  <DetailRow label="Scope" value={selectedScope?.label || '-'} />
                  <DetailRow label="Slug actuel" value={providerDraft.organizationSlug || '-'} />
                  <DetailRow label="Environnement" value={providerDraft.environment || '-'} />
                  <DetailRow
                    label="Secret"
                    value={providerDraft.secretConfigured ? 'Configure (masque)' : 'Non configure'}
                  />
                  <DetailRow
                    label="Dernier webhook"
                    value={formatTimestamp(readHelloAssoHealth(selectedProviderAccount).lastWebhookAt)}
                  />
                  <DetailRow
                    label="Dernière erreur"
                    value={readString(readHelloAssoHealth(selectedProviderAccount).lastError) || '-'}
                  />
                </View>

                <TextInput
                  onChangeText={(value) => setProviderDraft((currentDraft) => ({ ...currentDraft, organizationSlug: value }))}
                  placeholder="Slug organisation HelloAsso"
                  placeholderTextColor={Colors.neutral400}
                  style={[styles.input, Fonts.p2, { color: Colors.neutral00 }]}
                  value={providerDraft.organizationSlug}
                />
                <TextInput
                  autoCapitalize="none"
                  onChangeText={(value) => setProviderDraft((currentDraft) => ({ ...currentDraft, clientId: value }))}
                  placeholder="Client ID HelloAsso"
                  placeholderTextColor={Colors.neutral400}
                  style={[styles.input, Fonts.p2, { color: Colors.neutral00 }]}
                  value={providerDraft.clientId}
                />
                <TextInput
                  autoCapitalize="none"
                  onChangeText={(value) => setProviderDraft((currentDraft) => ({ ...currentDraft, clientSecret: value }))}
                  placeholder={providerDraft.secretConfigured ? 'Client secret (laisser vide pour conserver)' : 'Client secret HelloAsso'}
                  placeholderTextColor={Colors.neutral400}
                  secureTextEntry
                  style={[styles.input, Fonts.p2, { color: Colors.neutral00 }]}
                  value={providerDraft.clientSecret}
                />
                <View style={styles.filterGroup}>
                  {[
                    ['production', 'Production'],
                    ['sandbox', 'Sandbox'],
                  ].map(([value, label]) => (
                    <FilterButton
                      isActive={providerDraft.environment === value}
                      key={value}
                      label={label}
                      onPress={() => setProviderDraft((currentDraft) => ({ ...currentDraft, environment: value }))}
                    />
                  ))}
                </View>
                <View style={styles.filterGroup}>
                  <Button
                    onPress={() => handleVerifyProvider()}
                    title={providerMutation.isPending ? 'Verification...' : 'Retester la connexion'}
                    variant="Primary"
                  />
                  <Button
                    onPress={() => handleVerifyProvider('disabled')}
                    title="Désactiver HelloAsso"
                    variant="Secondary"
                  />
                </View>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  Le secret n est jamais affiche. Si tu laisses le champ vide, on conserve le secret existant.
                </Text>
              </View>
            </SuperAdminLeagueCard>
          ) : null}

          <SuperAdminLeagueCard style={{ marginBottom: 0 }}>
            <View style={[Spaces.gap[12]]}>
              <View style={styles.cardHeader}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>Paiements récents</Text>
                <Button
                  onPress={() => navigation.navigate(RouteNames.SuperAdminEntryList, {
                    uid: PAYMENT_UID,
                    uidDisplayName: 'Paiements cotisations',
                  })}
                  size="sm"
                  title="Ouvrir la liste brute"
                  variant="Secondary"
                />
              </View>

              {selectedCampaignPayments.length === 0 ? (
                <LicenseCard variant="muted">
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    Aucun paiement rattache à cette campagne dans les 100 derniers paiements charges.
                  </Text>
                </LicenseCard>
              ) : (
                selectedCampaignPayments.slice(0, 6).map((payment) => (
                  <PaymentRow
                    key={readEntityDocumentId(payment)}
                    onRefresh={() => handleReverifyPayment(readEntityDocumentId(payment))}
                    payment={payment}
                    refreshing={paymentRefreshMutation.isPending && paymentRefreshMutation.variables === readEntityDocumentId(payment)}
                  />
                ))
              )}
            </View>
          </SuperAdminLeagueCard>

          <SuperAdminLeagueCard style={{ marginBottom: 0 }}>
            <View style={[Spaces.gap[12]]}>
              <View style={styles.cardHeader}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>Événements provider</Text>
                <Button
                  onPress={() => navigation.navigate(RouteNames.SuperAdminEntryList, {
                    uid: PROVIDER_EVENT_UID,
                    uidDisplayName: 'Événements provider cotisations',
                  })}
                  size="sm"
                  title="Ouvrir les événements"
                  variant="Secondary"
                />
              </View>

              {selectedCampaignProviderEvents.length === 0 ? (
                <LicenseCard variant="muted">
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    Aucun événement provider rattache à cette campagne dans les 100 derniers événements charges.
                  </Text>
                </LicenseCard>
              ) : (
                selectedCampaignProviderEvents.slice(0, 6).map((event) => (
                  <EventRow event={event} key={readEntityDocumentId(event)} />
                ))
              )}
            </View>
          </SuperAdminLeagueCard>
        </View>
      ) : null}
    </SuperAdminLeagueLayout>
  );
}

const styles = StyleSheet.create({
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardStatusColumn: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectableCard: {
    marginBottom: 0,
  },
});

export default SuperAdminLicensesDashboard;
