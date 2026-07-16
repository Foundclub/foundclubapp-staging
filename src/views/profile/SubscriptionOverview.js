import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionSelectableTeams,
  sortSubscriptionCatalogEntries,
} from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionPlanLabel,
  getCoveredTeamCount,
  getSubscriptionQuotaItems,
  getSubscriptionStatusMeta,
  getSubscriptionTeamSlotSummary,
} from '@/domains/subscription/subscriptionDecision';
import {
  getActiveSubscriptionPurchaseRail,
  isSubscriptionPurchaseAvailable,
  performSubscriptionPlanChange,
  performSubscriptionPurchase,
  restoreAllSubscriptionPurchases,
  SUBSCRIPTION_PURCHASE_RAILS,
} from '@/domains/subscription/subscriptionPurchaseRail';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import TierSelector from '@/components/molecules/tierSelector/TierSelector';
import ScreenContainer from '@/components/templates/ScreenContainer';
import SubscriptionCoveredHero from '@/views/profile/SubscriptionCoveredHero';

import { RouteNames } from '@/navigation/routeNames';

import { getSubscriptionCatalog } from '@/services/subscription/subscriptionService';

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
 *   input: Record<string, any>;
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
  'club.multi_teams': 'Toutes les équipes du club',
  'club.profile': 'Fiche club complète',
  'club.roles': 'Rôles du club',
  composition: 'Composition d\'équipe',
  convocation: 'Convocations',
  'dues.club': 'Cotisations du club',
  'dues.team': 'Cotisations de l\'équipe',
  'events.unlimited': 'Événements illimités',
  facilities: 'Installations',
  'matches.unlimited': 'Matchs illimités',
  'recruitment.unlimited': 'Annonces illimitées',
  sponsors: 'Sponsors et partenaires',
};

/** @type {Record<string, string>} */
const TRIAL_PLAN_LABELS = {
  fc_trial_club: 'Aperçu Club (essai 30 jours)',
  fc_trial_team: 'Aperçu Équipe (essai 30 jours)',
};

/** @type {Record<number, string>} */
const CLUB_TIER_LETTERS = {
  1: 'S',
  2: 'M',
  3: 'L',
};

const FREE_PLAN_INCLUDED_LABELS = [
  '1 équipe gratuite',
  'Événements et matchs en quantité limitée',
  'Annonces de recrutement limitées',
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
    return 'Aucun club rattaché';
  }
  if (clubVerificationSummary?.clubVerified === true) {
    return 'Club vérifié';
  }
  if (clubVerificationSummary?.requiresClubVerification === true) {
    return 'Vérification dirigeant requise';
  }
  return 'Club non vérifié';
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
  String(planCode || '').trim().toLowerCase().includes('club') ? 'Club' : 'Équipe'
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
        {`Aperçu ${getTrialScopeLabel(trialSubscription?.planCode)} · J-${remainingDays}`}
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
      <Text style={[Fonts.p4Bold, Fonts.primary100]}>{'Nombre d\'équipes couvertes'}</Text>
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
            { backgroundColor: 'rgba(255,255,255,0.08)' },
          ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral200]}>Ton offre actuelle</Text>
          </View>
        ) : null}
      </View>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        Reste en gratuit avec les quotas affichés ci-dessus.
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
    Images,
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
  const isPurchaseAvailable = isSubscriptionPurchaseAvailable();
  const isTestPurchaseRail = getActiveSubscriptionPurchaseRail()
    === SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST;
  let changeOfferHelperText = 'Le paiement in-app n\'est pas encore disponible sur cette version. Cette section reste en lecture pour le moment.';
  if (isTestPurchaseRail) {
    changeOfferHelperText = 'Mode test actif : les changements d\'offre sont simulés pour la recette.';
  } else if (isPurchaseAvailable) {
    changeOfferHelperText = 'Paiement sécurisé par le store. Changement immédiat, prorata géré automatiquement.';
  }
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
  // Chip de statut DS (design 13c) : neutre / cyan / violet, jamais de couleurs Tailwind.
  const subscriptionChip = useMemo(() => {
    switch (subscriptionAccessLevel) {
      case 'CLUB':
        return {
          container: { backgroundColor: 'rgba(133,103,255,0.16)', borderColor: 'rgba(133,103,255,0.55)' },
          label: t('profile.subscription.states.club'),
          showClock: false,
          textColor: Colors.violet200,
        };
      case 'CLUB_UNVERIFIED':
        return {
          container: { backgroundColor: 'rgba(133,103,255,0.10)', borderColor: 'rgba(133,103,255,0.45)' },
          label: t('profile.subscription.states.clubUnverified'),
          showClock: true,
          textColor: Colors.violet200,
        };
      case 'TEAM':
        return {
          container: { backgroundColor: 'rgba(1,179,244,0.12)', borderColor: 'rgba(1,179,244,0.45)' },
          label: t('profile.subscription.states.team'),
          showClock: false,
          textColor: Colors.primary200,
        };
      default:
        return {
          container: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.22)' },
          label: t('profile.subscription.states.free'),
          showClock: false,
          textColor: Colors.neutral200,
        };
    }
  }, [subscriptionAccessLevel, Colors, t]);
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
  const activeTrialSubscription = useMemo(
    () => getActiveTrialSubscription(subscriptionSummary),
    [subscriptionSummary],
  );
  const verificationLabel = getVerificationLabel(clubVerificationSummary);
  const activePlanLabel = planLabels[0] || 'Aucun plan payant actif';
  const isFreeLevel = subscriptionAccessLevel === 'FREE';
  const isClubLevel = subscriptionAccessLevel === 'CLUB' || subscriptionAccessLevel === 'CLUB_UNVERIFIED';
  // Titre humain de la carte statut : le vrai nom d'offre si payant, sinon l'offre gratuite.
  const planCardTitle = isFreeLevel ? 'Offre gratuite FoundClub' : (planLabels[0] || statusMeta.label);
  // Description tutoyée par niveau (remplace la copie technique/vouvoyée du backend).
  const planCardDescription = {
    CLUB: 'Les droits Club sont actifs sur ton club vérifié : toutes tes équipes sont couvertes.',
    CLUB_UNVERIFIED: 'Ton offre Club est active. Les droits club s\'ouvrent dès la vérification du dirigeant.',
    FREE: 'Tu publies en quantité limitée. Passe à une offre payante pour lever les limites.',
    TEAM: 'Tes équipes couvertes profitent des droits Équipe, sans limite de publication.',
  }[subscriptionAccessLevel] || 'Tu utilises l\'offre gratuite FoundClub.';
  // Résumé de couverture humain (aucune tuile « 0 » : on n'affiche que ce qui a du sens).
  const coverageSummary = (() => {
    if (isFreeLevel) return '';
    if (isClubLevel) return 'Toutes les équipes de ton club sont couvertes.';
    if (coveredTeamCount > 0) {
      return `${coveredTeamCount} équipe${coveredTeamCount > 1 ? 's' : ''} couverte${coveredTeamCount > 1 ? 's' : ''} par ton offre.`;
    }
    return '';
  })();
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

  /** @param {{ action: 'change' | 'purchase'; input: Record<string, any> }} params */
  const runSubscriptionMutation = async ({ action, input }) => {
    if (action === 'change') {
      return performSubscriptionPlanChange(input);
    }
    return performSubscriptionPurchase(input);
  };

  const subscriptionMutation = useMutation({
    mutationFn: runSubscriptionMutation,
  });

  const restoreMutation = useMutation({
    mutationFn: async () => restoreAllSubscriptionPurchases(),
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
      input,
      successMessage,
    } = params;
    const actionPlanCode = String(catalogEntry?.planCode || '').trim();
    setActiveActionPlanCode(actionPlanCode);

    try {
      const result = await subscriptionMutation.mutateAsync({ action, input });
      await refreshSubscriptionContext();
      closeTeamPlanModal();

      Alert.alert(
        action === 'change' ? 'Abonnement mis a jour' : 'Abonnement active',
        result?.pendingWebhook
          ? 'Paiement confirmé par le store. Tes accès se mettent à jour automatiquement d\'ici quelques instants.'
          : (successMessage || 'Ton contexte abonnement vient d etre mis a jour.'),
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

    if (!isPurchaseAvailable) {
      Alert.alert(
        'Checkout indisponible',
        'Le paiement in-app n\'est pas disponible sur ce build. Mets l\'app à jour puis réessaie.',
      );
      return;
    }

    /** @type {Record<string, any>} */
    const input = {
      catalogEntry,
      clubDocumentId: currentClubDocumentId,
      payerUserDocumentId: String(userData?.documentId || '').trim(),
      teamDocumentIds: [],
    };
    if (hasPaidSubscription) {
      input.currentPlanCode = String(activePlanCodes[0] || '');
      input.subscriptionDocumentId = primarySubscriptionDocumentId;
    }

    await commitSubscriptionMutation({
      action,
      catalogEntry,
      input,
      successMessage: getCatalogEntryScopeType(catalogEntry) === 'CLUB'
        ? 'Ton offre Club est bien enregistree. Si ton club n est pas encore verifie, il apparaitra en CLUB_UNVERIFIED.'
        : 'Ton offre a bien ete activee.',
    });
  }, [
    activePlanCodes,
    commitSubscriptionMutation,
    currentClubDocumentId,
    isPurchaseAvailable,
    openTeamPlanModal,
    primarySubscriptionDocumentId,
    userData?.documentId,
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
    || !isPurchaseAvailable
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

    if (!isPurchaseAvailable) {
      Alert.alert(
        'Checkout indisponible',
        'Le paiement in-app n\'est pas disponible sur ce build. Mets l\'app à jour puis réessaie.',
      );
      return;
    }

    const action = primarySubscriptionDocumentId ? 'change' : 'purchase';
    /** @type {Record<string, any>} */
    const input = {
      catalogEntry: selectedTeamPlanEntry,
      payerUserDocumentId: String(userData?.documentId || '').trim(),
      teamDocumentIds: selectedTeamIds,
    };
    if (primarySubscriptionDocumentId) {
      input.currentPlanCode = String(activePlanCodes[0] || '');
      input.subscriptionDocumentId = primarySubscriptionDocumentId;
    }

    await commitSubscriptionMutation({
      action,
      catalogEntry: selectedTeamPlanEntry,
      input,
      successMessage: `Ton offre Team couvre maintenant ${selectedTeamIds.length} equipe${selectedTeamIds.length > 1 ? 's' : ''}.`,
    });
  }, [
    activePlanCodes,
    commitSubscriptionMutation,
    hasAtLeastOneSelectedTeam,
    isPurchaseAvailable,
    primarySubscriptionDocumentId,
    selectedTeamIds,
    selectedTeamPlanEntry,
    teamOptions.length,
    userData?.documentId,
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
    const isDisabled = !isPurchaseAvailable;

    if (isCurrentTeamPlan) {
      return (
        <Button
          disabled={!isPurchaseAvailable}
          isLoading={isLoading}
          onPress={() => openTeamPlanModal(catalogEntry, 'manage-team-slots')}
          title={isPurchaseAvailable ? 'Mettre à jour mes équipes' : 'Plan actif'}
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
          { backgroundColor: 'rgba(39,214,163,0.14)' },
        ]}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.success200 }]}>Plan actif</Text>
        </View>
      );
    }

    return (
      <Button
        disabled={isDisabled}
        isLoading={isLoading}
        onPress={() => handleCatalogAction(catalogEntry)}
        title={primarySubscriptionDocumentId ? 'Changer d\'offre' : 'Choisir cette offre'}
        variant="PrimaryLight"
      />
    );
  }, [
    activeActionPlanCode,
    activePlanCodes,
    ApplicationStyle,
    Colors,
    Fonts,
    handleCatalogAction,
    isPurchaseAvailable,
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

        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('profile.subscription.title', 'Mon abonnement')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            Gère ton offre, tes quotas et les équipes couvertes.
          </Text>
        </View>

        {/* Carte statut (design 13c) : chip 4 états DS, titre + description tutoyée, couverture humaine. */}
        <View style={{
          backgroundColor: 'rgba(4,31,44,0.82)',
          borderColor: 'rgba(1,179,244,0.24)',
          borderRadius: 18,
          borderWidth: 1,
          gap: 12,
          padding: 16,
        }}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <Text numberOfLines={2} style={[Fonts.h4Black, Fonts.neutral00, { flex: 1 }]}>
              {planCardTitle}
            </Text>
            <View style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                borderRadius: 999,
                borderWidth: 1,
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
              },
              subscriptionChip.container,
            ]}
            >
              {subscriptionChip.showClock ? (
                <Image
                  source={Images.clock}
                  style={{ height: 11, tintColor: subscriptionChip.textColor, width: 11 }}
                />
              ) : null}
              <Text style={{ color: subscriptionChip.textColor, fontFamily: 'Montserrat-Bold', fontSize: 11 }}>
                {subscriptionChip.label}
              </Text>
            </View>
          </View>

          <Text style={[Fonts.p2, Fonts.neutral200, { lineHeight: 20 }]}>
            {planCardDescription}
          </Text>

          {coverageSummary ? (
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.success500 }]}>✓</Text>
              <Text style={[Alignments.fill, Fonts.p2Bold, Fonts.primary100]}>
                {coverageSummary}
              </Text>
            </View>
          ) : null}

          {isClubLevel ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', height: 1 }} />
          ) : null}
          {isClubLevel ? (
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
              <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.6, textTransform: 'uppercase' }]}>
                Vérification
              </Text>
              <Text style={[Fonts.p2Bold, { color: subscriptionChip.textColor }]}>
                {verificationLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {subscriptionAccessLevel === 'CLUB_UNVERIFIED' ? (
          <View style={[
            Spaces.gap[12],
            Spaces.padding[16],
            ApplicationStyle.borderRadius12,
            { backgroundColor: 'rgba(133,103,255,0.10)', borderColor: 'rgba(133,103,255,0.45)', borderWidth: 1 },
          ]}
          >
            <Text style={[Fonts.p1Bold, { color: Colors.violet200 }]}>
              {t('profile.subscription.unverified.title', 'Vérification du club requise')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 20 }]}>
              {t(
                'profile.subscription.unverified.description',
                'Ton offre Club est déjà active, mais les droits club restent bloqués tant que la vérification du dirigeant n\'est pas terminée.',
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

        {!isFreeLevel ? (
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

            <View style={[Spaces.gap[12]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.6, textTransform: 'uppercase' }]}>
                  {t('profile.subscription.section.currentPlan', 'Plan principal')}
                </Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{activePlanLabel}</Text>
              </View>

              {planLabels.length > 1 ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.6, textTransform: 'uppercase' }]}>
                    {t('profile.subscription.section.planList', 'Autres plans actifs')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {planLabels.slice(1).join(' · ')}
                  </Text>
                </View>
              ) : null}

              {isClubLevel ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.6, textTransform: 'uppercase' }]}>
                    {t('profile.subscription.section.verification', 'État de vérification')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {verificationLabel}
                  </Text>
                </View>
              ) : null}

              {teamSlotSummary.total > 0 ? (
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.6, textTransform: 'uppercase' }]}>
                    {t('profile.subscription.section.teamSlots', 'Équipes couvertes')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {teamSlotSummary.available > 0
                      ? `${teamSlotSummary.available} place${teamSlotSummary.available > 1 ? 's' : ''} encore disponible${teamSlotSummary.available > 1 ? 's' : ''} sur ${teamSlotSummary.total}.`
                      : `Toutes tes places sont attribuées (${teamSlotSummary.total}).`}
                  </Text>
                  {coveredTeamNames.length > 0 ? (
                    <Text style={[Fonts.p4, Fonts.neutral300]}>
                      {coveredTeamNames.join(' · ')}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

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
                disabled={!isPurchaseAvailable}
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
          {quotaItems.length ? quotaItems.map((item) => {
            const remaining = Number(item.remaining) || 0;
            const total = Number(item.total) || 0;
            const isAvailable = remaining > 0;
            const ratio = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
            const gaugeLabel = t(`profile.subscription.quota.labels.${item.quotaType}`, item.label);
            const gaugeValue = isAvailable
              ? t('profile.subscription.quota.remaining', { count: remaining })
              : t('profile.subscription.quota.used');

            return (
              <View key={item.quotaType} style={{ gap: 6 }}>
                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}>
                  <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Bold', fontSize: 13.5 }}>
                    {gaugeLabel}
                  </Text>
                  <Text style={{ color: isAvailable ? Colors.primary200 : Colors.neutral400, fontSize: 12 }}>
                    {gaugeValue}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 5, overflow: 'hidden',
                }}
                >
                  <View style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 3,
                    height: 5,
                    width: `${isAvailable ? ratio * 100 : 0}%`,
                  }}
                  />
                </View>
              </View>
            );
          }) : (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'profile.subscription.section.freeQuotasEmpty',
                'Aucun compteur gratuit n\'est affiché pour cette offre.',
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
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{'Changer d\'offre'}</Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {changeOfferHelperText}
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
                Publie et gère sans limite les équipes couvertes par ton offre.
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
                      {'Ajoute ou rattache d\'abord une équipe pour activer utilement une offre Équipe.'}
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
                  Aucune offre Équipe disponible pour cette combinaison.
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
                  Aucune offre Club disponible pour cette période.
                </Text>
              )}

              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Toutes tes équipes incluses + gestion complète du club.
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
                      {'Vérification du dirigeant obligatoire avant l\'ouverture des droits Club sensibles.'}
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
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Restaurer mes achats</Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Retrouve les abonnements déjà enregistrés sur ton compte.
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
              {t('profile.subscription.section.clubCta', 'Voir le club concerné')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'profile.subscription.section.clubCtaDescription',
                'Retrouve les écrans du club, les demandes et l\'état de vérification.',
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
                ? 'Mettre à jour mes équipes couvertes'
                : 'Choisir les équipes couvertes'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {selectedTeamPlanEntry
                ? `Cette offre couvre jusqu'à ${selectedTeamSlotCount} équipe${selectedTeamSlotCount > 1 ? 's' : ''}.`
                : ''}
            </Text>
          </View>

          {!isPurchaseAvailable ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {'Le paiement in-app n\'est pas encore disponible sur cette version.'}
            </Text>
          ) : null}

          {teamOptions.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {'Aucune équipe exploitable n\'a été trouvée sur ce compte pour une offre Équipe.'}
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
                        {team?.name || 'Équipe sans nom'}
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
            <Text style={[Fonts.p4, { color: Colors.error300 }]}>
              {'Trop d\'équipes sélectionnées pour cette formule.'}
            </Text>
          ) : null}

          {selectedTeamPlanEntry ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {`${selectedTeamIds.length} / ${selectedTeamSlotCount} place${selectedTeamSlotCount > 1 ? 's' : ''} utilisée${selectedTeamIds.length > 1 ? 's' : ''}`}
            </Text>
          ) : null}

          <View style={[Spaces.gap[8]]}>
            <Button
              disabled={isTeamSelectionConfirmDisabled}
              isLoading={subscriptionMutation.isPending}
              onPress={handleConfirmTeamPlan}
              title={primarySubscriptionDocumentId ? 'Confirmer le changement' : 'Activer cette offre'}
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
