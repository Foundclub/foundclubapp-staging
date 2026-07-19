import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { useGetSubscriptionOps } from '@/services/admin/adminQueries';
import {
  getSubscriptionOpsBillingEvents,
  getSubscriptionOpsSubscriptions,
  retrySubscriptionOpsBillingEvent,
  runSubscriptionOpsReconcile,
  updateSubscriptionOpsStatus,
} from '@/services/admin/adminService';

import { getErrorMessage } from '@/utils/errors/displayError';
import { buildNormalizedQueryKey } from '@/utils/queryKey';

const LIST_PAGE_SIZE = 10;

const SUBSCRIPTION_STATUS_FILTERS = ['active', 'grace_period', 'cancelled', 'expired', 'revoked'];
const SUBSCRIPTION_PROVIDER_FILTERS = ['manual', 'apple', 'google', 'web', 'legacy'];
const SUBSCRIPTION_STATUS_TARGETS = ['active', 'cancelled', 'revoked', 'expired'];
const BILLING_PROCESSING_STATUS_FILTERS = ['pending', 'processed', 'failed', 'skipped'];
const RETRYABLE_BILLING_STATUSES = ['failed', 'skipped'];

/**
 * @param {any} value
 * @returns {string}
 */
const formatDateTime = (value) => {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

/**
 * @param {any} [person]
 * @returns {string}
 */
const formatPerson = (person = {}) => (
  [person?.firstname, person?.lastname].filter(Boolean).join(' ')
  || person?.documentId
  || 'Utilisateur inconnu'
);

/**
 * @param {any} cents
 * @returns {string}
 */
const formatEurosFromCents = (cents) => `${(Number(cents || 0) / 100).toFixed(2).replace('.', ',')} €`;

/**
 * Admin Revenue screen component
 * @returns {import('react').ReactElement} Admin Revenue screen component
 */
function AdminRevenue() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const {
    data: subscriptionOpsData,
    error,
    isLoading,
    refetch,
  } = useGetSubscriptionOps();

  const [subscriptionSearchInput, setSubscriptionSearchInput] = useState('');
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('');
  const [subscriptionProviderFilter, setSubscriptionProviderFilter] = useState('');
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [billingStatusFilter, setBillingStatusFilter] = useState('');
  const [billingPage, setBillingPage] = useState(1);
  const [statusModalItem, setStatusModalItem] = useState(/** @type {any|null} */ (null));
  const [statusModalValue, setStatusModalValue] = useState('active');
  const [statusModalReason, setStatusModalReason] = useState('');
  const [retryModalItem, setRetryModalItem] = useState(/** @type {any|null} */ (null));
  const [retryModalReason, setRetryModalReason] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSubscriptionSearch(subscriptionSearchInput.trim());
      setSubscriptionPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [subscriptionSearchInput]);

  const subscriptionsParams = useMemo(() => ({
    page: subscriptionPage,
    pageSize: LIST_PAGE_SIZE,
    ...(subscriptionSearch ? { q: subscriptionSearch } : {}),
    ...(subscriptionStatusFilter ? { status: subscriptionStatusFilter } : {}),
    ...(subscriptionProviderFilter ? { provider: subscriptionProviderFilter } : {}),
  }), [subscriptionPage, subscriptionProviderFilter, subscriptionSearch, subscriptionStatusFilter]);

  const billingEventsParams = useMemo(() => ({
    page: billingPage,
    pageSize: LIST_PAGE_SIZE,
    ...(billingStatusFilter ? { processingStatus: billingStatusFilter } : {}),
  }), [billingPage, billingStatusFilter]);

  const {
    data: subscriptionsListData,
    error: subscriptionsListError,
    isFetching: isSubscriptionsListFetching,
    refetch: refetchSubscriptionsList,
  } = useQuery({
    queryFn: () => getSubscriptionOpsSubscriptions(subscriptionsParams),
    queryKey: buildNormalizedQueryKey(['admin', 'subscription-ops', 'subscriptions'], subscriptionsParams),
  });

  const {
    data: billingEventsListData,
    error: billingEventsListError,
    isFetching: isBillingEventsListFetching,
    refetch: refetchBillingEventsList,
  } = useQuery({
    queryFn: () => getSubscriptionOpsBillingEvents(billingEventsParams),
    queryKey: buildNormalizedQueryKey(['admin', 'subscription-ops', 'billing-events'], billingEventsParams),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (
      /** @type {{ documentId: string; reason: string; status: string }} */ payload,
    ) => updateSubscriptionOpsStatus(payload.documentId, {
      reason: payload.reason,
      status: payload.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-ops'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });

  const retryBillingEventMutation = useMutation({
    mutationFn: (
      /** @type {{ documentId: string; reason: string }} */ payload,
    ) => retrySubscriptionOpsBillingEvent(payload.documentId, {
      reason: payload.reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-ops'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: runSubscriptionOpsReconcile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-ops'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });

  const counts = subscriptionOpsData?.counts || {};
  const monetization = subscriptionOpsData?.monetization || {};
  const previews = subscriptionOpsData?.previews || {};
  const claims = Array.isArray(previews?.claimRequests) ? previews.claimRequests : [];
  const legacyCandidates = Array.isArray(previews?.legacyCandidates) ? previews.legacyCandidates : [];

  const statCards = [
    { accent: Colors.primary500, label: 'Subscriptions', value: Number(counts?.subscriptions || 0) },
    { accent: Colors.success500, label: 'Entitlements', value: Number(counts?.entitlements || 0) },
    { accent: Colors.warning500, label: 'Claims à revoir', value: Number(counts?.pendingClaimReviews || 0) },
    { accent: Colors.error500, label: 'Billing KO', value: Number(counts?.failedBillingEvents || 0) },
    { accent: Colors.primary200, label: 'Quotas', value: Number(counts?.quotas || 0) },
    { accent: Colors.neutral100, label: 'Legacy à migrer', value: Number(counts?.legacyCandidateClubs || 0) },
  ];

  const subscriptionRows = Array.isArray(subscriptionsListData?.data) ? subscriptionsListData.data : [];
  const subscriptionsPagination = subscriptionsListData?.meta?.pagination || {};
  const billingEventRows = Array.isArray(billingEventsListData?.data) ? billingEventsListData.data : [];
  const billingEventsPagination = billingEventsListData?.meta?.pagination || {};

  /**
   * @param {any} status
   * @returns {string}
   */
  const getSubscriptionStatusColor = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'active') return Colors.success500;
    if (normalized === 'grace_period') return Colors.warning500;
    if (normalized === 'revoked') return Colors.error500;
    return Colors.neutral300;
  };

  /**
   * @param {any} status
   * @returns {string}
   */
  const getBillingStatusColor = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'processed') return Colors.success500;
    if (normalized === 'pending') return Colors.warning500;
    if (normalized === 'failed') return Colors.error500;
    return Colors.neutral300;
  };

  /** @param {any} item */
  const openStatusModal = (item) => {
    const currentStatus = String(item?.status || '').trim().toLowerCase();
    setStatusModalItem(item);
    setStatusModalValue(SUBSCRIPTION_STATUS_TARGETS.includes(currentStatus) ? currentStatus : 'active');
    setStatusModalReason('');
  };

  const closeStatusModal = () => {
    setStatusModalItem(null);
    setStatusModalValue('active');
    setStatusModalReason('');
  };

  /** @param {any} item */
  const openRetryModal = (item) => {
    setRetryModalItem(item);
    setRetryModalReason('');
  };

  const closeRetryModal = () => {
    setRetryModalItem(null);
    setRetryModalReason('');
  };

  const handleSubmitStatusChange = () => {
    const documentId = String(statusModalItem?.documentId || '').trim();
    const reason = String(statusModalReason || '').trim();
    if (!documentId || !reason || updateStatusMutation.isPending) return;

    updateStatusMutation.mutate(
      {
        documentId,
        reason,
        status: statusModalValue,
      },
      {
        onError: (mutationError) => {
          Alert.alert(
            'Changement impossible',
            getErrorMessage(mutationError, 'generic') || 'Impossible de changer le statut de cet abonnement.',
          );
        },
        onSuccess: () => {
          Alert.alert('Statut mis à jour', 'Le statut et les droits associes ont été recalculés.');
          closeStatusModal();
        },
      },
    );
  };

  const handleSubmitRetry = () => {
    const documentId = String(retryModalItem?.documentId || '').trim();
    const reason = String(retryModalReason || '').trim();
    if (!documentId || !reason || retryBillingEventMutation.isPending) return;

    retryBillingEventMutation.mutate(
      {
        documentId,
        reason,
      },
      {
        onError: (mutationError) => {
          Alert.alert(
            'Rejeu impossible',
            getErrorMessage(mutationError, 'generic') || 'Impossible de rejouer ce billing event.',
          );
        },
        onSuccess: () => {
          Alert.alert('Billing event rejoue', 'L événement a été rejoue depuis son payload.');
          closeRetryModal();
        },
      },
    );
  };

  const handleReconcile = () => {
    if (reconcileMutation.isPending) return;

    Alert.alert(
      'Réconcilier maintenant ?',
      'Cela relance immédiatement la réconciliation des abonnements (expirations, grace periods, droits).',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => {
            reconcileMutation.mutate(
              {},
              {
                onError: (mutationError) => {
                  Alert.alert(
                    'Réconciliation impossible',
                    getErrorMessage(mutationError, 'generic') || 'Impossible de lancer la réconciliation.',
                  );
                },
                onSuccess: () => {
                  Alert.alert('Réconciliation terminée', 'Les abonnements et les droits ont été recalculés.');
                },
              },
            );
          },
          text: 'Reconcilier',
        },
      ],
    );
  };

  /** @param {string} value */
  const handleSelectSubscriptionStatusFilter = (value) => {
    setSubscriptionStatusFilter(value);
    setSubscriptionPage(1);
  };

  /** @param {string} value */
  const handleSelectSubscriptionProviderFilter = (value) => {
    setSubscriptionProviderFilter(value);
    setSubscriptionPage(1);
  };

  /** @param {string} value */
  const handleSelectBillingStatusFilter = (value) => {
    setBillingStatusFilter(value);
    setBillingPage(1);
  };

  if (isLoading && !subscriptionOpsData) {
    return (
      <AdminStateView
        description="Nous chargeons le pilotage abonnements depuis le backend."
        isLoading
        title="Chargement des abonnements"
      />
    );
  }

  if (error && !subscriptionOpsData) {
    return (
      <AdminStateView
        actionLabel="Rafraichir"
        description="Impossible de charger les opérations abonnements."
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  /**
   * @param {string} label
   * @param {string} color
   */
  const renderStatusPill = (label, color) => (
    <View style={[styles.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}44` }]}>
      <Text style={[Fonts.p4Bold, { color }]}>{label}</Text>
    </View>
  );

  /**
   * @param {string[]} options
   * @param {string} selectedValue
   * @param {(value: string) => void} onSelect
   * @param {string} accentColor
   */
  const renderFilterChips = (options, selectedValue, onSelect, accentColor) => (
    <View style={styles.filterRow}>
      {[{ label: 'Tous', value: '' }, ...options.map((option) => ({ label: option, value: option }))].map((option) => {
        const isActive = selectedValue === option.value;
        return (
          <TouchableOpacity
            activeOpacity={0.86}
            key={option.value || 'all'}
            onPress={() => onSelect(option.value)}
            style={[
              styles.filterChip,
              {
                backgroundColor: isActive ? `${accentColor}20` : `${Colors.neutral00}06`,
                borderColor: isActive ? `${accentColor}66` : `${Colors.neutral00}16`,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: isActive ? accentColor : Colors.neutral00 }]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /**
   * @param {any} pagination
   * @param {number} currentPage
   * @param {(page: number) => void} onChangePage
   */
  const renderPagination = (pagination, currentPage, onChangePage) => {
    const pageCount = Math.max(Number(pagination?.pageCount || 0), 1);
    const total = Number(pagination?.total || 0);
    const canGoPrevious = currentPage > 1;
    const canGoNext = currentPage < pageCount;

    return (
      <View style={styles.paginationRow}>
        <TouchableOpacity
          activeOpacity={0.86}
          disabled={!canGoPrevious}
          onPress={() => onChangePage(currentPage - 1)}
          style={[styles.paginationButton, { borderColor: `${Colors.primary500}44`, opacity: canGoPrevious ? 1 : 0.4 }]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Précédent</Text>
        </TouchableOpacity>
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {`Page ${currentPage} / ${pageCount} • ${total} au total`}
        </Text>
        <TouchableOpacity
          activeOpacity={0.86}
          disabled={!canGoNext}
          onPress={() => onChangePage(currentPage + 1)}
          style={[styles.paginationButton, { borderColor: `${Colors.primary500}44`, opacity: canGoNext ? 1 : 0.4 }]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Suivant</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /** @param {any} item */
  const renderSubscriptionRow = (item) => {
    const status = String(item?.status || 'pending').trim().toLowerCase();
    const statusColor = getSubscriptionStatusColor(status);

    return (
      <View key={`subscription-${item?.documentId || item?.planCode || 'row'}`} style={[styles.rowCard, { borderBottomColor: `${Colors.primary500}22` }]}>
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={styles.rowMain}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {item?.planCode || 'Plan inconnu'}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {formatPerson(item?.payerUser)}
            </Text>
            <Text style={[Fonts.p4, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {formatDateTime(item?.currentPeriodStart)}
              {' -> '}
              {formatDateTime(item?.currentPeriodEnd)}
            </Text>
            <Text style={[Fonts.p4, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {item?.billingPeriod || 'période inconnue'}
              {item?.provider ? ` • ${item.provider}` : ''}
            </Text>
          </View>
          {renderStatusPill(status, statusColor)}
        </View>
        <View style={styles.inlineActionsRow}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openStatusModal(item)}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}44` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Statut...</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /** @param {any} item */
  const renderBillingEventRow = (item) => {
    const status = String(item?.processingStatus || 'pending').trim().toLowerCase();
    const statusColor = getBillingStatusColor(status);
    const canRetry = RETRYABLE_BILLING_STATUSES.includes(status);

    return (
      <View key={`billing-event-${item?.documentId || item?.providerEventId || 'row'}`} style={[styles.rowCard, { borderBottomColor: `${Colors.error500}22` }]}>
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={styles.rowMain}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {item?.eventType || 'Event inconnu'}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {item?.provider || 'provider inconnu'}
              {item?.providerEventId ? ` • ${item.providerEventId}` : ''}
            </Text>
            <Text style={[Fonts.p4, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {`Reçu le ${formatDateTime(item?.receivedAt || item?.createdAt)}`}
            </Text>
          </View>
          {renderStatusPill(status, statusColor)}
        </View>
        {canRetry ? (
          <View style={styles.inlineActionsRow}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => openRetryModal(item)}
              style={[styles.inlineActionButton, { backgroundColor: `${Colors.warning500}16`, borderColor: `${Colors.warning500}44` }]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>Rejouer</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  /**
   * @param {object} params
   * @param {string} params.emptyLabel
   * @param {string} params.errorLabel
   * @param {boolean} params.isFetching
   * @param {any} params.listError
   * @param {string} params.loadingLabel
   * @param {() => void} params.onRetry
   * @param {(item: any) => any} params.renderRow
   * @param {any[]} params.rows
   */
  const renderListContent = ({
    emptyLabel,
    errorLabel,
    isFetching,
    listError,
    loadingLabel,
    onRetry,
    renderRow,
    rows,
  }) => {
    if (listError) {
      return (
        <View>
          <Text style={[Fonts.p2, { color: Colors.error500 }]}>{errorLabel}</Text>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={onRetry}
            style={[styles.inlineActionButton, Spaces.marginTop[8], { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}44` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (rows.length) {
      return rows.map(renderRow);
    }

    return (
      <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
        {isFetching ? loadingLabel : emptyLabel}
      </Text>
    );
  };

  /**
   * @param {string} title
   * @param {any[]} items
   * @param {(item: any) => any} renderItem
   * @param {string} emptyLabel
   */
  const renderSection = (title, items, renderItem, emptyLabel) => (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        Spaces.padding[16],
        styles.sectionCard,
        { borderColor: `${Colors.primary500}22` },
      ]}
    >
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{title}</Text>
      <View style={[Spaces.gap[12], Spaces.marginTop[12]]}>
        {items.length ? items.map(renderItem) : (
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{emptyLabel}</Text>
        )}
      </View>
    </View>
  );

  const canSubmitStatusChange = Boolean(String(statusModalReason || '').trim()) && !updateStatusMutation.isPending;
  const canSubmitRetry = Boolean(String(retryModalReason || '').trim()) && !retryBillingEventMutation.isPending;

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[
          Spaces.padding[24],
          Spaces.paddingBottom[40],
          Spaces.gap[16],
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={[Fonts.h1, Fonts.neutral00]}>Pilotage abonnements</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
            Cette vue suit maintenant les subscriptions, entitlements, claims et incidents billing cote serveur. Les anciens champs club ne servent plus de référence métier ici.
          </Text>
        </View>

        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius16,
            Spaces.padding[16],
            styles.sectionCard,
            { borderColor: `${Colors.success500}44` },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>Monetisation</Text>
          <Text style={[Fonts.h2Bold, Fonts.neutral00, Spaces.marginTop[8]]}>
            {`${formatEurosFromCents(monetization?.mrrEurCents)} MRR`}
          </Text>
          <View style={styles.filterRow}>
            {renderStatusPill(`${Number(monetization?.payingSubscriptionCount || 0)} payants`, Colors.success500)}
            {renderStatusPill(`${Number(monetization?.trialSubscriptionCount || 0)} essais`, Colors.warning500)}
            {renderStatusPill(`${Number(monetization?.activeSubscriptionCount || 0)} actifs`, Colors.primary500)}
          </View>
        </View>

        <View style={[Alignments.row, styles.statsGrid]}>
          {statCards.map((card) => (
            <View
              key={card.label}
              style={[
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius16,
                Spaces.padding[16],
                styles.statCard,
                { borderColor: `${card.accent}44`, borderWidth: 1 },
              ]}
            >
              <Text style={[Fonts.h2Bold, { color: card.accent }]}>{card.value}</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[8]]}>{card.label}</Text>
            </View>
          ))}
        </View>

        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius16,
            Spaces.padding[16],
            styles.sectionCard,
            { borderColor: `${Colors.primary500}22` },
          ]}
        >
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Abonnés</Text>
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={reconcileMutation.isPending}
              onPress={handleReconcile}
              style={[
                styles.headerActionButton,
                {
                  backgroundColor: `${Colors.warning500}16`,
                  borderColor: `${Colors.warning500}44`,
                  opacity: reconcileMutation.isPending ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>
                {reconcileMutation.isPending ? 'Reconciliation...' : 'Réconcilier maintenant'}
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            autoCapitalize="none"
            onChangeText={setSubscriptionSearchInput}
            placeholder="Rechercher un payeur, un plan..."
            placeholderTextColor={Colors.neutral400}
            style={[
              styles.searchInput,
              Spaces.marginTop[12],
              { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 },
            ]}
            value={subscriptionSearchInput}
          />

          {renderFilterChips(SUBSCRIPTION_STATUS_FILTERS, subscriptionStatusFilter, handleSelectSubscriptionStatusFilter, Colors.primary500)}
          {renderFilterChips(SUBSCRIPTION_PROVIDER_FILTERS, subscriptionProviderFilter, handleSelectSubscriptionProviderFilter, Colors.primary200)}

          <View style={[Spaces.gap[12], Spaces.marginTop[12]]}>
            {renderListContent({
              emptyLabel: 'Aucun abonne trouve.',
              errorLabel: 'Impossible de charger les abonnés.',
              isFetching: isSubscriptionsListFetching,
              listError: subscriptionsListError,
              loadingLabel: 'Chargement des abonnés...',
              onRetry: refetchSubscriptionsList,
              renderRow: renderSubscriptionRow,
              rows: subscriptionRows,
            })}
          </View>

          {renderPagination(subscriptionsPagination, subscriptionPage, setSubscriptionPage)}
        </View>

        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius16,
            Spaces.padding[16],
            styles.sectionCard,
            { borderColor: `${Colors.error500}22` },
          ]}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Billing events</Text>

          {renderFilterChips(BILLING_PROCESSING_STATUS_FILTERS, billingStatusFilter, handleSelectBillingStatusFilter, Colors.warning500)}

          <View style={[Spaces.gap[12], Spaces.marginTop[12]]}>
            {renderListContent({
              emptyLabel: 'Aucun billing event trouve.',
              errorLabel: 'Impossible de charger les billing events.',
              isFetching: isBillingEventsListFetching,
              listError: billingEventsListError,
              loadingLabel: 'Chargement des billing events...',
              onRetry: refetchBillingEventsList,
              renderRow: renderBillingEventRow,
              rows: billingEventRows,
            })}
          </View>

          {renderPagination(billingEventsPagination, billingPage, setBillingPage)}
        </View>

        {renderSection(
          'Claims à revoir',
          claims.slice(0, 5),
          (item) => (
            <View key={String(item?.documentId || item?.createdAt || item?.proofUrl)} style={[styles.rowCard, { borderBottomColor: `${Colors.warning500}22` }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {item?.club?.name || 'Club inconnu'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {formatPerson(item?.user)}
                {item?.claimedRole ? ` • ${item.claimedRole}` : ''}
              </Text>
              <Text style={[Fonts.p4Bold, { color: Colors.warning500 }, Spaces.marginTop[4]]}>
                {item?.verificationStatus || item?.state || 'pending'}
              </Text>
            </View>
          ),
          'Aucun claim en attente.',
        )}

        {renderSection(
          'Legacy à migrer',
          legacyCandidates.slice(0, 5),
          (item) => (
            <View key={String(item?.documentId || item?.name)} style={[styles.rowCard, { borderBottomColor: `${Colors.primary200}22` }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {item?.name || 'Club legacy'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {item?.clubPartner ? 'Déjà partenaire' : 'Migration requise'}
              </Text>
              <Text style={[Fonts.p4, { color: Colors.primary200 }, Spaces.marginTop[4]]}>
                Legacy abonnement:
                {' '}
                {Number(item?.subscriptionValue || 0)}
                {' '}
                EUR
              </Text>
              <Text style={[Fonts.p4, { color: Colors.primary200 }, Spaces.marginTop[4]]}>
                Legacy max equipes:
                {' '}
                {Number(item?.maxTeamNumber || 0)}
              </Text>
            </View>
          ),
          'Aucun club legacy dans l aperçu.',
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeStatusModal}
        transparent
        visible={Boolean(statusModalItem)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.neutral900, borderColor: `${Colors.primary500}44` }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Changer le statut</Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
              {statusModalItem?.planCode || 'Plan inconnu'}
            </Text>
            <Text style={[Fonts.p4, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {formatPerson(statusModalItem?.payerUser)}
            </Text>

            <View style={styles.filterRow}>
              {SUBSCRIPTION_STATUS_TARGETS.map((statusOption) => {
                const isActive = statusModalValue === statusOption;
                return (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    key={statusOption}
                    onPress={() => setStatusModalValue(statusOption)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive ? `${Colors.primary500}20` : `${Colors.neutral00}06`,
                        borderColor: isActive ? `${Colors.primary500}66` : `${Colors.neutral00}16`,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4Bold, { color: isActive ? Colors.primary500 : Colors.neutral00 }]}>{statusOption}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
              Raison obligatoire
            </Text>
            <TextInput
              multiline
              onChangeText={setStatusModalReason}
              placeholder="Motif du changement (support, fraude, regularisation...)"
              placeholderTextColor={Colors.neutral400}
              style={[styles.reasonInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
              textAlignVertical="top"
              value={statusModalReason}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={closeStatusModal}
                style={[styles.modalActionButton, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}16` }]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={!canSubmitStatusChange}
                onPress={handleSubmitStatusChange}
                style={[
                  styles.modalActionButton,
                  {
                    backgroundColor: canSubmitStatusChange ? Colors.primary500 : `${Colors.primary500}66`,
                    borderColor: Colors.primary500,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
                  {updateStatusMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeRetryModal}
        transparent
        visible={Boolean(retryModalItem)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.neutral900, borderColor: `${Colors.warning500}44` }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Rejouer le billing event</Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
              {retryModalItem?.eventType || 'Event inconnu'}
            </Text>
            <Text style={[Fonts.p4, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
              {retryModalItem?.provider || 'provider inconnu'}
              {retryModalItem?.providerEventId ? ` • ${retryModalItem.providerEventId}` : ''}
            </Text>

            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
              Raison obligatoire
            </Text>
            <TextInput
              multiline
              onChangeText={setRetryModalReason}
              placeholder="Motif du rejeu (correction webhook, incident résolu...)"
              placeholderTextColor={Colors.neutral400}
              style={[styles.reasonInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
              textAlignVertical="top"
              value={retryModalReason}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={closeRetryModal}
                style={[styles.modalActionButton, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}16` }]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={!canSubmitRetry}
                onPress={handleSubmitRetry}
                style={[
                  styles.modalActionButton,
                  {
                    backgroundColor: canSubmitRetry ? Colors.warning500 : `${Colors.warning500}66`,
                    borderColor: Colors.warning500,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
                  {retryBillingEventMutation.isPending ? 'Rejeu...' : 'Rejouer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  headerActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineActionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  modalActionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 520,
    padding: 20,
    width: '100%',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 16, 0.82)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  paginationButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  reasonInput: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowCard: {
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  rowMain: {
    flex: 1,
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionCard: {
    borderWidth: 1,
  },
  statCard: {
    marginBottom: 12,
    minHeight: 108,
    width: '48%',
  },
  statsGrid: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default AdminRevenue;
