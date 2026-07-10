import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  getSubscriptionCatalogEntryMeta,
} from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionRequiredPlanText,
  getSubscriptionPaywallBenefits,
  getSubscriptionPaywallContent,
  getSubscriptionRecommendedPlanCode,
  getSubscriptionRequiredPlanLabels,
  mapSubscriptionDecisionToPaywall,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';

import { RouteNames } from '@/navigation/routeNames';

import { getSubscriptionCatalog } from '@/services/subscription/subscriptionService';

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
 * @param {{
 *   close: () => void;
 *   clubDocumentId?: string | null;
 *   decision?: any;
 *   isVisible: boolean;
 *   navigation: any;
 * }} props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionPaywallSheet({
  close,
  clubDocumentId = null,
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
  const { userData } = useAuth();
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionPaywall = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';

  const paywall = useMemo(
    () => mapSubscriptionDecisionToPaywall(decision),
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

  const recommendedEntry = useMemo(() => {
    const recommendedPlanCode = getSubscriptionRecommendedPlanCode(decision);
    return getCatalogEntriesFromResponse(catalogQuery.data)
      .find((entry) => String(entry?.planCode || '').trim() === recommendedPlanCode) || null;
  }, [catalogQuery.data, decision]);

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
