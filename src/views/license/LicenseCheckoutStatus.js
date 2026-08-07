import { useMemo } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useLicensePaymentStatus } from '@/services/license/licenseQueries';

import {
  formatLicenseMoney,
  LicenseCard,
  LicenseEmptyState,
  LicenseMetricRow,
  licenseRadius,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
} from './licenseDesignSystem';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function LicenseCheckoutStatus({ navigation, route }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const provider = route?.params?.provider || 'paiement';
  const paymentId = route?.params?.paymentId;
  const paymentQuery = useLicensePaymentStatus(paymentId, {
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const status = query?.state?.data?.status;
      return ['manual_review', 'pending'].includes(status) ? 5000 : false;
    },
    refetchIntervalInBackground: false,
  });
  const payment = paymentQuery.data;
  const currency = payment?.currency || 'EUR';
  const message = useMemo(() => {
    if (!paymentId) {
      return `Le paiement ${provider} s est ouvert dans une page securisee. Si tu viens de payer, le statut sera mis à jour automatiquement ou après validation du club.`;
    }
    if (paymentQuery.isLoading) {
      return 'On vérifie le retour du paiement et la confirmation transmise au club.';
    }
    if (payment?.status === 'confirmed') {
      return 'Le paiement est confirmé. Ton reçu apparaîtra des qu il sera généré par le club ou automatiquement.';
    }
    if (payment?.status === 'manual_review') {
      return 'Le paiement est en attente de vérification par le club.';
    }
    if (payment?.status === 'pending') {
      return provider === 'helloasso'
        ? 'HelloAsso a bien été ouvert. Nous attendons maintenant la confirmation du paiement.'
        : `Le paiement ${provider} est encore en cours de vérification.`;
    }
    if (payment?.status === 'rejected' || payment?.status === 'failed') {
      return 'Le paiement n a pas abouti. Tu peux revenir à ta cotisation pour relancer un règlement.';
    }
    return `Le paiement ${provider} est encore en cours de synchronisation.`;
  }, [payment?.status, paymentId, paymentQuery.isLoading, provider]);

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={[ApplicationStyle.card, Spaces.gap[licenseSpacing.actionGap], {
          backgroundColor: Colors.primary700,
          borderColor: `${Colors.primary500}55`,
          borderRadius: licenseRadius.hero,
          paddingHorizontal: 20,
          paddingVertical: 22,
        }]}
        >
          {payment?.status ? <LicenseStatusChip status={payment.status} /> : null}
          <Text style={[Fonts.h2, Fonts.neutral00]}>Suivi du paiement</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{message}</Text>
        </View>
        {paymentQuery.isError ? (
          <LicenseEmptyState
            action={<Button onPress={paymentQuery.refetch} title="Réessayer" variant="Secondary" />}
            description="Impossible de vérifier le statut du paiement pour le moment."
            title="Statut indisponible"
          />
        ) : null}
        {payment ? (
          <>
            <LicenseSectionHeader title="État actuel" />
            <LicenseCard variant="muted">
              <LicenseMetricRow
                items={[
                  { label: 'Montant', value: formatLicenseMoney(payment.amountCents, currency) },
                  { label: 'Methode', value: provider },
                  { label: 'Statut', value: payment.status || '-' },
                ]}
              />
            </LicenseCard>
          </>
        ) : null}
        <Button onPress={() => navigation.navigate(RouteNames.MyLicense)} title="Retour à ma cotisation" />
      </View>
    </ScreenContainer>
  );
}

export default LicenseCheckoutStatus;
