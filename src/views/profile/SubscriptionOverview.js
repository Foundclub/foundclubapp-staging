import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  buildSubscriptionChangePlanPayload,
  buildSubscriptionPurchasePayload,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionSelectableTeams,
  getSubscriptionTestProvider,
  isSubscriptionBillingTestModeEnabled,
  sortSubscriptionCatalogEntries,
} from '@/domains/subscription/subscriptionBilling';
import {
  getCoveredTeamCount,
  getSubscriptionPlanLabels,
  getSubscriptionQuotaItems,
  getSubscriptionStatusMeta,
  getSubscriptionTeamSlotSummary,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import {
  changeSubscriptionPlan,
  getSubscriptionCatalog,
  restoreSubscriptionPurchases,
  validateSubscriptionPurchase,
} from '@/services/subscription/subscriptionService';
import { APP_RUNTIME_ENV } from '@/constants/runtimeFlags';

/**
 * @typedef {{
 *   billingPeriod?: string | null;
 *   isActive?: boolean | null;
 *   planCode?: string | null;
 *   providerProductId?: string | null;
 *   requiresClubVerification?: boolean | null;
 *   scopeType?: string | null;
 *   slotCount?: number | null;
 * }} SubscriptionCatalogEntry
 *
 * @typedef {{
 *   actionMode: 'purchase' | 'change' | 'manage-team-slots';
 *   catalogEntry: SubscriptionCatalogEntry | null;
 *   selectedTeamDocumentIds: string[];
 * }} TeamPlanModalState
 *
 * @typedef {{
 *   action: 'change' | 'purchase';
 *   catalogEntry: SubscriptionCatalogEntry;
 *   payload: Record<string, any>;
 *   successMessage?: string;
 * }} SubscriptionMutationInput
 */

/**
 * @param {any} clubVerificationSummary
 * @returns {string}
 */
const getVerificationLabel = (clubVerificationSummary) => {
  if (!clubVerificationSummary?.clubDocumentId) {
    return 'Aucun club rattache';
  }
  if (clubVerificationSummary?.clubVerified === true) {
    return 'Club verifie';
  }
  if (clubVerificationSummary?.requiresClubVerification === true) {
    return 'Verification dirigeant requise';
  }
  return 'Club non verifie';
};

/**
 * @param {'FREE' | 'TEAM' | 'CLUB_UNVERIFIED' | 'CLUB' | string} subscriptionAccessLevel
 * @returns {{ backgroundColor: string }}
 */
const getStatusChipStyle = (subscriptionAccessLevel) => {
  switch (subscriptionAccessLevel) {
    case 'CLUB':
      return { backgroundColor: '#0F766E' };
    case 'CLUB_UNVERIFIED':
      return { backgroundColor: '#B45309' };
    case 'TEAM':
      return { backgroundColor: '#1D4ED8' };
    default:
      return { backgroundColor: '#475569' };
  }
};

/**
 * @param {SubscriptionCatalogEntry | null | undefined} entry
 * @returns {string}
 */
const getCatalogEntryScopeType = (entry) => String(entry?.scopeType || '').trim().toUpperCase();

/**
 * @param {any} payload
 * @returns {SubscriptionCatalogEntry[]}
 */
const getCatalogEntriesFromResponse = (payload) => {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

/**
 * @param {{ navigation?: any }} props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionOverview({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    allMyTeams,
    clubVerificationSummary,
    entitlementsSummary,
    freeUsageSummary,
    subscriptionAccessLevel,
    subscriptionSummary,
    userData,
  } = useAuth();

  const [activeActionPlanCode, setActiveActionPlanCode] = useState('');
  const [teamPlanModalState, setTeamPlanModalState] = useState(/** @type {TeamPlanModalState} */ ({
    actionMode: 'purchase',
    catalogEntry: null,
    selectedTeamDocumentIds: [],
  }));

  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionExperience = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';
  const isBillingTestModeEnabled = isSubscriptionBillingTestModeEnabled(APP_RUNTIME_ENV);
  const currentClubDocumentId = String(
    clubVerificationSummary?.clubDocumentId
      || userData?.club?.documentId
      || '',
  ).trim();
  const activePlanCodes = useMemo(
    () => (Array.isArray(subscriptionSummary?.activePlanCodes) ? subscriptionSummary.activePlanCodes : []),
    [subscriptionSummary?.activePlanCodes],
  );
  const primarySubscriptionDocumentId = String(
    Array.isArray(subscriptionSummary?.payerSubscriptionIds)
      ? subscriptionSummary.payerSubscriptionIds[0] || ''
      : '',
  ).trim();

  useEffect(() => {
    if (canShowSubscriptionExperience) {
      return;
    }

    if (typeof navigation?.replace === 'function') {
      navigation.replace(RouteNames.Profile);
      return;
    }

    if (typeof navigation?.navigate === 'function') {
      navigation.navigate(RouteNames.Profile);
    }
  }, [canShowSubscriptionExperience, navigation]);

  const catalogQuery = useQuery({
    enabled: canShowSubscriptionExperience,
    queryFn: getSubscriptionCatalog,
    queryKey: ['subscription-catalog'],
    staleTime: 1000 * 60 * 10,
  });

  const catalogEntries = useMemo(
    () => sortSubscriptionCatalogEntries(getCatalogEntriesFromResponse(catalogQuery.data)),
    [catalogQuery.data],
  );

  const teamOptions = useMemo(
    () => getSubscriptionSelectableTeams(allMyTeams),
    [allMyTeams],
  );

  const teamOptionsById = useMemo(() => (
    new Map(teamOptions.map((team) => [String(team?.documentId || '').trim(), team]))
  ), [teamOptions]);

  const statusMeta = useMemo(
    () => getSubscriptionStatusMeta(subscriptionAccessLevel),
    [subscriptionAccessLevel],
  );
  const planLabels = useMemo(
    () => getSubscriptionPlanLabels(subscriptionSummary),
    [subscriptionSummary],
  );
  const quotaItems = useMemo(
    () => getSubscriptionQuotaItems(freeUsageSummary, subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );
  const teamSlotSummary = useMemo(
    () => getSubscriptionTeamSlotSummary(subscriptionSummary),
    [subscriptionSummary],
  );
  const coveredTeamCount = useMemo(
    () => getCoveredTeamCount(entitlementsSummary, subscriptionSummary),
    [entitlementsSummary, subscriptionSummary],
  );
  const clubEntitlementCount = useMemo(
    () => entitlementsSummary.filter(/** @param {any} entry */ (entry) => entry?.scopeType === 'CLUB').length,
    [entitlementsSummary],
  );
  const verificationLabel = getVerificationLabel(clubVerificationSummary);
  const activePlanLabel = planLabels[0] || 'Aucun plan payant actif';
  const coveredTeamNames = useMemo(() => (
    teamSlotSummary.coveredTeamDocumentIds
      .map((teamDocumentId) => teamOptionsById.get(String(teamDocumentId || '').trim())?.name || null)
      .filter(Boolean)
  ), [teamOptionsById, teamSlotSummary.coveredTeamDocumentIds]);
  const currentTeamCatalogEntry = useMemo(() => (
    catalogEntries.find((entry) => (
      getCatalogEntryScopeType(entry) === 'TEAM'
      && (
        activePlanCodes.includes(entry?.planCode)
        || (
          subscriptionAccessLevel === 'TEAM'
          && Number(entry?.slotCount || 0) === teamSlotSummary.total
        )
      )
    )) || null
  ), [activePlanCodes, catalogEntries, subscriptionAccessLevel, teamSlotSummary.total]);

  /** @param {{ action: 'change' | 'purchase'; payload: Record<string, any> }} params */
  const runSubscriptionMutation = async ({ action, payload }) => {
    if (action === 'change') {
      return changeSubscriptionPlan(payload);
    }
    return validateSubscriptionPurchase(payload);
  };

  const subscriptionMutation = useMutation({
    mutationFn: runSubscriptionMutation,
  });

  const restoreMutation = useMutation({
    mutationFn: async () => restoreSubscriptionPurchases({}),
  });

  const closeTeamPlanModal = useCallback(() => {
    setTeamPlanModalState(/** @type {TeamPlanModalState} */ ({
      actionMode: 'purchase',
      catalogEntry: null,
      selectedTeamDocumentIds: [],
    }));
  }, []);

  const refreshSubscriptionContext = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] }),
      queryClient.invalidateQueries({ queryKey: ['get-me'] }),
    ]);
  }, [queryClient]);

  const commitSubscriptionMutation = useCallback(/**
   * @param {SubscriptionMutationInput} params
   * @returns {Promise<any>}
   */
  async (params) => {
    const {
      action,
      catalogEntry,
      payload,
      successMessage,
    } = params;
    const actionPlanCode = String(catalogEntry?.planCode || '').trim();
    setActiveActionPlanCode(actionPlanCode);

    try {
      const result = await subscriptionMutation.mutateAsync({ action, payload });
      await refreshSubscriptionContext();
      closeTeamPlanModal();

      Alert.alert(
        action === 'change' ? 'Abonnement mis a jour' : 'Abonnement active',
        successMessage || 'Ton contexte abonnement vient d etre mis a jour.',
      );

      return result;
    } catch (error) {
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
      throw error;
    } finally {
      setActiveActionPlanCode('');
    }
  }, [closeTeamPlanModal, refreshSubscriptionContext, subscriptionMutation]);

  const openTeamPlanModal = useCallback(/**
   * @param {SubscriptionCatalogEntry} catalogEntry
   * @param {'purchase' | 'change' | 'manage-team-slots'} [actionMode]
   */
  (catalogEntry, actionMode = 'purchase') => {
    const slotCount = Number(catalogEntry?.slotCount || 0);
    setTeamPlanModalState(/** @type {TeamPlanModalState} */ ({
      actionMode,
      catalogEntry,
      selectedTeamDocumentIds: getInitialTeamSelection({
        availableTeams: teamOptions,
        coveredTeamDocumentIds: teamSlotSummary.coveredTeamDocumentIds,
        slotCount,
      }),
    }));
  }, [teamOptions, teamSlotSummary.coveredTeamDocumentIds]);

  const handleCatalogAction = useCallback(/**
   * @param {SubscriptionCatalogEntry} catalogEntry
   */
  async (catalogEntry) => {
    const scopeType = getCatalogEntryScopeType(catalogEntry);
    const hasPaidSubscription = Boolean(primarySubscriptionDocumentId);
    const action = hasPaidSubscription ? 'change' : 'purchase';

    if (scopeType === 'TEAM') {
      openTeamPlanModal(catalogEntry, activePlanCodes.includes(catalogEntry?.planCode) ? 'manage-team-slots' : action);
      return;
    }

    if (!currentClubDocumentId) {
      Alert.alert(
        'Club requis',
        'Rattache d abord ton compte a un club avant de prendre une offre Club.',
      );
      return;
    }

    if (!isBillingTestModeEnabled) {
      Alert.alert(
        'Checkout indisponible',
        'Le checkout store reel sera branche dans une prochaine vague. Utilise le mode test local ou staging pour la recette complete.',
      );
      return;
    }

    const provider = getSubscriptionTestProvider(Platform.OS);
    const payload = hasPaidSubscription
      ? buildSubscriptionChangePlanPayload({
        catalogEntry,
        clubDocumentId: currentClubDocumentId,
        provider,
        subscriptionDocumentId: primarySubscriptionDocumentId,
        teamDocumentIds: [],
        trustedValidation: true,
      })
      : buildSubscriptionPurchasePayload({
        catalogEntry,
        clubDocumentId: currentClubDocumentId,
        provider,
        teamDocumentIds: [],
        trustedValidation: true,
      });

    await commitSubscriptionMutation({
      action,
      catalogEntry,
      payload,
      successMessage: getCatalogEntryScopeType(catalogEntry) === 'CLUB'
        ? 'Ton offre Club est bien enregistree. Si ton club n est pas encore verifie, il apparaitra en CLUB_UNVERIFIED.'
        : 'Ton offre a bien ete activee.',
    });
  }, [
    activePlanCodes,
    commitSubscriptionMutation,
    currentClubDocumentId,
    isBillingTestModeEnabled,
    openTeamPlanModal,
    primarySubscriptionDocumentId,
  ]);

  const selectedTeamPlanEntry = teamPlanModalState.catalogEntry;
  const selectedTeamSlotCount = Number(selectedTeamPlanEntry?.slotCount || 0);
  /** @type {string[]} */
  const selectedTeamIds = Array.isArray(teamPlanModalState.selectedTeamDocumentIds)
    ? teamPlanModalState.selectedTeamDocumentIds
    : [];
  const hasAtLeastOneSelectedTeam = selectedTeamIds.length > 0;
  const isSelectedTeamCountInvalid = selectedTeamIds.length > selectedTeamSlotCount;
  const isTeamSelectionConfirmDisabled = !selectedTeamPlanEntry
    || selectedTeamSlotCount <= 0
    || !hasAtLeastOneSelectedTeam
    || isSelectedTeamCountInvalid
    || !isBillingTestModeEnabled
    || subscriptionMutation.isPending;

  const handleToggleTeamSelection = useCallback(/**
   * @param {string} teamDocumentId
   */
  (teamDocumentId) => {
    setTeamPlanModalState((currentState) => {
      const currentSelection = Array.isArray(currentState.selectedTeamDocumentIds)
        ? currentState.selectedTeamDocumentIds
        : [];
      const isAlreadySelected = currentSelection.includes(teamDocumentId);
      if (isAlreadySelected) {
        return {
          ...currentState,
          selectedTeamDocumentIds: currentSelection.filter((entry) => entry !== teamDocumentId),
        };
      }

      const slotCount = Number(currentState.catalogEntry?.slotCount || 0);
      if (currentSelection.length >= slotCount) {
        Alert.alert(
          'Slots Team atteints',
          `Cette offre couvre ${slotCount} equipe${slotCount > 1 ? 's' : ''} maximum.`,
        );
        return currentState;
      }

      return {
        ...currentState,
        selectedTeamDocumentIds: [...currentSelection, teamDocumentId],
      };
    });
  }, []);

  const handleConfirmTeamPlan = useCallback(async () => {
    if (!selectedTeamPlanEntry) {
      return;
    }

    if (teamOptions.length === 0) {
      Alert.alert(
        'Equipe requise',
        'Ajoute ou rattache d abord une equipe avant de prendre une offre Team.',
      );
      return;
    }

    if (!hasAtLeastOneSelectedTeam) {
      Alert.alert(
        'Equipe requise',
        'Selectionne au moins une equipe a couvrir avec cette offre Team.',
      );
      return;
    }

    if (!isBillingTestModeEnabled) {
      Alert.alert(
        'Checkout indisponible',
        'Le checkout store reel sera branche dans une prochaine vague. Utilise le mode test local ou staging pour la recette complete.',
      );
      return;
    }

    const action = primarySubscriptionDocumentId ? 'change' : 'purchase';
    const provider = getSubscriptionTestProvider(Platform.OS);
    const payload = primarySubscriptionDocumentId
      ? buildSubscriptionChangePlanPayload({
        catalogEntry: selectedTeamPlanEntry,
        provider,
        subscriptionDocumentId: primarySubscriptionDocumentId,
        teamDocumentIds: selectedTeamIds,
        trustedValidation: true,
      })
      : buildSubscriptionPurchasePayload({
        catalogEntry: selectedTeamPlanEntry,
        provider,
        teamDocumentIds: selectedTeamIds,
        trustedValidation: true,
      });

    await commitSubscriptionMutation({
      action,
      catalogEntry: selectedTeamPlanEntry,
      payload,
      successMessage: `Ton offre Team couvre maintenant ${selectedTeamIds.length} equipe${selectedTeamIds.length > 1 ? 's' : ''}.`,
    });
  }, [
    commitSubscriptionMutation,
    hasAtLeastOneSelectedTeam,
    isBillingTestModeEnabled,
    primarySubscriptionDocumentId,
    selectedTeamIds,
    selectedTeamPlanEntry,
    teamOptions.length,
  ]);

  const handleRestorePurchases = useCallback(async () => {
    try {
      const restoredPayload = await restoreMutation.mutateAsync();
      await refreshSubscriptionContext();
      const restoredCount = Number(restoredPayload?.meta?.restoredCount || restoredPayload?.data?.length || 0);
      Alert.alert(
        'Restauration terminee',
        restoredCount > 0
          ? `${restoredCount} abonnement${restoredCount > 1 ? 's ont ete retrouves' : ' a ete retrouve'}.`
          : 'Aucun achat n a ete retrouve sur ce compte.',
      );
    } catch (error) {
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
    }
  }, [refreshSubscriptionContext, restoreMutation]);

  const renderOfferAction = useCallback(/**
   * @param {SubscriptionCatalogEntry} catalogEntry
   */
  (catalogEntry) => {
    const planCode = String(catalogEntry?.planCode || '').trim();
    const isActivePlan = activePlanCodes.includes(planCode);
    const scopeType = getCatalogEntryScopeType(catalogEntry);
    const isCurrentTeamPlan = isActivePlan && scopeType === 'TEAM';
    const isLoading = subscriptionMutation.isPending && activeActionPlanCode === planCode;
    const isDisabled = !isBillingTestModeEnabled;

    if (isCurrentTeamPlan) {
      return (
        <Button
          disabled={!isBillingTestModeEnabled}
          isLoading={isLoading}
          onPress={() => openTeamPlanModal(catalogEntry, 'manage-team-slots')}
          title={isBillingTestModeEnabled ? 'Mettre a jour mes equipes' : 'Plan actif'}
          variant="SecondaryLight"
        />
      );
    }

    if (isActivePlan) {
      return (
        <View style={[
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
          ApplicationStyle.borderRadius12,
          { backgroundColor: 'rgba(15, 118, 110, 0.14)' },
        ]}
        >
          <Text style={[Fonts.p2Bold, { color: '#6EE7B7' }]}>Plan actif</Text>
        </View>
      );
    }

    return (
      <Button
        disabled={isDisabled}
        isLoading={isLoading}
        onPress={() => handleCatalogAction(catalogEntry)}
        title={primarySubscriptionDocumentId ? 'Changer d offre' : 'Choisir cette offre'}
        variant="PrimaryLight"
      />
    );
  }, [
    activeActionPlanCode,
    activePlanCodes,
    handleCatalogAction,
    isBillingTestModeEnabled,
    openTeamPlanModal,
    primarySubscriptionDocumentId,
    subscriptionMutation.isPending,
  ]);

  if (!canShowSubscriptionExperience) {
    return null;
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[12],
        Spaces.paddingTop[0],
      ]}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[24]]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('profile.subscription.title', 'Mon abonnement')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'profile.subscription.subtitle',
              'Cet ecran reprend exactement le contexte abonnement renvoye par le backend FoundClub.',
            )}
          </Text>
        </View>

        <View style={[
          Spaces.gap[12],
          Spaces.padding[16],
          ApplicationStyle.borderRadius12,
          ApplicationStyle.borderWidth1,
          ApplicationStyle.borderColor.primary100,
          ApplicationStyle.backgroundColor.primary700,
        ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={[
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
              ApplicationStyle.borderRadius12,
              getStatusChipStyle(subscriptionAccessLevel),
            ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {statusMeta.label}
              </Text>
            </View>
            <Text style={[Fonts.p2Bold, Fonts.primary100]}>
              {verificationLabel}
            </Text>
          </View>

          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {activePlanLabel}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {statusMeta.description}
            </Text>
          </View>

          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <View style={[
              { minWidth: 132 },
              Spaces.gap[4],
              Spaces.padding[12],
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.neutral700,
            ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {t('profile.subscription.stats.plans', 'Plans actifs')}
              </Text>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {planLabels.length}
              </Text>
            </View>
            <View style={[
              { minWidth: 132 },
              Spaces.gap[4],
              Spaces.padding[12],
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.neutral700,
            ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {t('profile.subscription.stats.coveredTeams', 'Equipes couvertes')}
              </Text>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {coveredTeamCount}
              </Text>
            </View>
            <View style={[
              { minWidth: 132 },
              Spaces.gap[4],
              Spaces.padding[12],
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.neutral700,
            ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {t('profile.subscription.stats.clubRights', 'Droits club')}
              </Text>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {clubEntitlementCount}
              </Text>
            </View>
            {teamSlotSummary.total > 0 ? (
              <View style={[
                { minWidth: 132 },
                Spaces.gap[4],
                Spaces.padding[12],
                ApplicationStyle.borderRadius12,
                ApplicationStyle.backgroundColor.neutral700,
              ]}
              >
                <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                  {t('profile.subscription.stats.teamSlots', 'Slots Team')}
                </Text>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                  {`${teamSlotSummary.assigned}/${teamSlotSummary.total}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {subscriptionAccessLevel === 'CLUB_UNVERIFIED' ? (
          <View style={[
            Spaces.gap[12],
            Spaces.padding[16],
            ApplicationStyle.borderRadius12,
            { backgroundColor: 'rgba(180, 83, 9, 0.18)', borderColor: 'rgba(251, 191, 36, 0.45)', borderWidth: 1 },
          ]}
          >
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('profile.subscription.unverified.title', 'Verification du club requise')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'profile.subscription.unverified.description',
                'Votre abonnement Club existe deja, mais les droits club restent bloques tant que la verification dirigeant n est pas terminee.',
              )}
            </Text>
            {currentClubDocumentId ? (
              <Button
                onPress={() => navigation.navigate(RouteNames.ClubStack, {
                  params: { clubId: currentClubDocumentId },
                  screen: RouteNames.Club,
                })}
                title={t('profile.subscription.unverified.cta', 'Ouvrir mon club')}
                variant="SecondaryLight"
              />
            ) : null}
          </View>
        ) : null}

        <View style={[
          Spaces.gap[12],
          Spaces.padding[16],
          ApplicationStyle.borderRadius12,
          ApplicationStyle.borderWidth1,
          ApplicationStyle.borderColor.primary100,
          ApplicationStyle.backgroundColor.primary700,
        ]}
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('profile.subscription.section.plan', 'Plans et droits actifs')}
          </Text>

          <View style={[Spaces.gap[8]]}>
            <View>
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {t('profile.subscription.section.currentPlan', 'Plan principal')}
              </Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{activePlanLabel}</Text>
            </View>

            <View>
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {t('profile.subscription.section.planList', 'Tous les plans actifs')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {planLabels.length ? planLabels.join(' | ') : 'Aucun'}
              </Text>
            </View>

            <View>
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {t('profile.subscription.section.verification', 'Etat de verification')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {verificationLabel}
              </Text>
            </View>

            {teamSlotSummary.total > 0 ? (
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                  {t('profile.subscription.section.teamSlots', 'Slots Team')}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {`${teamSlotSummary.assigned} utilise${teamSlotSummary.assigned > 1 ? 's' : ''} / ${teamSlotSummary.total} - ${teamSlotSummary.available} restant${teamSlotSummary.available > 1 ? 's' : ''}`}
                </Text>
                {coveredTeamNames.length > 0 ? (
                  <Text style={[Fonts.p4, Fonts.neutral200]}>
                    {`Equipes couvertes : ${coveredTeamNames.join(' | ')}`}
                  </Text>
                ) : (
                  <Text style={[Fonts.p4, Fonts.neutral200]}>
                    Aucun slot Team n est encore attribue.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        </View>

        <View style={[
          Spaces.gap[12],
          Spaces.padding[16],
          ApplicationStyle.borderRadius12,
          ApplicationStyle.borderWidth1,
          ApplicationStyle.borderColor.primary100,
          ApplicationStyle.backgroundColor.primary700,
        ]}
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('profile.subscription.section.freeQuotas', 'Quotas gratuits')}
          </Text>
          {quotaItems.length ? quotaItems.map((item) => (
            <View
              key={item.quotaType}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.paddingVertical[8],
                { borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomWidth: 1 },
              ]}
            >
              <View style={[{ flex: 1, minWidth: 0 }, Spaces.gap[4]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{item.label}</Text>
                <Text style={[Fonts.p4, Fonts.neutral200]}>
                  {`${item.remaining} restant${item.remaining > 1 ? 's' : ''} / ${item.total}`}
                </Text>
              </View>
              <Text style={[Fonts.p1Bold, Fonts.primary100]}>
                {item.used}
                /
                {item.total}
              </Text>
            </View>
          )) : (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'profile.subscription.section.freeQuotasEmpty',
                'Aucun compteur gratuit n est actuellement affiche pour cette offre.',
              )}
            </Text>
          )}
        </View>

        <View style={[
          Spaces.gap[12],
          Spaces.padding[16],
          ApplicationStyle.borderRadius12,
          ApplicationStyle.borderWidth1,
          ApplicationStyle.borderColor.primary100,
          ApplicationStyle.backgroundColor.primary700,
        ]}
        >
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Changer d offre</Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {isBillingTestModeEnabled
                ? 'Mode test actif : les changements d offre utilisent trustedValidation=true pour la recette locale et staging.'
                : 'Le checkout store reel n est pas encore branche sur ce build. Cette section reste en lecture tant que le flow Apple/Google n est pas disponible.'}
            </Text>
          </View>

          <View style={[
            Spaces.gap[12],
            Spaces.padding[16],
            ApplicationStyle.borderRadius12,
            ApplicationStyle.backgroundColor.neutral700,
          ]}
          >
            <View style={[Spaces.gap[4]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Free</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Continue en gratuit avec les quotas serveur affiches ci-dessus.
              </Text>
            </View>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12], { flexWrap: 'wrap' }]}>
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {subscriptionAccessLevel === 'FREE' ? 'Etat actuel' : 'Toujours disponible'}
              </Text>
              {subscriptionAccessLevel === 'FREE' ? (
                <View style={[
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  ApplicationStyle.borderRadius12,
                  { backgroundColor: 'rgba(71, 85, 105, 0.22)' },
                ]}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Plan actuel</Text>
                </View>
              ) : null}
            </View>
          </View>

          {catalogQuery.isLoading && !catalogEntries.length ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>Chargement du catalogue abonnement...</Text>
          ) : null}

          {catalogQuery.error && !catalogEntries.length ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {getSubscriptionBillingErrorMessage(catalogQuery.error)}
            </Text>
          ) : null}

          {catalogEntries.map((entry) => {
            const entryMeta = getSubscriptionCatalogEntryMeta(entry);
            const isCurrentPlan = activePlanCodes.includes(entry?.planCode);
            const isTeamEntry = getCatalogEntryScopeType(entry) === 'TEAM';
            const isEntryDisabled = isTeamEntry && teamOptions.length === 0 && teamSlotSummary.total === 0;

            return (
              <View
                key={entry?.planCode || `${entry?.scopeType}-${entry?.billingPeriod}`}
                style={[
                  Spaces.gap[12],
                  Spaces.padding[16],
                  ApplicationStyle.borderRadius12,
                  ApplicationStyle.borderWidth1,
                  ApplicationStyle.borderColor.primary100,
                  ApplicationStyle.backgroundColor.neutral700,
                  isCurrentPlan ? { borderColor: 'rgba(110, 231, 183, 0.55)' } : null,
                ]}
              >
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{entryMeta.label}</Text>
                  <Text style={[Fonts.p4Bold, Fonts.primary100]}>{entryMeta.secondaryLabel}</Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>{entryMeta.description}</Text>
                  {entry?.requiresClubVerification ? (
                    <Text style={[Fonts.p4, Fonts.neutral200]}>
                      Verification dirigeant obligatoire avant ouverture des droits Club sensibles.
                    </Text>
                  ) : null}
                  {isEntryDisabled ? (
                    <Text style={[Fonts.p4, Fonts.neutral200]}>
                      Ajoute ou rattache d abord une equipe pour activer utilement une offre Team.
                    </Text>
                  ) : null}
                </View>

                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12], { flexWrap: 'wrap' }]}>
                  {renderOfferAction(entry)}
                </View>
              </View>
            );
          })}
        </View>

        <View style={[
          Spaces.gap[12],
          Spaces.padding[16],
          ApplicationStyle.borderRadius12,
          ApplicationStyle.borderWidth1,
          ApplicationStyle.borderColor.primary100,
          ApplicationStyle.backgroundColor.primary700,
        ]}
        >
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Restauration</Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Rejoue la lecture des achats connus cote backend avant l integration finale des stores.
            </Text>
          </View>
          <Button
            isLoading={restoreMutation.isPending}
            onPress={handleRestorePurchases}
            title="Restaurer mes achats"
            variant="SecondaryLight"
          />
        </View>

        {currentClubDocumentId ? (
          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.ClubStack, {
              params: { clubId: currentClubDocumentId },
              screen: RouteNames.Club,
            })}
            style={[
              Spaces.padding[16],
              ApplicationStyle.borderRadius12,
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.primary100,
              ApplicationStyle.backgroundColor.primary700,
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('profile.subscription.section.clubCta', 'Voir le club concerne')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'profile.subscription.section.clubCtaDescription',
                'Retrouvez ensuite les ecrans de club, les demandes et l etat de verification.',
              )}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <BottomModal
        close={closeTeamPlanModal}
        isVisible={Boolean(selectedTeamPlanEntry)}
        scrollable
        snapPoints={['82%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {teamPlanModalState.actionMode === 'manage-team-slots'
                ? 'Mettre a jour mes equipes couvertes'
                : 'Choisir les equipes couvertes'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {selectedTeamPlanEntry
                ? `Cette offre Team couvre jusqu a ${selectedTeamSlotCount} equipe${selectedTeamSlotCount > 1 ? 's' : ''}.`
                : ''}
            </Text>
          </View>

          {!isBillingTestModeEnabled ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Le checkout store reel n est pas encore branche sur ce build. Utilise la recette locale ou staging pour tester cette action.
            </Text>
          ) : null}

          {teamOptions.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Aucune equipe exploitable n a ete trouvee sur ce compte pour une offre Team.
            </Text>
          ) : (
            <View style={[Spaces.gap[12]]}>
              {teamOptions.map((team) => {
                const teamDocumentId = String(team?.documentId || '').trim();
                const isSelected = selectedTeamIds.includes(teamDocumentId);
                const teamClubName = String(team?.club?.name || '').trim();

                return (
                  <Checkable
                    disableBounceAnimation
                    isChecked={isSelected}
                    key={teamDocumentId}
                    setIsChecked={() => handleToggleTeamSelection(teamDocumentId)}
                    text=""
                    type="square"
                    wrapperStyle={{ backgroundColor: isSelected ? '#01B3F4' : 'rgba(255,255,255,0.04)' }}
                  >
                    <View style={[Alignments.fill, Spaces.gap[4]]}>
                      <Text style={[Fonts.p2Bold, isSelected ? Fonts.primary700 : Fonts.neutral00]}>
                        {team?.name || 'Equipe sans nom'}
                      </Text>
                      {teamClubName ? (
                        <Text style={[Fonts.p4, isSelected ? Fonts.primary700 : Fonts.neutral200]}>
                          {teamClubName}
                        </Text>
                      ) : null}
                    </View>
                  </Checkable>
                );
              })}
            </View>
          )}

          {isSelectedTeamCountInvalid ? (
            <Text style={[Fonts.p4, { color: '#FCA5A5' }]}>
              Trop d equipes selectionnees pour cette formule.
            </Text>
          ) : null}

          {selectedTeamPlanEntry ? (
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              {`${selectedTeamIds.length}/${selectedTeamSlotCount} slot${selectedTeamSlotCount > 1 ? 's' : ''} utilise${selectedTeamIds.length > 1 ? 's' : ''}`}
            </Text>
          ) : null}

          <View style={[Spaces.gap[8]]}>
            <Button
              isLoading={subscriptionMutation.isPending}
              onPress={handleConfirmTeamPlan}
              title={primarySubscriptionDocumentId ? 'Confirmer le changement' : 'Activer cette offre Team'}
              variant="PrimaryLight"
              disabled={isTeamSelectionConfirmDisabled}
            />
            <Button
              onPress={closeTeamPlanModal}
              title="Annuler"
              variant="SecondaryLight"
            />
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default SubscriptionOverview;
