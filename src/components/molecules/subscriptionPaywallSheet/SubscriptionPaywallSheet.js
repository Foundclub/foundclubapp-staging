import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  formatSubscriptionRequiredPlanText,
  getSubscriptionPaywallContent,
  getSubscriptionRequiredPlanLabels,
  mapSubscriptionDecisionToPaywall,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { RouteNames } from '@/navigation/routeNames';

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
        </View>
      </View>
    </BottomModal>
  );
}

export default SubscriptionPaywallSheet;
