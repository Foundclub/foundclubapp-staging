import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  buildSubscriptionChangePlanPayload,
  buildSubscriptionPurchasePayload,
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionSelectableTeams,
  getSubscriptionTestProvider,
  isSubscriptionBillingTestModeEnabled,
  sortSubscriptionCatalogEntries,
} from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionPlanLabel,
  getCoveredTeamCount,
  getSubscriptionQuotaItems,
  getSubscriptionStatusMeta,
  getSubscriptionTeamSlotSummary,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import TierSelector from '@/components/molecules/tierSelector/TierSelector';
import ScreenContainer from '@/components/templates/ScreenContainer';
import SubscriptionCoveredHero from '@/views/profile/SubscriptionCoveredHero';

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
 *   displayName?: string | null;
 *   featureKeys?: string[] | null;
 *   isActive?: boolean | null;
 *   maxTeams?: number | null;
 *   planCode?: string | null;
 *   providerProductId?: string | null;
 *   referencePriceEurCents?: number | null;
 *   requiresClubVerification?: boolean | null;
 *   scopeType?: string | null;
 *   slotCount?: number | null;
 * }} SubscriptionCatalogEntry
 * @typedef {{
 *   actionMode: 'purchase' | 'change' | 'manage-team-slots';
 *   catalogEntry: SubscriptionCatalogEntry | null;
 *   selectedTeamDocumentIds: string[];
 * }} TeamPlanModalState
 * @typedef {{
 *   action: 'change' | 'purchase';
 *   catalogEntry: SubscriptionCatalogEntry;
 *   payload: Record<string, any>;
 *   successMessage?: string;
 * }} SubscriptionMutationInput
 * @typedef {{
 *   entry: SubscriptionCatalogEntry;
 *   maxTeamsLabel: string;
 *   priceLabel: string;
 *   tier: number;
 *   tierLetter: string;
 * }} ClubTierOption
 */

/** @type {Record<string, string>} */
const SUBSCRIPTION_FEATURE_LABELS = {
  'club.broadcast': 'Canal de diffusion',
  'club.multi_teams': 'Toutes les equipes du club',
  'club.profile': 'Fiche club complete',
  'club.roles': 'Roles du club',
  composition: 'Composition d equipe',
  convocation: 'Convocations',
  'dues.club': 'Cotisations du club',
  'dues.team': 'Cotisations de l equipe',
  'events.unlimited': 'Evenements illimites',
  facilities: 'Installations',
  'matches.unlimited': 'Matchs illimites',
  'recruitment.unlimited': 'Annonces illimitees',
  sponsors: 'Sponsors et partenaires',
};

/** @type {Record<string, string>} */
const TRIAL_PLAN_LABELS = {
  fc_trial_club: 'Apercu Club (essai 30 jours)',
  fc_trial_team: 'Apercu Equipe (essai 30 jours)',
};

/** @type {Record<number, string>} */
const CLUB_TIER_LETTERS = {
  1: 'S',
  2: 'M',
  3: 'L',
};

const FREE_PLAN_INCLUDED_LABELS = [
  '1 equipe gratuite',
  'Evenements et matchs en quantite limitee',
  'Annonces de recrutement limitees',
];

const OFFER_BILLING_PERIOD_OPTIONS = [
  { key: 'monthly', label: 'Mensuel', subLabel: '' },
  { key: 'yearly', label: 'Annuel', subLabel: '2 mois offerts' },
];

// Selecteur de periode de la carte payeur (defaut produit : annuel).
const PAYER_BILLING_PERIOD_OPTIONS = [
  { id: 'yearly', label: 'Annuel · 2 mois offerts' },
  { id: 'monthly', label: 'Mensuel' },
];

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
 * @param {SubscriptionCatalogEntry | null | undefined} entry
 * @returns {string}
 */
const getCatalogEntryBillingPeriod = (entry) => String(entry?.billingPeriod || '').trim().toLowerCase();

/**
 * @param {SubscriptionCatalogEntry | null | undefined} entry
 * @returns {number}
 */
const getCatalogEntryClubTier = (entry) => (
  Number(String(entry?.planCode || '').match(/tier_(\d+)/)?.[1] || 0)
);

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
 * @param {any} subscriptionSummary
 * @returns {any | null}
 */
const getActiveTrialSubscription = (subscriptionSummary) => {
  const payerSubscriptions = Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)
    ? subscriptionSummary.payerSubscriptionsSummary
    : [];

  return payerSubscriptions.find(/** @param {any} entry */ (entry) => entry?.isTrial === true
    && ['active', 'grace_period'].includes(String(entry?.status || '').trim().toLowerCase())) || null;
};

/**
 * @param {string | null | undefined} currentPeriodEnd
 * @returns {number}
 */
const getTrialRemainingDays = (currentPeriodEnd) => {
  const endTime = new Date(String(currentPeriodEnd || '')).getTime();
  if (!Number.isFinite(endTime)) {
    return 0;
  }

  return Math.max(0, Math.ceil((endTime - Date.now()) / (1000 * 60 * 60 * 24)));
};

/**
 * @param {string | null | undefined} planCode
 * @returns {string}
 */
const getTrialScopeLabel = (planCode) => (
  String(planCode || '').trim().toLowerCase().includes('club') ? 'Club' : 'Equipe'
);

/**
 * @param {string | null | undefined} planCode
 * @returns {string}
 */
const formatSubscriptionPlanLabelWithTrial = (planCode) => (
  TRIAL_PLAN_LABELS[String(planCode || '').trim().toLowerCase()]
    || formatSubscriptionPlanLabel(planCode)
);

/**
 * @param {SubscriptionCatalogEntry | null | undefined} entry
 * @returns {string}
 */
const getYearlyMonthlyEquivalentLabel = (entry) => {
  if (getCatalogEntryBillingPeriod(entry) !== 'yearly') {
    return '';
  }

  return formatSubscriptionMonthlyEquivalentLabel(entry?.referencePriceEurCents);
};

/**
 * @param {{ trialSubscription: any }} props
 * @returns {import('react').ReactElement}
 */
function SubscriptionTrialBanner({ trialSubscription }) {
  const { ApplicationStyle, Fonts, Spaces } = useTheme();
  const remainingDays = getTrialRemainingDays(trialSubscription?.currentPeriodEnd);

  return (
    <View style={[
      Spaces.gap[4],
      Spaces.padding[16],
      ApplicationStyle.borderRadius12,
      ApplicationStyle.borderWidth1,
      ApplicationStyle.borderColor.primary700,
      ApplicationStyle.backgroundColor.primary100,
    ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.primary700]}>
        {`Apercu ${getTrialScopeLabel(trialSubscription?.planCode)} · J-${remainingDays}`}
      </Text>
      <Text style={[Fonts.p2, Fonts.primary700]}>
        Aucune carte requise. Retour au plan gratuit ensuite.
      </Text>
    </View>
  );
}

/**
 * @param {{
 *   billingPeriod: string;
 *   onChangeBillingPeriod: (billingPeriod: string) => void;
 * }} props
 * @returns {import('react').ReactElement}
 */
function OfferBillingPeriodToggle({ billingPeriod, onChangeBillingPeriod }) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[
      Alignments.row,
      Spaces.gap[4],
      Spaces.padding[4],
      ApplicationStyle.borderRadius12,
      ApplicationStyle.backgroundColor.neutral700,
    ]}
    >
      {OFFER_BILLING_PERIOD_OPTIONS.map((option) => {
        const isSelected = option.key === billingPeriod;

        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChangeBillingPeriod(option.key)}
            style={[
              Alignments.alignCenter,
              Alignments.fill,
              Spaces.paddingVertical[8],
              ApplicationStyle.borderRadius8,
              isSelected ? ApplicationStyle.backgroundColor.primary500 : null,
            ]}
          >
            <Text style={[Fonts.p2Bold, isSelected ? Fonts.primary700 : Fonts.neutral200]}>
              {option.label}
            </Text>
            {option.subLabel ? (
              <Text style={[Fonts.p4Bold, isSelected ? Fonts.primary700 : Fonts.success500]}>
                {option.subLabel}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * @param {{
 *   onSelectSlotCount: (slotCount: number) => void;
 *   selectedSlotCount: number;
 *   slotCountOptions: number[];
 * }} props
 * @returns {import('react').ReactElement}
 */
function OfferTeamCountStepper({ onSelectSlotCount, selectedSlotCount, slotCountOptions }) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p4Bold, Fonts.primary100]}>Nombre d equipes couvertes</Text>
      <View style={[Alignments.row, Spaces.gap[8]]}>
        {slotCountOptions.map((slotCount) => {
          const isSelected = slotCount === selectedSlotCount;

          return (
            <TouchableOpacity
              key={slotCount}
              onPress={() => onSelectSlotCount(slotCount)}
              style={[
                Alignments.alignCenter,
                Alignments.fill,
                Spaces.paddingVertical[8],
                ApplicationStyle.borderRadius8,
                ApplicationStyle.borderWidth1,
                isSelected
                  ? ApplicationStyle.borderColor.primary500
                  : ApplicationStyle.borderColor.neutral600,
                isSelected ? ApplicationStyle.backgroundColor.primary500 : null,
              ]}
            >
              <Text style={[Fonts.p2Bold, isSelected ? Fonts.primary700 : Fonts.neutral00]}>
                {String(slotCount)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * @param {{ featureKeys?: string[] | null }} props
 * @returns {import('react').ReactElement | null}
 */
function OfferFeatureList({ featureKeys }) {
  const { Alignments, Fonts, Spaces } = useTheme();
  const safeFeatureKeys = Array.isArray(featureKeys) ? featureKeys.filter(Boolean) : [];

  if (safeFeatureKeys.length === 0) {
    return null;
  }

  return (
    <View style={[Spaces.gap[4]]}>
      {safeFeatureKeys.map((featureKey) => (
        <View key={String(featureKey)} style={[Alignments.row, Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, Fonts.success500]}>✓</Text>
          <Text style={[Alignments.fill, Fonts.p2, Fonts.neutral100]}>
            {SUBSCRIPTION_FEATURE_LABELS[String(featureKey)] || String(featureKey)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * @param {{ isCurrentPlan: boolean }} props
 * @returns {import('react').ReactElement}
 */
function FreeOfferCard({ isCurrentPlan }) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[
      Spaces.gap[12],
      Spaces.padding[16],
      ApplicationStyle.borderRadius12,
      ApplicationStyle.borderWidth1,
      ApplicationStyle.borderColor.neutral600,
      ApplicationStyle.backgroundColor.neutral700,
    ]}
    >
      <View style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.gap[12],
      ]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Gratuit</Text>
        {isCurrentPlan ? (
          <View style={[
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            ApplicationStyle.borderRadius12,
            { backgroundColor: 'rgba(71, 85, 105, 0.22)' },
          ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Votre plan actuel</Text>
          </View>
        ) : null}
      </View>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        Continue en gratuit avec les quotas serveur affiches ci-dessus.
      </Text>
      <View style={[Spaces.gap[4]]}>
        {FREE_PLAN_INCLUDED_LABELS.map((label) => (
          <View key={label} style={[Alignments.row, Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, Fonts.success500]}>✓</Text>
            <Text style={[Alignments.fill, Fonts.p2, Fonts.neutral100]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * @param {{
 *   isSelected: boolean;
 *   onSelect: () => void;
 *   tierOption: ClubTierOption;
 * }} props
 * @returns {import('react').ReactElement}
 */
function ClubTierOptionRow({ isSelected, onSelect, tierOption }) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.gap[12],
        Spaces.padding[12],
        ApplicationStyle.borderRadius12,
        ApplicationStyle.borderWidth1,
        isSelected
          ? ApplicationStyle.borderColor.primary500
          : ApplicationStyle.borderColor.neutral600,
        isSelected ? { backgroundColor: 'rgba(1, 179, 244, 0.12)' } : null,
      ]}
    >
      <View style={[Alignments.fill, Spaces.gap[4]]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{`Club ${tierOption.tierLetter}`}</Text>
        <Text style={[Fonts.p4, Fonts.neutral200]}>{tierOption.maxTeamsLabel}</Text>
      </View>
      <Text style={[Fonts.p2Bold, Fonts.primary100]}>{tierOption.priceLabel}</Text>
    </TouchableOpacity>
  );
}

/**
 * @param {{ navigation?: any }} props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionOverview({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
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
  const [offerBillingPeriod, setOfferBillingPeriod] = useState('yearly');
  const [offerTeamSlotCount, setOfferTeamSlotCount] = useState(1);
  const [offerClubTier, setOfferClubTier] = useState(1);
  const hasSyncedOfferSelectionRef = useRef(false);

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

  // « Deja couvert » (handoff 7b) : quelqu'un d'autre paie pour mon equipe/club
  // et je n'ai aucun plan actif en tant que payeur -> page heros dediee.
  const coveringEntitlement = useMemo(() => {
    if (activePlanCodes.length > 0) {
      return null;
    }
    const myDocumentId = String(userData?.documentId || '').trim();
    const candidates = entitlementsSummary.filter(
      /** @param {any} entry */ (entry) => entry?.paidBy?.documentId
        && entry.paidBy.documentId !== myDocumentId,
    );
    return candidates.find(/** @param {any} entry */ (entry) => entry?.scopeType === 'CLUB')
      || candidates[0]
      || null;
  }, [activePlanCodes, entitlementsSummary, userData?.documentId]);
  const coveredByOtherTeamNames = useMemo(() => Array.from(new Set(
    entitlementsSummary
      .filter(/** @param {any} entry */ (entry) => entry?.scopeType === 'TEAM' && entry?.scopeTeamName)
      .map(/** @param {any} entry */ (entry) => String(entry.scopeTeamName)),
  )), [entitlementsSummary]);

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
    () => activePlanCodes.map(/** @param {string} planCode */ (planCode) => formatSubscriptionPlanLabelWithTrial(planCode)),
    [activePlanCodes],
  );
  const quotaItems = useMemo(
    () => getSubscriptionQuotaItems(freeUsageSummary, subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );
  // --- Vue payeur (handoff 10f) : mon offre Équipe, equipes couvertes, palier in situ ---
  const activeTeamPlanCode = useMemo(
    () => activePlanCodes.find(
      (/** @type {string} */ code) => /^fc_team_\d+_(?:monthly|yearly)$/.test(String(code || '').trim()),
    ) || '',
    [activePlanCodes],
  );
  const activeTeamPlanSlotCount = Number(
    String(activeTeamPlanCode).match(/^fc_team_(\d+)_/)?.[1] || 0,
  );
  const activeTeamPlanBillingPeriod = String(activeTeamPlanCode).endsWith('_monthly')
    ? 'monthly'
    : 'yearly';
  const [payerSelectedSlotCount, setPayerSelectedSlotCount] = useState(0);
  const [payerBillingPeriod, setPayerBillingPeriod] = useState('yearly');
  useEffect(() => {
    if (activeTeamPlanSlotCount > 0) {
      setPayerSelectedSlotCount(activeTeamPlanSlotCount);
      setPayerBillingPeriod(activeTeamPlanBillingPeriod);
    }
  }, [activeTeamPlanBillingPeriod, activeTeamPlanSlotCount]);
  const payerTeamTierEntries = useMemo(
    () => catalogEntries
      .filter((/** @type {any} */ entry) => getCatalogEntryScopeType(entry) === 'TEAM'
        && getCatalogEntryBillingPeriod(entry) === payerBillingPeriod)
      .sort((/** @type {any} */ left, /** @type {any} */ right) => (
        Number(left?.slotCount || 0) - Number(right?.slotCount || 0)
      )),
    [catalogEntries, payerBillingPeriod],
  );
  const payerSelectedEntry = useMemo(
    () => payerTeamTierEntries.find(
      (/** @type {any} */ entry) => Number(entry?.slotCount || 0) === payerSelectedSlotCount,
    ) || null,
    [payerSelectedSlotCount, payerTeamTierEntries],
  );
  const payerCurrentEntry = useMemo(
    () => catalogEntries.find(
      (/** @type {any} */ entry) => String(entry?.planCode || '').trim() === activeTeamPlanCode,
    ) || null,
    [activeTeamPlanCode, catalogEntries],
  );
  // Palier + periode identiques au plan actif -> rien a changer.
  const isPayerSelectionCurrentPlan = payerSelectedSlotCount === activeTeamPlanSlotCount
    && payerBillingPeriod === activeTeamPlanBillingPeriod;
  const payerSelectedPriceLabel = formatSubscriptionPriceLabel(
    payerSelectedEntry?.referencePriceEurCents,
    payerBillingPeriod,
  );
  const payerPeriodWord = payerBillingPeriod === 'monthly' ? 'mensuel' : 'annuel';
  const payerTierWord = `${payerSelectedSlotCount} équipe${payerSelectedSlotCount > 1 ? 's' : ''}`;
  // CTA : nomme le changement (periode seule ou nouveau palier) + prix cible.
  const payerChangeCtaTitle = payerSelectedSlotCount === activeTeamPlanSlotCount
    ? `Passer au ${payerPeriodWord} · ${payerSelectedPriceLabel}`
    : `Passer à ${payerTierWord} · ${payerSelectedPriceLabel}`;
  const payerRenewalEntitlement = useMemo(
    () => entitlementsSummary.find(
      (/** @type {any} */ entry) => entry?.paidBy?.documentId
        && entry.paidBy.documentId === String(userData?.documentId || '')
        && entry?.subscriptionCurrentPeriodEnd,
    ) || null,
    [entitlementsSummary, userData?.documentId],
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
  const activeTrialSubscription = useMemo(
    () => getActiveTrialSubscription(subscriptionSummary),
    [subscriptionSummary],
  );
  const verificationLabel = getVerificationLabel(clubVerificationSummary);
  const activePlanLabel = planLabels[0] || 'Aucun plan payant actif';
  const coveredTeamNames = useMemo(() => (
    teamSlotSummary.coveredTeamDocumentIds
      .map((teamDocumentId) => teamOptionsById.get(String(teamDocumentId || '').trim())?.name || null)
      .filter(Boolean)
  ), [teamOptionsById, teamSlotSummary.coveredTeamDocumentIds]);

  const teamCatalogEntries = useMemo(
    () => catalogEntries.filter((entry) => getCatalogEntryScopeType(entry) === 'TEAM'),
    [catalogEntries],
  );
  const clubCatalogEntries = useMemo(
    () => catalogEntries.filter((entry) => getCatalogEntryScopeType(entry) === 'CLUB'),
    [catalogEntries],
  );
  const teamSlotCountOptions = useMemo(() => {
    const slotCounts = Array.from(new Set(
      teamCatalogEntries
        .map((entry) => Number(entry?.slotCount || 0))
        .filter((slotCount) => slotCount > 0),
    )).sort((left, right) => left - right);

    return slotCounts.length ? slotCounts : [1, 2, 3];
  }, [teamCatalogEntries]);
  const selectedTeamOfferEntry = useMemo(() => (
    teamCatalogEntries.find((entry) => (
      getCatalogEntryBillingPeriod(entry) === offerBillingPeriod
      && Number(entry?.slotCount || 0) === offerTeamSlotCount
    )) || null
  ), [offerBillingPeriod, offerTeamSlotCount, teamCatalogEntries]);
  const clubTierOptions = useMemo(() => (
    clubCatalogEntries
      .filter((entry) => getCatalogEntryBillingPeriod(entry) === offerBillingPeriod)
      .map((entry) => {
        const tier = getCatalogEntryClubTier(entry);
        const maxTeams = Number(entry?.maxTeams || 0);

        return /** @type {ClubTierOption} */ ({
          entry,
          maxTeamsLabel: maxTeams > 0 ? `Jusqu a ${maxTeams} equipes` : 'Equipes illimitees',
          priceLabel: getSubscriptionCatalogEntryMeta(entry).priceLabel,
          tier,
          tierLetter: CLUB_TIER_LETTERS[tier] || String(tier || '?'),
        });
      })
      .sort((left, right) => left.tier - right.tier)
  ), [clubCatalogEntries, offerBillingPeriod]);
  const resolvedClubTier = clubTierOptions.some((option) => option.tier === offerClubTier)
    ? offerClubTier
    : (clubTierOptions[0]?.tier || 0);
  const selectedClubOfferEntry = clubTierOptions
    .find((option) => option.tier === resolvedClubTier)?.entry || null;

  const isPopularTeamOffer = offerBillingPeriod === 'yearly' && offerTeamSlotCount === 1;
  const teamOfferMeta = selectedTeamOfferEntry
    ? getSubscriptionCatalogEntryMeta(selectedTeamOfferEntry)
    : null;
  const teamOfferMonthlyEquivalentLabel = getYearlyMonthlyEquivalentLabel(selectedTeamOfferEntry);
  const clubOfferMonthlyEquivalentLabel = getYearlyMonthlyEquivalentLabel(selectedClubOfferEntry);
  const isTeamOfferMissingTeams = teamOptions.length === 0 && teamSlotSummary.total === 0;
  const isSelectedTeamOfferActivePlan = Boolean(selectedTeamOfferEntry
    && activePlanCodes.includes(selectedTeamOfferEntry?.planCode));
  const isSelectedClubOfferActivePlan = Boolean(selectedClubOfferEntry
    && activePlanCodes.includes(selectedClubOfferEntry?.planCode));

  useEffect(() => {
    if (hasSyncedOfferSelectionRef.current) {
      return;
    }

    const activeCatalogEntry = catalogEntries
      .find((entry) => activePlanCodes.includes(entry?.planCode));
    if (!activeCatalogEntry) {
      return;
    }

    hasSyncedOfferSelectionRef.current = true;
    const activeBillingPeriod = getCatalogEntryBillingPeriod(activeCatalogEntry);
    if (activeBillingPeriod === 'monthly' || activeBillingPeriod === 'yearly') {
      setOfferBillingPeriod(activeBillingPeriod);
    }

    if (getCatalogEntryScopeType(activeCatalogEntry) === 'TEAM') {
      const activeSlotCount = Number(activeCatalogEntry?.slotCount || 0);
      if (activeSlotCount > 0) {
        setOfferTeamSlotCount(activeSlotCount);
      }
      return;
    }

    const activeClubTier = getCatalogEntryClubTier(activeCatalogEntry);
    if (activeClubTier > 0) {
      setOfferClubTier(activeClubTier);
    }
  }, [activePlanCodes, catalogEntries]);

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

  /**
   * @param {SubscriptionMutationInput} params
   * @returns {Promise<any>}
   */
  const commitSubscriptionMutation = useCallback(async (
    /** @type {SubscriptionMutationInput} */ params,
  ) => {
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

  /**
   * @param {SubscriptionCatalogEntry} catalogEntry
   * @param {'purchase' | 'change' | 'manage-team-slots'} [actionMode]
   */
  const openTeamPlanModal = useCallback((
    /** @type {SubscriptionCatalogEntry} */ catalogEntry,
    actionMode = 'purchase',
  ) => {
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

  /**
   * @param {SubscriptionCatalogEntry} catalogEntry
   */
  const handleCatalogAction = useCallback(async (
    /** @type {SubscriptionCatalogEntry} */ catalogEntry,
  ) => {
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
  const selectedTeamIds = useMemo(() => (
    Array.isArray(teamPlanModalState.selectedTeamDocumentIds)
      ? teamPlanModalState.selectedTeamDocumentIds
      : []
  ), [teamPlanModalState.selectedTeamDocumentIds]);
  const hasAtLeastOneSelectedTeam = selectedTeamIds.length > 0;
  const isSelectedTeamCountInvalid = selectedTeamIds.length > selectedTeamSlotCount;
  const isTeamSelectionConfirmDisabled = !selectedTeamPlanEntry
    || selectedTeamSlotCount <= 0
    || !hasAtLeastOneSelectedTeam
    || isSelectedTeamCountInvalid
    || !isBillingTestModeEnabled
    || subscriptionMutation.isPending;

  /**
   * @param {string} teamDocumentId
   */
  const handleToggleTeamSelection = useCallback((
    /** @type {string} */ teamDocumentId,
  ) => {
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

  /**
   * @param {SubscriptionCatalogEntry} catalogEntry
   */
  const renderOfferAction = useCallback((
    /** @type {SubscriptionCatalogEntry} */ catalogEntry,
  ) => {
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
    ApplicationStyle,
    Fonts,
    handleCatalogAction,
    isBillingTestModeEnabled,
    openTeamPlanModal,
    primarySubscriptionDocumentId,
    Spaces,
    subscriptionMutation.isPending,
  ]);

  if (!canShowSubscriptionExperience) {
    return null;
  }

  if (coveringEntitlement) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingBottom[12],
          Spaces.paddingTop[0],
        ]}
      >
        <SubscriptionCoveredHero
          coveredTeamNames={coveredByOtherTeamNames}
          coveringEntitlement={coveringEntitlement}
          navigation={navigation}
        />
      </ScreenContainer>
    );
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
        {activeTrialSubscription ? (
          <SubscriptionTrialBanner trialSubscription={activeTrialSubscription} />
        ) : null}

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

        {activeTeamPlanSlotCount > 0 ? (
          <View
            style={[
              Spaces.gap[12],
              Spaces.padding[16],
              {
                backgroundColor: 'rgba(4,31,44,0.82)',
                borderColor: 'rgba(1,179,244,0.24)',
                borderRadius: 18,
                borderWidth: 1,
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Text style={[Fonts.h5Bold, Fonts.neutral00]}>Offre Équipe</Text>
              <View
                style={{
                  backgroundColor: Colors.primary500,
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={[
                    Fonts.p4Bold,
                    Fonts.primary900,
                    { letterSpacing: 0.6, textTransform: 'uppercase' },
                  ]}
                >
                  Payée par toi
                </Text>
              </View>
              <View style={Alignments.fill} />
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {formatSubscriptionPriceLabel(
                  payerCurrentEntry?.referencePriceEurCents,
                  activeTeamPlanBillingPeriod,
                )}
              </Text>
            </View>
            {payerRenewalEntitlement?.subscriptionCurrentPeriodEnd ? (
              <View
                style={[
                  Alignments.row,
                  Alignments.justifySpaceBetween,
                  {
                    borderTopColor: 'rgba(255,255,255,0.08)',
                    borderTopWidth: 1,
                    paddingTop: 10,
                  },
                ]}
              >
                <Text style={[Fonts.p4, Fonts.neutral400]}>Renouvellement</Text>
                <Text style={[Fonts.p4Bold, Fonts.neutral100]}>
                  {formatDate(
                    new Date(payerRenewalEntitlement.subscriptionCurrentPeriodEnd),
                    'd MMMM yyyy',
                    { locale: frLocale },
                  )}
                </Text>
              </View>
            ) : null}

            <Text
              style={[
                Fonts.p4Bold,
                Fonts.neutral300,
                { letterSpacing: 1.2, textTransform: 'uppercase' },
              ]}
            >
              {`Équipes couvertes · ${teamSlotSummary.assigned}/${teamSlotSummary.total}`}
            </Text>
            {coveredTeamNames.length > 0 ? coveredTeamNames.map((teamName) => (
              <View
                key={teamName}
                style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>✓</Text>
                <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral100, { flex: 1 }]}>
                  {teamName}
                </Text>
              </View>
            )) : (
              <Text style={[Fonts.p4, Fonts.neutral400]}>
                Aucun slot attribué pour le moment.
              </Text>
            )}

            <Text
              style={[
                Fonts.p4Bold,
                Fonts.neutral300,
                { letterSpacing: 1.2, textTransform: 'uppercase' },
              ]}
            >
              Changer de palier
            </Text>
            <TierSelector
              onChange={(periodId) => setPayerBillingPeriod(String(periodId))}
              options={PAYER_BILLING_PERIOD_OPTIONS}
              value={payerBillingPeriod}
            />
            <TierSelector
              onChange={(slotCount) => setPayerSelectedSlotCount(Number(slotCount))}
              options={payerTeamTierEntries.map((/** @type {any} */ entry) => {
                const slotCount = Number(entry?.slotCount || 0);
                return {
                  id: slotCount,
                  label: `${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
                };
              })}
              value={payerSelectedSlotCount}
            />
            <Text style={[Fonts.p4, Fonts.neutral400]}>
              {isPayerSelectionCurrentPlan
                ? 'Palier actuel.'
                : `${payerSelectedPriceLabel} — appliqué immédiatement, prorata géré par le store.`}
            </Text>
            {!isPayerSelectionCurrentPlan && payerSelectedEntry ? (
              <Button
                disabled={!isBillingTestModeEnabled}
                isLoading={subscriptionMutation.isPending
                  && activeActionPlanCode === String(payerSelectedEntry?.planCode || '')}
                onPress={() => handleCatalogAction(payerSelectedEntry)}
                title={payerChangeCtaTitle}
                variant="Primary"
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

          {catalogQuery.isLoading && !catalogEntries.length ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>Chargement du catalogue abonnement...</Text>
          ) : null}

          {catalogQuery.error && !catalogEntries.length ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {getSubscriptionBillingErrorMessage(catalogQuery.error)}
            </Text>
          ) : null}

          <FreeOfferCard isCurrentPlan={subscriptionAccessLevel === 'FREE'} />

          {catalogEntries.length ? (
            <OfferBillingPeriodToggle
              billingPeriod={offerBillingPeriod}
              onChangeBillingPeriod={setOfferBillingPeriod}
            />
          ) : null}

          {teamCatalogEntries.length ? (
            <View style={[
              Spaces.gap[12],
              Spaces.padding[16],
              ApplicationStyle.borderRadius12,
              ApplicationStyle.borderWidth1,
              isPopularTeamOffer
                ? ApplicationStyle.borderColor.primary500
                : ApplicationStyle.borderColor.neutral600,
              ApplicationStyle.backgroundColor.neutral700,
              isSelectedTeamOfferActivePlan ? { borderColor: 'rgba(110, 231, 183, 0.55)' } : null,
            ]}
            >
              <View style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.gap[12],
              ]}
              >
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Équipe</Text>
                {isPopularTeamOffer ? (
                  <View style={[
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[4],
                    ApplicationStyle.borderRadius12,
                    ApplicationStyle.backgroundColor.primary500,
                  ]}
                  >
                    <Text style={[Fonts.p4Bold, Fonts.primary900]}>Populaire</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Publie et gere sans limite les equipes couvertes par tes slots Team.
              </Text>

              <OfferTeamCountStepper
                onSelectSlotCount={setOfferTeamSlotCount}
                selectedSlotCount={offerTeamSlotCount}
                slotCountOptions={teamSlotCountOptions}
              />

              {selectedTeamOfferEntry ? (
                <View style={[Spaces.gap[12]]}>
                  <View style={[Spaces.gap[4]]}>
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                      {teamOfferMeta?.priceLabel || ''}
                    </Text>
                    {teamOfferMonthlyEquivalentLabel ? (
                      <Text style={[Fonts.p4, Fonts.primary100]}>
                        {teamOfferMonthlyEquivalentLabel}
                      </Text>
                    ) : null}
                    {isPopularTeamOffer ? (
                      <Text style={[Fonts.p4, Fonts.primary100]}>≈0,33 €/joueur/mois</Text>
                    ) : null}
                  </View>

                  <OfferFeatureList featureKeys={selectedTeamOfferEntry?.featureKeys} />

                  {isTeamOfferMissingTeams ? (
                    <Text style={[Fonts.p4, Fonts.neutral200]}>
                      Ajoute ou rattache d abord une equipe pour activer utilement une offre Team.
                    </Text>
                  ) : null}

                  <View style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.gap[12],
                    { flexWrap: 'wrap' },
                  ]}
                  >
                    {renderOfferAction(selectedTeamOfferEntry)}
                  </View>
                </View>
              ) : (
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Aucune offre Equipe disponible pour cette combinaison.
                </Text>
              )}
            </View>
          ) : null}

          {clubCatalogEntries.length ? (
            <View style={[
              Spaces.gap[12],
              Spaces.padding[16],
              ApplicationStyle.borderRadius12,
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral600,
              ApplicationStyle.backgroundColor.neutral700,
              isSelectedClubOfferActivePlan ? { borderColor: 'rgba(110, 231, 183, 0.55)' } : null,
            ]}
            >
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Club</Text>
                <Text style={[Fonts.p4Bold, Fonts.primary100]}>Pour les dirigeants</Text>
              </View>

              {clubTierOptions.length ? (
                <View style={[Spaces.gap[8]]}>
                  {clubTierOptions.map((tierOption) => (
                    <ClubTierOptionRow
                      isSelected={tierOption.tier === resolvedClubTier}
                      key={tierOption.entry?.planCode || String(tierOption.tier)}
                      onSelect={() => setOfferClubTier(tierOption.tier)}
                      tierOption={tierOption}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  Aucune offre Club disponible pour cette periode.
                </Text>
              )}

              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Toutes vos equipes incluses + gestion complete du club.
              </Text>

              {selectedClubOfferEntry ? (
                <View style={[Spaces.gap[12]]}>
                  {clubOfferMonthlyEquivalentLabel ? (
                    <Text style={[Fonts.p4, Fonts.primary100]}>
                      {clubOfferMonthlyEquivalentLabel}
                    </Text>
                  ) : null}

                  <OfferFeatureList featureKeys={selectedClubOfferEntry?.featureKeys} />

                  {selectedClubOfferEntry?.requiresClubVerification ? (
                    <Text style={[Fonts.p4, Fonts.neutral200]}>
                      Verification dirigeant obligatoire avant ouverture des droits Club sensibles.
                    </Text>
                  ) : null}

                  <View style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.gap[12],
                    { flexWrap: 'wrap' },
                  ]}
                  >
                    {renderOfferAction(selectedClubOfferEntry)}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
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
          <LegalFooter restore={false} />
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
              disabled={isTeamSelectionConfirmDisabled}
              isLoading={subscriptionMutation.isPending}
              onPress={handleConfirmTeamPlan}
              title={primarySubscriptionDocumentId ? 'Confirmer le changement' : 'Activer cette offre Team'}
              variant="PrimaryLight"
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
