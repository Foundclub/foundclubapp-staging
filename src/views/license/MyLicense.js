// @ts-nocheck
/* eslint-disable import/order, perfectionist/sort-imports, perfectionist/sort-named-imports */
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  createLicenseCheckout,
  declareExternalLicensePayment,
  generateLicenseReceipt,
  submitLicenseDocument,
  useLicenseMutation,
  useMyLicenseAssignment,
  useMyLicenses,
} from '@/services/license/licenseQueries';

import {
  buildPublicWebUrl,
} from '@/utils/shareLinks';
import {
  formatLicenseMoney,
  getEnabledManualPaymentMethods,
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
import MediaPlatform from '@/platform/media';
import SharePlatform from '@/platform/share';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const paymentDate = (payment = {}) => String(payment.validatedAt || payment.paidAt || payment.createdAt || '').slice(0, 10);
const documentDate = (submission = {}) => String(submission.validatedAt || submission.submittedAt || submission.createdAt || '').slice(0, 10);
const isPickerCancelError = (error) => String(error?.code || error?.message || '')
  .toLowerCase()
  .includes('cancel');

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
        <Text style={[Fonts.p2, Fonts.neutral200]}>Choisis le moyen utilise pour prevenir le club.</Text>
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
 * @param root0.navigation
 * @param root0.route
 */
function MyLicense({ navigation, route }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [declareModalVisible, setDeclareModalVisible] = useState(false);
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
  const declareMutation = useLicenseMutation((method) => declareExternalLicensePayment(assignmentId, { amountCents: current?.amountRemainingCents, method }), current?.campaign?.documentId || current?.campaign?.id);
  const documentMutation = useLicenseMutation((payload) => submitLicenseDocument(assignmentId, payload), current?.campaign?.documentId || current?.campaign?.id);
  const receiptMutation = useLicenseMutation((paymentId) => generateLicenseReceipt(paymentId), current?.campaign?.documentId || current?.campaign?.id);
  const paymentModes = normalizePaymentModes(current?.campaign?.paymentModes);
  const offlinePaymentMethods = useMemo(() => getEnabledManualPaymentMethods(current?.campaign?.paymentModes), [current?.campaign?.paymentModes]);
  const documentSubmissionByRequestId = useMemo(() => new Map(
    (current?.documentSubmissions || [])
      .map((submission) => [
        String(submission?.documentRequest?.documentId || submission?.documentRequest?.id || ''),
        submission,
      ])
      .filter(([key]) => key),
  ), [current?.documentSubmissions]);
  const receipts = current?.receipts || [];
  const paymentHistory = (current?.payments || []).slice(0, 8);
  const officialLicenseDocument = current?.officialLicenseDocument || null;
  const isCampaignPaused = current?.campaign?.status === 'paused';
  const canDeclareOfflinePayment = offlinePaymentMethods.length > 0
    && Number(current?.amountRemainingCents || 0) > 0
    && !isCampaignPaused
    && !['cancelled', 'paid', 'waived'].includes(current?.status);
  const payerLink = useMemo(() => {
    if (!current?.securePaymentToken) return null;
    return buildPublicWebUrl({
      path: `/licenses/pay/${current.securePaymentToken}`,
    });
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
    if (isCampaignPaused) {
      Alert.alert('Campagne en pause', 'Cette campagne est temporairement suspendue. Le paiement reprendra quand le club la rouvrira.');
      return;
    }
    checkoutMutation.mutate(provider, {
      onError: (error) => Alert.alert('Paiement indisponible', error?.message || 'Aucun lien de paiement configure.'),
      onSuccess: async (result) => {
        if (result?.checkoutUrl) {
          await LinksPlatform.openUrl(result.checkoutUrl);
          navigation.navigate(RouteNames.LicenseCheckoutStatus, {
            assignmentId,
            paymentId: result?.payment?.documentId || result?.payment?.id,
            provider,
          });
        }
      },
    });
  }, [assignmentId, checkoutMutation, isCampaignPaused, navigation]);

  const sharePayerLink = useCallback(() => {
    if (!payerLink) {
      Alert.alert('Lien indisponible', 'Le lien de paiement externe sera disponible après génération par le club.');
      return;
    }
    SharePlatform.share({
      message: `Paiement cotisation FoundClub: ${payerLink}`,
      url: payerLink,
    }).catch((error) => {
      Alert.alert('Partage indisponible', error?.message || 'Impossible de partager le lien depuis ce navigateur.');
    });
  }, [payerLink]);

  const declareOfflinePayment = useCallback((method) => {
    declareMutation.mutate(method, {
      onSuccess: () => {
        setDeclareModalVisible(false);
        query.refetch();
        if (routeAssignmentId) assignmentQuery.refetch();
        Alert.alert('Déclaration envoyée', 'Le club devra valider ce paiement.');
      },
    });
  }, [assignmentQuery, declareMutation, query, routeAssignmentId]);

  const refreshCurrent = useCallback(() => {
    query.refetch();
    if (routeAssignmentId) assignmentQuery.refetch();
  }, [assignmentQuery, query, routeAssignmentId]);

  const uploadDocument = useCallback(async (request) => {
    if (!assignmentId) return;
    try {
      const picked = await MediaPlatform.pickDocument({ accept: '*/*', mode: 'open', type: ['*/*'] });
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (!file) return;
      documentMutation.mutate({
        documentRequestId: request?.id || request?.documentId,
        file,
      }, {
        onSuccess: () => {
          refreshCurrent();
          Alert.alert('Document envoyé', 'Le club pourra maintenant vérifier cette pièce.');
        },
      });
    } catch (error) {
      if (isPickerCancelError(error)) return;
      Alert.alert('Upload impossible', error?.message || 'Le document n a pas pu être envoyé.');
    }
  }, [assignmentId, documentMutation, refreshCurrent]);

  const openUploadedDocument = useCallback(async (submission) => {
    const url = resolveMediaUrl(submission?.file?.url || submission?.file?.formats?.thumbnail?.url || '');
    if (!url) {
      Alert.alert('Document indisponible', 'Aucun fichier exploitable n est rattaché à ce dépôt.');
      return;
    }
    await LinksPlatform.openUrl(url);
  }, []);

  const generateReceiptForPayment = useCallback((paymentId) => {
    receiptMutation.mutate(paymentId, {
      onSuccess: () => {
        refreshCurrent();
        Alert.alert('Reçu génère', 'Le reçu est maintenant disponible dans ta cotisation.');
      },
    });
  }, [receiptMutation, refreshCurrent]);

  if (query.isLoading || assignmentQuery.isLoading) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <LicenseEmptyState
          description="On récupère tes cotisations disponibles."
          title="Chargement"
        />
      </ScreenContainer>
    );
  }

  if (query.isError || assignmentQuery.isError) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <LicenseEmptyState
          action={<Button onPress={() => { query.refetch(); if (routeAssignmentId) assignmentQuery.refetch(); }} title="Réessayer" variant="Secondary" />}
          description="Impossible de charger ta cotisation pour le moment."
          title="Cotisation indisponible"
        />
      </ScreenContainer>
    );
  }

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
        <LicenseSectionHeader title="Campagne" />
        <LicenseCard variant="muted">
          <View style={Spaces.gap[licenseSpacing.actionGap]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{current?.campaign?.name || 'Cotisation FoundClub'}</Text>
            {current?.campaign?.description ? <Text style={[Fonts.p2, Fonts.neutral200]}>{current.campaign.description}</Text> : null}
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Date limite:
              {' '}
              {current?.dueDate || current?.campaign?.dueDate || 'Non définie'}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Club:
              {' '}
              {current?.club?.name || current?.campaign?.club?.name || 'Non précisé'}
            </Text>
          </View>
        </LicenseCard>
        <LicenseSectionHeader title="Echeancier" />
        <LicenseInstallmentList currency={currency} installments={current.installments || []} />
        {isCampaignPaused ? (
          <LicenseCard variant="muted">
            <View style={Spaces.gap[licenseSpacing.actionGap]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Campagne temporairement suspendue</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Ta cotisation reste visible, mais le club a mis cette campagne en pause. Les paiements et déclarations reprendront après reouverture.
              </Text>
            </View>
          </LicenseCard>
        ) : null}
        <LicenseSectionHeader
          description="Les actions ci-dessous suivent les moyens de paiement actives par ton club."
          title="Payer ou regulariser"
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
        {!isCampaignPaused && canDeclareOfflinePayment ? <Button onPress={() => setDeclareModalVisible(true)} title="J'ai paye hors app" variant="Secondary" /> : null}
        {!isCampaignPaused ? <Button onPress={sharePayerLink} title="Partager le lien payeur" variant="Secondary" /> : null}
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
        <LicenseSectionHeader title="Ma licence" />
        <LicenseCard variant="muted">
          <View style={Spaces.gap[licenseSpacing.actionGap]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {officialLicenseDocument?.request?.name || 'Licence officielle'}
            </Text>
            {officialLicenseDocument?.file?.url ? (
              <>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {officialLicenseDocument?.uploadedAt
                    ? `Disponible depuis le ${documentDate(officialLicenseDocument.submission || {}) || '-'}`
                    : 'Document disponible'}
                </Text>
                <Button
                  onPress={() => openUploadedDocument(officialLicenseDocument.submission)}
                  title="Voir ma licence"
                  variant="Secondary"
                />
              </>
            ) : (
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Ta licence n est pas encore disponible.
              </Text>
            )}
          </View>
        </LicenseCard>
        <LicenseSectionHeader title="Documents à fournir" />
        {(current?.campaign?.documentRequests || []).length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {(current?.campaign?.documentRequests || []).map((request) => {
              const requestKey = String(request?.documentId || request?.id || '');
              const submission = documentSubmissionByRequestId.get(requestKey);
              const submissionStatus = submission?.status || 'missing';
              return (
                <LicenseCard key={requestKey || request?.name} variant="muted">
                  <View style={Spaces.gap[licenseSpacing.actionGap]}>
                    <View style={{
                      alignItems: 'flex-start',
                      flexDirection: 'row',
                      gap: licenseSpacing.actionGap,
                      justifyContent: 'space-between',
                    }}
                    >
                      <View style={[Spaces.gap[4], { flex: 1 }]}>
                        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{request?.name || 'Document'}</Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {request?.required === false ? 'Facultatif' : 'Obligatoire'}
                          {request?.dueDate ? ` - Dépôt avant ${request.dueDate}` : ''}
                        </Text>
                      </View>
                      <LicenseStatusChip status={submissionStatus} />
                    </View>
                    {request?.description ? <Text style={[Fonts.p3, Fonts.neutral200]}>{request.description}</Text> : null}
                    {submission?.refusalReason ? <Text style={[Fonts.p3, { color: '#fda4af' }]}>{submission.refusalReason}</Text> : null}
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {submission ? `Dernier dépôt ${documentDate(submission) || '-'}` : 'Aucun fichier envoyé'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                      <Button
                        isLoading={documentMutation.isPending}
                        onPress={() => uploadDocument(request)}
                        style={{ flex: 1 }}
                        title={submission ? 'Remplacer' : 'Deposer'}
                      />
                      {submission?.file?.url ? (
                        <Button
                          onPress={() => openUploadedDocument(submission)}
                          style={{ flex: 1 }}
                          title="Ouvrir"
                          variant="Secondary"
                        />
                      ) : null}
                    </View>
                  </View>
                </LicenseCard>
              );
            })}
          </View>
        ) : (
          <LicenseEmptyState
            description="Aucune pièce supplémentaire n est demandée pour cette campagne."
            title="Aucun document"
          />
        )}
        <LicenseSectionHeader title="Historique des paiements" />
        {paymentHistory.length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {paymentHistory.map((payment) => (
              <LicenseCard key={payment.documentId || payment.id} variant="muted">
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <LicenseMetricRow
                    items={[
                      { label: 'Statut', value: payment.status || '-' },
                      { label: 'Montant', value: formatLicenseMoney(payment.amountCents, payment.currency || currency) },
                      { label: 'Date', value: paymentDate(payment) || '-' },
                    ]}
                  />
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {paymentModeLabels[payment.method] || payment.method || 'Méthode non précisée'}
                    {payment?.note ? ` - ${payment.note}` : ''}
                  </Text>
                  {!payment?.receipt && ['confirmed', 'partially_refunded'].includes(payment?.status) ? (
                    <Button
                      isLoading={receiptMutation.isPending}
                      onPress={() => generateReceiptForPayment(payment.documentId || payment.id)}
                      title="Générer mon reçu"
                      variant="Secondary"
                    />
                  ) : null}
                </View>
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description="Aucun paiement n est encore rattache à ta cotisation."
            title="Pas d historique"
          />
        )}
        <LicenseSectionHeader title="Recus" />
        {receipts.length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {receipts.map((receipt) => (
              <LicenseCard key={receipt.documentId || receipt.id} variant="muted">
                <LicenseMetricRow
                  items={[
                    { label: 'Numero', value: receipt.receiptNumber || '-' },
                    { label: 'Montant', value: formatLicenseMoney(receipt.amountCents, receipt.currency || currency) },
                    { label: 'Emission', value: String(receipt.issuedAt || '').slice(0, 10) || '-' },
                  ]}
                />
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description="Les reçus apparaîtront ici après validation d un paiement."
            title="Pas encore de reçu"
          />
        )}
        <LicenseSectionHeader title="Relances" />
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {current.reminderCount || (current.reminders || []).length || 0}
          {' '}
          relance(s) recue(s).
        </Text>
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

export default MyLicense;
