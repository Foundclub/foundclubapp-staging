import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
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
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const provider = route?.params?.provider || t(
    'licenseCheckoutStatus.providerFallback',
    'paiement',
  );
  const paymentId = route?.params?.paymentId;
  // S9, vague S — « Retour a ma cotisation » ramene au DETAIL de la
  // cotisation qu on vient de payer. `openCheckout` passe deja
  // `assignmentId` en parametre de route ; sans lui, on retombe sur la
  // LISTE plutot que d ouvrir un detail sans identifiant.
  const assignmentId = route?.params?.assignmentId;
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
      return t(
        'licenseCheckoutStatus.messages.opened',
        'Le paiement {{provider}} s est ouvert dans une page securisee. Si tu viens de '
          + 'payer, le statut sera mis à jour automatiquement ou après validation du club.',
        { provider, ...SANS_ECHAPPEMENT },
      );
    }
    if (paymentQuery.isLoading) {
      return t(
        'licenseCheckoutStatus.messages.checking',
        'On vérifie le retour du paiement et la confirmation transmise au club.',
      );
    }
    if (payment?.status === 'confirmed') {
      return t(
        'licenseCheckoutStatus.messages.confirmed',
        'Le paiement est confirmé. Ton reçu apparaîtra des qu il sera généré par le club ou '
          + 'automatiquement.',
      );
    }
    if (payment?.status === 'manual_review') {
      return t(
        'licenseCheckoutStatus.messages.manualReview',
        'Le paiement est en attente de vérification par le club.',
      );
    }
    if (payment?.status === 'pending') {
      return provider === 'helloasso'
        ? t(
          'licenseCheckoutStatus.messages.helloassoPending',
          'HelloAsso a bien été ouvert. Nous attendons maintenant la confirmation du paiement.',
        )
        : t(
          'licenseCheckoutStatus.messages.pending',
          'Le paiement {{provider}} est encore en cours de vérification.',
          { provider, ...SANS_ECHAPPEMENT },
        );
    }
    if (payment?.status === 'rejected' || payment?.status === 'failed') {
      return t(
        'licenseCheckoutStatus.messages.failed',
        'Le paiement n a pas abouti. Tu peux revenir à ta cotisation pour relancer un règlement.',
      );
    }
    return t(
      'licenseCheckoutStatus.messages.syncing',
      'Le paiement {{provider}} est encore en cours de synchronisation.',
      { provider, ...SANS_ECHAPPEMENT },
    );
  }, [payment?.status, paymentId, paymentQuery.isLoading, provider, t]);

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
          <Text style={[Fonts.h2, Fonts.neutral00]}>
            {t('licenseCheckoutStatus.header.title', 'Suivi du paiement')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{message}</Text>
        </View>
        {paymentQuery.isError ? (
          <LicenseEmptyState
            action={(
              <Button
                onPress={paymentQuery.refetch}
                title={t(
                  'licenseCheckoutStatus.error.retry',
                  'Réessayer',
                )}
                variant="Secondary"
              />
)}
            description={t(
              'licenseCheckoutStatus.error.description',
              'Impossible de vérifier le statut du paiement pour le moment.',
            )}
            title={t('licenseCheckoutStatus.error.title', 'Statut indisponible')}
          />
        ) : null}
        {payment ? (
          <>
            <LicenseSectionHeader title={t('licenseCheckoutStatus.details.title', 'État actuel')} />
            <LicenseCard variant="muted">
              <LicenseMetricRow
                items={[
                  {
                    label: t(
                      'licenseCheckoutStatus.details.amount',
                      'Montant',
                    ),
                    value: formatLicenseMoney(payment.amountCents, currency),
                  },
                  { label: t('licenseCheckoutStatus.details.method', 'Methode'), value: provider },
                  {
                    label: t(
                      'licenseCheckoutStatus.details.status',
                      'Statut',
                    ),
                    value: payment.status || '-',
                  },
                ]}
              />
            </LicenseCard>
          </>
        ) : null}
        <Button
          onPress={() => (assignmentId
            ? navigation.navigate(RouteNames.MyLicense, { assignmentId })
            : navigation.navigate(RouteNames.MyLicenses))}
          title={t('licenseCheckoutStatus.backToFee', 'Retour à ma cotisation')}
        />
      </View>
    </ScreenContainer>
  );
}

export default LicenseCheckoutStatus;
