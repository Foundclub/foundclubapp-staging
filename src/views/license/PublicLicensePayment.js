/* eslint-disable import/order, perfectionist/sort-imports */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  createPublicLicenseCheckout,
  declarePublicExternalLicensePayment,
  getPublicLicensePayment,
} from '@/services/license/licenseService';
import {
  formatLicenseMoney,
  getEnabledManualPaymentMethods,
  getLicenseStatusTone,
  LicenseCard,
  LicenseEmptyState,
  LicenseInstallmentList,
  LicenseMetricRow,
  licenseRadius,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
  normalizePaymentModes,
  paymentInstructionFields,
  paymentModeLabels,
} from './licenseDesignSystem';
import LinksPlatform from '@/platform/links';

/**
 *
 * @param root0
 * @param root0.isLoading
 * @param root0.methods
 * @param root0.onClose
 * @param root0.onSelect
 */
function DeclarePaymentModal({
  isLoading, methods, onClose, onSelect,
}) {
  const { Fonts, Spaces } = useTheme();

  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      scrollable={false}
      snapPoints={['58%']}
      webPresentation="dialog"
    >
      <View style={Spaces.gap[licenseSpacing.fieldGap]}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>Paiement hors app</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>Choisissez le moyen utilise pour prevenir le club.</Text>
        {methods.map((method) => (
          <Button
            isLoading={isLoading}
            key={method.mode}
            onPress={() => onSelect(method.mode)}
            title={method.label}
            variant="Secondary"
          />
        ))}
      </View>
    </BottomModal>
  );
}

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
  const [declareModalVisible, setDeclareModalVisible] = useState(false);
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
    mutationFn: (method) => declarePublicExternalLicensePayment(token, {
      amountCents: query.data?.remainingCents,
      method,
    }),
  });

  const payment = query.data;
  const paymentModes = normalizePaymentModes(payment?.paymentModes);
  const offlinePaymentMethods = useMemo(() => getEnabledManualPaymentMethods(payment?.paymentModes), [payment?.paymentModes]);
  const offlineInstructions = Object.entries(paymentInstructionFields)
    .map(([mode, field]) => ({
      label: paymentModeLabels[mode],
      mode,
      value: payment?.[field],
    }))
    .filter((item) => paymentModes[item.mode] || item.value)
    .filter((item) => item.value);
  const isCampaignPaused = payment?.campaignStatus === 'paused';
  const canDeclareOfflinePayment = offlinePaymentMethods.length > 0
    && Number(payment?.remainingCents || 0) > 0
    && !isCampaignPaused
    && !['cancelled', 'paid', 'waived'].includes(payment?.status);
  const tone = getLicenseStatusTone(Colors, payment?.status);
  const currency = payment?.currency || 'EUR';

  const openCheckout = useCallback((provider) => {
    if (isCampaignPaused) {
      Alert.alert('Campagne en pause', 'Cette campagne est temporairement suspendue. Le paiement reprendra quand le club la rouvrira.');
      return;
    }
    checkoutMutation.mutate(provider, {
      onError: (error) => Alert.alert('Paiement indisponible', error?.message || 'Aucun lien de paiement configure.'),
      onSuccess: async (result) => {
        if (result?.checkoutUrl) {
          await LinksPlatform.openUrl(result.checkoutUrl);
        }
      },
    });
  }, [checkoutMutation, isCampaignPaused]);

  const declareOfflinePayment = useCallback((method) => {
    declareMutation.mutate(method, {
      onSuccess: () => {
        setDeclareModalVisible(false);
        query.refetch();
        Alert.alert('Declaration envoyee', 'Le club devra valider ce paiement.');
      },
    });
  }, [declareMutation, query]);

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

  if (query.isError) {
    return (
      <ScreenContainer bottomInsetMode="screen" withHeaderPadding>
        <LicenseEmptyState
          action={<Button onPress={query.refetch} title="Reessayer" variant="Secondary" />}
          description="Impossible de charger ce lien de paiement pour le moment."
          title="Paiement indisponible"
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
        <LicenseSectionHeader title="Campagne" />
        <LicenseCard variant="muted">
          <View style={Spaces.gap[licenseSpacing.actionGap]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{payment?.seasonLabel || 'Cotisation en cours'}</Text>
            {payment?.description ? <Text style={[Fonts.p2, Fonts.neutral200]}>{payment.description}</Text> : null}
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Date limite:
              {' '}
              {payment?.dueDate || 'Non definie'}
            </Text>
            {payment?.teamName ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Equipe:
                {' '}
                {payment.teamName}
              </Text>
            ) : null}
          </View>
        </LicenseCard>
        <LicenseSectionHeader title="Echeancier" />
        <LicenseInstallmentList currency={currency} installments={payment?.installments || []} />
        {isCampaignPaused ? (
          <LicenseCard variant="muted">
            <View style={Spaces.gap[licenseSpacing.actionGap]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Campagne temporairement suspendue</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Le dossier reste consultable, mais les paiements et declarations sont bloques tant que le club n a pas repris cette campagne.
              </Text>
            </View>
          </LicenseCard>
        ) : null}
        <LicenseSectionHeader
          description="Choisissez le moyen propose par le club."
          title="Regler"
        />
        {!isCampaignPaused && paymentModes.helloasso ? (
          <Button
            isLoading={checkoutMutation.isPending}
            onPress={() => openCheckout('helloasso')}
            title="Payer avec HelloAsso"
          />
        ) : null}
        {!isCampaignPaused && paymentModes.external_link ? (
          <Button
            isLoading={checkoutMutation.isPending}
            onPress={() => openCheckout('external')}
            title="Ouvrir le lien externe du club"
            variant="Secondary"
          />
        ) : null}
        {!isCampaignPaused && canDeclareOfflinePayment ? (
          <Button
            onPress={() => setDeclareModalVisible(true)}
            title="Declarer un paiement hors app"
            variant="Secondary"
          />
        ) : null}
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
        <LicenseSectionHeader title="Documents demandes" />
        {(payment?.documentRequests || []).length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {(payment?.documentRequests || []).map((request) => (
              <LicenseCard key={request.documentId || request.id || request.name} variant="muted">
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <View style={{
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                    gap: licenseSpacing.actionGap,
                    justifyContent: 'space-between',
                  }}
                  >
                    <View style={[Spaces.gap[4], { flex: 1 }]}>
                      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{request.name || 'Document'}</Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {request.required === false ? 'Facultatif' : 'Obligatoire'}
                        {request.dueDate ? ` - Depot avant ${request.dueDate}` : ''}
                      </Text>
                    </View>
                    <LicenseStatusChip status={request.status || 'missing'} />
                  </View>
                  {request.description ? <Text style={[Fonts.p3, Fonts.neutral200]}>{request.description}</Text> : null}
                </View>
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description="Aucune piece supplementaire n est associee a ce lien."
            title="Aucun document"
          />
        )}
        <LicenseSectionHeader title="Recus deja emis" />
        {(payment?.receipts || []).length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {(payment?.receipts || []).map((receipt) => (
              <LicenseCard key={receipt.documentId || receipt.id || receipt.receiptNumber} variant="muted">
                <LicenseMetricRow
                  items={[
                    { label: 'Numero', value: receipt.receiptNumber || '-' },
                    { label: 'Montant', value: formatLicenseMoney(receipt.amountCents, currency) },
                    { label: 'Statut', value: receipt.status || '-' },
                  ]}
                />
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description="Le recu apparaitra apres confirmation du paiement par le club ou le prestataire."
            title="Pas encore de recu"
          />
        )}
      </ScrollView>
      {declareModalVisible && canDeclareOfflinePayment ? (
        <DeclarePaymentModal
          isLoading={declareMutation.isPending}
          methods={offlinePaymentMethods}
          onClose={() => setDeclareModalVisible(false)}
          onSelect={declareOfflinePayment}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default PublicLicensePayment;
