/* eslint-disable import/order, perfectionist/sort-imports, perfectionist/sort-named-imports */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  createPublicLicenseCheckout,
  declarePublicExternalLicensePayment,
  getPublicLicensePayment,
} from '@/services/license/licenseService';

import {
  formatLicenseMoney,
  getLicenseStatusTone,
  LicenseCard,
  LicenseEmptyState,
  LicenseInstallmentList,
  LicenseMetricRow,
  LicenseSectionHeader,
  licenseRadius,
  licenseSpacing,
  LicenseStatusChip,
  normalizePaymentModes,
} from './licenseDesignSystem';
import LinksPlatform from '@/platform/links';

/**
 *
 * @param root0
 * @param root0.route
 */
function PublicLicensePayment({ route }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const token = route?.params?.token;
  const query = useQuery({
    enabled: Boolean(token),
    queryFn: () => getPublicLicensePayment(token),
    queryKey: ['licenses', 'public-payment', token],
    staleTime: 20_000,
  });
  const checkoutMutation = useMutation({
    mutationFn: (provider) => createPublicLicenseCheckout(token, { provider }),
  });
  const declareMutation = useMutation({
    mutationFn: () => declarePublicExternalLicensePayment(token, {
      amountCents: query.data?.remainingCents,
      provider: 'external',
    }),
    onSuccess: () => query.refetch(),
  });

  const payment = query.data;
  const paymentModes = normalizePaymentModes(payment?.paymentModes);
  const tone = getLicenseStatusTone(Colors, payment?.status);
  const currency = payment?.currency || 'EUR';

  const openCheckout = useCallback((provider) => {
    checkoutMutation.mutate(provider, {
      onError: (error) => Alert.alert('Paiement indisponible', error?.message || 'Aucun lien de paiement configure.'),
      onSuccess: async (result) => {
        if (result?.checkoutUrl) {
          await LinksPlatform.openUrl(result.checkoutUrl);
        }
      },
    });
  }, [checkoutMutation]);

  if (!token) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          description="Le lien de paiement est incomplet."
          title="Lien invalide"
        />
      </ScreenContainer>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          description="On recupere les informations de paiement."
          title="Chargement"
        />
      </ScreenContainer>
    );
  }

  if (!payment && !query.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          description="Ce lien est introuvable ou n est plus disponible."
          title="Paiement indisponible"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View style={[ApplicationStyle.card, {
          backgroundColor: Colors.primary700,
          borderColor: `${tone}99`,
          borderRadius: licenseRadius.hero,
          paddingHorizontal: licenseSpacing.heroPadding,
          paddingVertical: licenseSpacing.heroPadding,
        }]}
        >
          <View style={Spaces.gap[licenseSpacing.titleGap]}>
            <LicenseStatusChip status={payment?.status} />
            <Text style={[Fonts.h2, Fonts.neutral00]}>Paiement cotisation</Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {payment?.memberName || 'Membre'}
              {' '}
              -
              {' '}
              {payment?.clubName || 'Club'}
            </Text>
          </View>
        </View>
        <LicenseCard>
          <LicenseMetricRow
            items={[
              { label: 'Total', value: formatLicenseMoney(payment?.totalDueCents, currency) },
              { label: 'Paye', value: formatLicenseMoney(payment?.totalPaidCents, currency) },
              { label: 'Reste', tone, value: formatLicenseMoney(payment?.remainingCents, currency) },
            ]}
          />
        </LicenseCard>
        <LicenseSectionHeader title="Echeancier" />
        <LicenseInstallmentList currency={currency} installments={payment?.installments || []} />
        <LicenseSectionHeader
          description="Choisissez le moyen propose par le club."
          title="Regler"
        />
        {paymentModes.stripe ? <Button isLoading={checkoutMutation.isPending} onPress={() => openCheckout('stripe')} title="Payer en ligne" /> : null}
        {paymentModes.helloasso || paymentModes.external_link ? <Button isLoading={checkoutMutation.isPending} onPress={() => openCheckout(paymentModes.helloasso ? 'helloasso' : 'external')} title="Ouvrir le lien club" variant="Secondary" /> : null}
        <Button
          isLoading={declareMutation.isPending}
          onPress={() => declareMutation.mutate(undefined, {
            onSuccess: () => Alert.alert('Declaration envoyee', 'Le club devra valider ce paiement.'),
          })}
          title="Declarer un paiement hors app"
          variant="Secondary"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

export default PublicLicensePayment;
