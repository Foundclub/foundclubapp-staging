/* eslint-disable import/order, perfectionist/sort-imports, perfectionist/sort-named-imports */
import { useCallback, useMemo } from 'react';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  createLicenseCheckout,
  declareExternalLicensePayment,
  useLicenseMutation,
  useMyLicenseAssignment,
  useMyLicenses,
} from '@/services/license/licenseQueries';

import { getPublicApiOrigin } from '@/config/runtimeUrls';
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
  paymentInstructionFields,
  paymentModeLabels,
} from './licenseDesignSystem';
import LinksPlatform from '@/platform/links';
import SharePlatform from '@/platform/share';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function MyLicense({ navigation, route }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const query = useMyLicenses();
  const routeAssignmentId = route?.params?.assignmentId;
  const assignmentQuery = useMyLicenseAssignment(routeAssignmentId, {
    enabled: Boolean(routeAssignmentId),
  });
  const assignments = useMemo(() => query.data || [], [query.data]);
  const fallbackAssignment = useMemo(
    () => assignments.find((item) => !['cancelled', 'paid', 'waived'].includes(item.status))
      || assignments[0],
    [assignments],
  );
  const current = assignmentQuery.data || fallbackAssignment;
  const assignmentId = current?.documentId || current?.id;
  const checkoutMutation = useLicenseMutation((provider) => createLicenseCheckout(assignmentId, { provider }), current?.campaign?.documentId || current?.campaign?.id);
  const declareMutation = useLicenseMutation(() => declareExternalLicensePayment(assignmentId, { amountCents: current?.amountRemainingCents, provider: 'external' }), current?.campaign?.documentId || current?.campaign?.id);
  const paymentModes = normalizePaymentModes(current?.campaign?.paymentModes);
  const payerLink = useMemo(() => {
    if (!current?.securePaymentToken) return null;
    const configuredWebUrl = String(process.env.WEB_APP_URL || process.env.FRONTEND_URL || '').trim().replace(/\/+$/g, '');
    if (configuredWebUrl) {
      return `${configuredWebUrl}/licenses/pay/${current.securePaymentToken}`;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/licenses/pay/${current.securePaymentToken}`;
    }
    const publicOrigin = getPublicApiOrigin();
    return publicOrigin ? `${publicOrigin}/licenses/pay/${current.securePaymentToken}` : null;
  }, [current?.securePaymentToken]);
  const offlineInstructions = Object.entries(paymentInstructionFields)
    .map(([mode, field]) => ({
      label: paymentModeLabels[mode],
      mode,
      value: current?.campaign?.[field],
    }))
    .filter((item) => paymentModes[item.mode] || item.value)
    .filter((item) => item.value);

  const openCheckout = useCallback((provider) => {
    checkoutMutation.mutate(provider, {
      onError: (error) => Alert.alert('Paiement indisponible', error?.message || 'Aucun lien de paiement configure.'),
      onSuccess: async (result) => {
        if (result?.checkoutUrl) {
          await LinksPlatform.openUrl(result.checkoutUrl);
          navigation.navigate(RouteNames.LicenseCheckoutStatus, { assignmentId, provider });
        }
      },
    });
  }, [assignmentId, checkoutMutation, navigation]);

  const sharePayerLink = useCallback(() => {
    if (!payerLink) {
      Alert.alert('Lien indisponible', 'Le lien de paiement externe sera disponible apres generation par le club.');
      return;
    }
    SharePlatform.share({
      message: `Paiement cotisation FoundClub: ${payerLink}`,
      url: payerLink,
    }).catch((error) => {
      Alert.alert('Partage indisponible', error?.message || 'Impossible de partager le lien depuis ce navigateur.');
    });
  }, [payerLink]);

  if (!current) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <LicenseEmptyState
          description="Aucune cotisation n est encore disponible pour ton compte."
          title="Ma cotisation"
        />
      </ScreenContainer>
    );
  }

  const tone = getLicenseStatusTone(Colors, current.status);
  const currency = current.currency || current?.campaign?.currency || 'EUR';
  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
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
            <LicenseStatusChip status={current.status} />
            <Text style={[Fonts.h2, Fonts.neutral00]}>Ma cotisation</Text>
          </View>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
            {current?.club?.name || current?.campaign?.club?.name || 'Ton club'}
            {' '}
            -
            {' '}
            {current?.campaign?.seasonLabel}
          </Text>
        </View>
        <LicenseCard>
          <LicenseMetricRow
            items={[
              { label: 'Total', value: formatLicenseMoney(current.amountDueCents, currency) },
              { label: 'Paye', value: formatLicenseMoney(current.amountPaidCents, currency) },
              { label: 'Reste', tone, value: formatLicenseMoney(current.amountRemainingCents, currency) },
            ]}
          />
        </LicenseCard>
        <LicenseSectionHeader title="Echeancier" />
        <LicenseInstallmentList currency={currency} installments={current.installments || []} />
        <LicenseSectionHeader
          description="Les actions ci-dessous suivent les moyens de paiement actives par ton club."
          title="Payer ou regulariser"
        />
        {paymentModes.stripe ? <Button isLoading={checkoutMutation.isPending} onPress={() => openCheckout('stripe')} title="Payer en ligne" /> : null}
        {paymentModes.external_link || paymentModes.helloasso ? <Button onPress={() => openCheckout(paymentModes.helloasso ? 'helloasso' : 'external')} title="Ouvrir le lien club" variant="Secondary" /> : null}
        <Button isLoading={declareMutation.isPending} onPress={() => declareMutation.mutate(undefined, { onSuccess: () => Alert.alert('Declaration envoyee', 'Le club devra valider ce paiement.') })} title="J'ai paye hors app" variant="Secondary" />
        <Button onPress={sharePayerLink} title="Partager le lien payeur" variant="Secondary" />
        {offlineInstructions.length ? (
          <>
            <LicenseSectionHeader title="Instructions du club" />
            {offlineInstructions.map((instruction) => (
              <LicenseCard key={instruction.label} variant="muted">
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{instruction.label}</Text>
                <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[licenseSpacing.titleGap]]}>{instruction.value}</Text>
              </LicenseCard>
            ))}
          </>
        ) : null}
        <LicenseSectionHeader title="Relances" />
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {current.reminderCount || (current.reminders || []).length || 0}
          {' '}
          relance(s) recue(s).
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyLicense;
