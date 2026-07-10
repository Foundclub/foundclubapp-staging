import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  buildSubscriptionPurchasePayload,
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionTestProvider,
  isSubscriptionBillingTestModeEnabled,
} from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionRequiredPlanText,
  getSubscriptionPaywallBenefits,
  getSubscriptionPaywallContent,
  getSubscriptionQuotaSheetContent,
  getSubscriptionRecommendedPlanCode,
  getSubscriptionRequiredPlanLabels,
  getSubscriptionTeamSlotSummary,
  mapSubscriptionDecisionToPaywall,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import TierSelector from '@/components/molecules/tierSelector/TierSelector';

import { RouteNames } from '@/navigation/routeNames';

import {
  getSubscriptionCatalog,
  validateSubscriptionPurchase,
} from '@/services/subscription/subscriptionService';

import { APP_RUNTIME_ENV } from '@/constants/runtimeFlags';

/**
 * @param {any} payload
 * @returns {any[]}
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
 * Paliers Équipe annuels du catalogue, tries par nombre d'equipes couvertes.
 * @param {any[]} entries
 * @returns {any[]}
 */
const getTeamYearlyEntries = (entries) => entries
  .filter((entry) => String(entry?.scopeType || '').trim().toUpperCase() === 'TEAM'
    && String(entry?.billingPeriod || '').trim().toLowerCase() === 'yearly')
  .sort((left, right) => Number(left?.slotCount || 0) - Number(right?.slotCount || 0));

/**
 * Sheet de quota v2 (handoff, decision 1) : une seule ancre prix, segments de
 * palier sans prix, CTA qui nomme la selection, achat direct dans la sheet.
 * Non bloquante : fermer = retour au wizard, brouillon conserve.
 * Les paywalls non-quota (verification club, palier club…) gardent la
 * presentation legacy en bas de fichier.
 * @param {{
 *   close: () => void;
 *   clubDocumentId?: string | null;
 *   contextLabel?: string | null;
 *   decision?: any;
 *   isVisible: boolean;
 *   navigation: any;
 * }} props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionPaywallSheet({
  close,
  clubDocumentId = null,
  contextLabel = null,
  decision,
  isVisible,
  navigation,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { subscriptionSummary, userData } = useAuth();
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionPaywall = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';

  const paywall = useMemo(
    () => mapSubscriptionDecisionToPaywall(decision),
    [decision],
  );
  const quotaSheetContent = useMemo(
    () => getSubscriptionQuotaSheetContent(decision),
    [decision],
  );
  const paywallContent = useMemo(
    () => getSubscriptionPaywallContent(decision),
    [decision],
  );
  const planLabels = useMemo(
    () => getSubscriptionRequiredPlanLabels(paywall.requiredPlan),
    [paywall.requiredPlan],
  );
  const requiredPlanText = useMemo(
    () => formatSubscriptionRequiredPlanText(paywall.requiredPlan),
    [paywall.requiredPlan],
  );
  const paywallBenefits = useMemo(
    () => getSubscriptionPaywallBenefits(decision),
    [decision],
  );

  const catalogQuery = useQuery({
    enabled: Boolean(isVisible && decision && canShowSubscriptionPaywall),
    queryFn: getSubscriptionCatalog,
    queryKey: ['subscription-catalog'],
    staleTime: 1000 * 60 * 10,
  });

  const catalogEntries = useMemo(
    () => getCatalogEntriesFromResponse(catalogQuery.data),
    [catalogQuery.data],
  );
  const teamTierEntries = useMemo(
    () => getTeamYearlyEntries(catalogEntries),
    [catalogEntries],
  );
  const recommendedEntry = useMemo(() => {
    const recommendedPlanCode = getSubscriptionRecommendedPlanCode(decision);
    return catalogEntries
      .find((entry) => String(entry?.planCode || '').trim() === recommendedPlanCode) || null;
  }, [catalogEntries, decision]);

  const [selectedSlotCount, setSelectedSlotCount] = useState(0);

  // Palier preselectionne a chaque ouverture (2e equipe -> palier 2), borne au catalogue.
  useEffect(() => {
    if (!isVisible || !quotaSheetContent || teamTierEntries.length === 0) {
      return;
    }
    const availableSlotCounts = teamTierEntries.map((entry) => Number(entry?.slotCount || 0));
    const preselected = availableSlotCounts.includes(quotaSheetContent.preselectedSlotCount)
      ? quotaSheetContent.preselectedSlotCount
      : availableSlotCounts[0];
    setSelectedSlotCount(preselected);
  }, [isVisible, quotaSheetContent, teamTierEntries]);

  const selectedEntry = useMemo(
    () => teamTierEntries
      .find((entry) => Number(entry?.slotCount || 0) === selectedSlotCount) || null,
    [selectedSlotCount, teamTierEntries],
  );

  const purchaseMutation = useMutation({
    mutationFn: async (/** @type {Record<string, any>} */ payload) => (
      validateSubscriptionPurchase(payload)
    ),
  });

  if (!isVisible || !decision) {
    return null;
  }

  if (!canShowSubscriptionPaywall) {
    return (
      <BottomModal
        close={close}
        isVisible={isVisible}
        scrollable={false}
      >
        <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[16]]}>
          <View style={Spaces.gap[8]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('profile.subscription.unavailable.title', 'Action indisponible')}
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral300]}>
              {t(
                'profile.subscription.unavailable.description',
                "Cette action n'est pas disponible pour ce profil.",
              )}
            </Text>
          </View>

          <Button
            onPress={close}
            title={t('common.close', 'Fermer')}
            variant="Primary"
          />
        </View>
      </BottomModal>
    );
  }

  const handleOpenSubscription = () => {
    close();
    navigation.navigate(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  };

  const handleOpenClub = () => {
    close();
    if (!clubDocumentId) {
      handleOpenSubscription();
      return;
    }

    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: clubDocumentId },
      screen: RouteNames.Club,
    });
  };

  const handleCompareOffers = () => {
    close();
    navigation.navigate(RouteNames.GuideOffersRecap);
  };

  // Achat direct dans la sheet. Aujourd'hui : mode test backend (trustedValidation) —
  // Purchases.purchase (RevenueCat) se branchera ici a l'item 14 du plan.
  const handlePurchase = async () => {
    if (!selectedEntry || purchaseMutation.isPending) {
      return;
    }

    if (!isSubscriptionBillingTestModeEnabled(APP_RUNTIME_ENV)) {
      Alert.alert(
        'Checkout indisponible',
        'Le checkout store réel sera branché dans une prochaine vague. Utilise le mode test local ou staging pour la recette complète.',
      );
      return;
    }

    const slotCount = Number(selectedEntry?.slotCount || 0);
    const availableTeams = (userData?.myTeams || []).concat(userData?.trainedTeams || []);
    const payload = buildSubscriptionPurchasePayload({
      catalogEntry: selectedEntry,
      provider: getSubscriptionTestProvider(Platform.OS),
      teamDocumentIds: getInitialTeamSelection({
        availableTeams,
        coveredTeamDocumentIds: getSubscriptionTeamSlotSummary(subscriptionSummary)
          .coveredTeamDocumentIds,
        slotCount,
      }),
      trustedValidation: true,
    });

    try {
      await purchaseMutation.mutateAsync(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] }),
        queryClient.invalidateQueries({ queryKey: ['get-me'] }),
      ]);
      close();
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      navigation.navigate(RouteNames.SubscriptionSuccess, {
        offerLabel: `Équipe · ${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
        renewalDateLabel: format(renewalDate, 'd MMMM yyyy', { locale: fr }),
        resumeCtaLabel: quotaSheetContent?.successCtaLabel || 'Reprendre',
      });
    } catch (error) {
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
    }
  };

  /* ---------- Sheet de quota v2 (equipe / evenement / match / annonce) ---------- */
  if (quotaSheetContent) {
    const tierOptions = teamTierEntries.map((entry) => {
      const slotCount = Number(entry?.slotCount || 0);
      return {
        id: slotCount,
        label: `${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
      };
    });
    const selectedTierLabel = selectedSlotCount > 0
      ? `${selectedSlotCount} équipe${selectedSlotCount > 1 ? 's' : ''}`
      : '';
    const priceCents = Number(selectedEntry?.referencePriceEurCents);
    const priceAmountLabel = Number.isFinite(priceCents) && priceCents > 0
      ? `${(priceCents / 100).toFixed(2).replace('.', ',')} €`
      : '';
    const monthlyLabel = formatSubscriptionMonthlyEquivalentLabel(
      selectedEntry?.referencePriceEurCents,
    );
    const isCatalogLoading = catalogQuery.isLoading || teamTierEntries.length === 0;
    const purchasing = purchaseMutation.isPending;
    let ctaLabel = 'Chargement des tarifs…';
    if (!isCatalogLoading) {
      ctaLabel = selectedSlotCount === 1
        ? 'Débloquer mon équipe'
        : `Débloquer ${selectedTierLabel}`;
    }

    return (
      <BottomModal
        close={close}
        isVisible={isVisible}
        scrollable={false}
      >
        <View style={[Spaces.paddingTop[16], Spaces.paddingBottom[8], Spaces.gap[16]]}>
          <View style={Spaces.gap[8]}>
            <Text
              style={[
                Fonts.p4Bold,
                Fonts.primary500,
                { letterSpacing: 1.5, textTransform: 'uppercase' },
              ]}
            >
              {quotaSheetContent.kicker}
            </Text>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {quotaSheetContent.title}
            </Text>
          </View>

          {contextLabel ? (
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[8],
                {
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  borderWidth: 1,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                },
              ]}
            >
              <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                {contextLabel}
              </Text>
              <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>
                ✓ brouillon conservé
              </Text>
            </View>
          ) : null}

          {isCatalogLoading ? (
            <View style={[Spaces.gap[12]]}>
              <View
                style={[
                  ApplicationStyle.borderRadius100,
                  { backgroundColor: 'rgba(255,255,255,0.10)', height: 52 },
                ]}
              />
              <View
                style={[
                  ApplicationStyle.borderRadius12,
                  { backgroundColor: 'rgba(255,255,255,0.10)', height: 34, width: 160 },
                ]}
              />
            </View>
          ) : (
            <>
              <TierSelector
                onChange={(slotCount) => setSelectedSlotCount(Number(slotCount))}
                options={tierOptions}
                value={selectedSlotCount}
              />
              <View style={[Alignments.row, { alignItems: 'baseline' }, Spaces.gap[8]]}>
                <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
                  {priceAmountLabel}
                </Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral300]}>/an</Text>
                <View style={Alignments.fill} />
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                  {monthlyLabel}
                </Text>
              </View>
            </>
          )}

          <View style={Spaces.gap[8]}>
            {quotaSheetContent.benefits.map((benefit) => (
              <View
                key={benefit}
                style={[Alignments.row, Spaces.gap[8]]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>✓</Text>
                <Text style={[Fonts.p3, Fonts.neutral100, { flex: 1 }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          <View style={Spaces.gap[4]}>
            <Button
              disabled={isCatalogLoading}
              isLoading={purchasing}
              onPress={handlePurchase}
              title={purchasing ? 'Achat en cours…' : ctaLabel}
              variant="Primary"
            />
            <View
              style={[
                Alignments.row,
                Alignments.justifyCenter,
                Alignments.alignCenter,
                { columnGap: 22 },
              ]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleCompareOffers}
                style={Spaces.paddingVertical[12]}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  Comparer les offres
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={close}
                style={Spaces.paddingVertical[12]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral300]}>
                  Plus tard
                </Text>
              </TouchableOpacity>
            </View>
            <LegalFooter restore={false} />
          </View>
        </View>
      </BottomModal>
    );
  }

  /* ---------- Paywalls non-quota : presentation legacy ---------- */
  const recommendedEntryMeta = recommendedEntry
    ? getSubscriptionCatalogEntryMeta(recommendedEntry)
    : null;
  const recommendedPriceLabel = formatSubscriptionPriceLabel(
    recommendedEntry?.referencePriceEurCents,
    recommendedEntry?.billingPeriod,
  );
  const isRecommendedEntryYearly = String(recommendedEntry?.billingPeriod || '').trim().toLowerCase() === 'yearly';
  // Ancre prix unique : annuel + equivalence mensuelle exacte (jamais d'arrondi « ~ »).
  const monthlyEquivalentLabel = formatSubscriptionMonthlyEquivalentLabel(
    recommendedEntry?.referencePriceEurCents,
  );
  const recommendedPriceLine = isRecommendedEntryYearly && recommendedPriceLabel && monthlyEquivalentLabel
    ? `${recommendedPriceLabel} · ${monthlyEquivalentLabel}`
    : recommendedPriceLabel;

  const isClubVerificationGate = paywall.reason === 'CLUB_VERIFICATION_REQUIRED';
  const primaryActionLabel = isClubVerificationGate && clubDocumentId
    ? paywallContent.ctaLabel
    : t('profile.subscription.actions.viewOverview', 'Voir mon abonnement');

  return (
    <BottomModal
      close={close}
      isVisible={isVisible}
      scrollable={false}
    >
      <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[16]]}>
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {paywallContent.title}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral300]}>
            {paywallContent.description}
          </Text>
        </View>

        {recommendedEntry ? (
          <View style={[
            Spaces.gap[8],
            Spaces.padding[16],
            ApplicationStyle.borderRadius12,
            ApplicationStyle.borderWidth1,
            ApplicationStyle.borderColor.primary100,
            ApplicationStyle.backgroundColor.primary700,
          ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.primary100]}>
              {t('profile.subscription.paywall.recommended', 'Offre recommandee')}
            </Text>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {recommendedEntryMeta?.label || ''}
            </Text>
            {recommendedPriceLine ? (
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {recommendedPriceLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        {paywallBenefits.length > 0 ? (
          <View style={Spaces.gap[8]}>
            {paywallBenefits.map((benefit) => (
              <View
                key={benefit}
                style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
              >
                <Text style={[Fonts.p2Bold, { color: Colors.success500 }]}>
                  ✓
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {requiredPlanText ? (
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {t('profile.subscription.paywall.requiredPlan', 'Offre requise: {{plans}}.', {
              plans: requiredPlanText,
            })}
          </Text>
        ) : null}

        {planLabels.length > 0 ? (
          <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
            {planLabels.map((planLabel) => (
              <View
                key={planLabel}
                style={{
                  backgroundColor: Colors.primary200,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {planLabel}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {paywall.remainingFreeUses !== null ? (
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {t('profile.subscription.paywall.remaining', 'Usages gratuits restants: {{count}}.', {
              count: paywall.remainingFreeUses,
            })}
          </Text>
        ) : null}

        <View style={Spaces.gap[12]}>
          <Button
            onPress={isClubVerificationGate ? handleOpenClub : handleOpenSubscription}
            title={primaryActionLabel}
            variant="Primary"
          />
          {isClubVerificationGate && clubDocumentId ? (
            <Button
              onPress={handleOpenSubscription}
              title={t('profile.subscription.actions.viewOverview', 'Voir mon abonnement')}
              variant="Secondary"
            />
          ) : null}
          <LegalFooter />
        </View>
      </View>
    </BottomModal>
  );
}

export default SubscriptionPaywallSheet;
