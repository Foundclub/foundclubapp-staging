/* eslint-disable perfectionist/sort-imports */
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  addManualLicensePayment,
  approveExternalLicensePayment,
  generateLicenseReceipt,
  refundLicensePayment,
  rejectExternalLicensePayment,
  reviewLicenseDocument,
  sendLicenseReminder,
  unwaiveLicenseAssignment,
  updateLicenseAssignmentAmount,
  uploadOfficialLicenseDocument,
  useLicenseAssignment,
  useLicenseDashboard,
  useLicenseMutation,
  waiveLicenseAssignment,
} from '@/services/license/licenseQueries';
import LinksPlatform from '@/platform/links';
import MediaPlatform from '@/platform/media';
import { resolveMediaUrl } from '@/utils/mediaUrl';

import {
  formatLicenseMoney,
  getEnabledManualPaymentMethods,
  LicenseCard,
  LicenseEmptyState,
  LicenseInstallmentList,
  LicenseMetricRow,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
  manualPaymentMethods,
  paymentModeLabels,
} from './licenseDesignSystem';

const euroToCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);
const usefulReminderStatuses = ['pending', 'partial', 'overdue', 'manual_review'];
const paymentStatusLabels = {
  cancelled: 'Annule',
  confirmed: 'Valide',
  failed: 'Echoue',
  manual_review: 'A valider',
  partially_refunded: 'Remboursement partiel',
  pending: 'En attente',
  refunded: 'Rembourse',
  rejected: 'Rejete',
};
const paymentDate = (payment = {}) => String(payment.validatedAt || payment.paidAt || payment.createdAt || '').slice(0, 10);
const documentDate = (submission = {}) => String(submission.validatedAt || submission.submittedAt || submission.createdAt || '').slice(0, 10);
const refundableAmount = (payment = {}) => Math.max(0, Number(payment.amountCents || 0) - Number(payment.refundedAmountCents || 0));
const resolveCanManageLicenses = (scope, routeCanManageLicenses) => {
  if (scope === 'coach') return false;
  if (typeof routeCanManageLicenses === 'boolean') return routeCanManageLicenses;
  return Boolean(scope && scope !== 'coach');
};
const isPickerCancelError = (error) => String(error?.code || error?.message || '')
  .toLowerCase()
  .includes('cancel');

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.value
 */
function InfoRow({ label, value }) {
  const { Fonts, Spaces } = useTheme();
  return (
    <View style={[Spaces.gap[4], { flex: 1 }]}>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{value}</Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.onClose
 * @param root0.onSubmit
 * @param root0.title
 * @param root0.type
 * @param root0.methodOptions
 */
function ActionModal({
  methodOptions = [], onClose, onSubmit, title, type,
}) {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(methodOptions[0]?.mode || 'cash');
  const [note, setNote] = useState('');
  const needsAmount = ['amount', 'payment', 'refund'].includes(type);
  const needsMethod = type === 'payment';
  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      scrollable={false}
      snapPoints={['62%']}
      webPresentation="dialog"
    >
      <View style={Spaces.gap[16]}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>{title}</Text>
        {needsAmount ? (
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="Montant en euros"
            placeholderTextColor={Colors.neutral400}
            style={{
              borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12,
            }}
            value={amount}
          />
        ) : null}
        {needsMethod ? (
          <View style={Spaces.gap[8]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Moyen de paiement</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {methodOptions.map((option) => {
                const selected = method === option.mode;
                return (
                  <Pressable
                    key={option.mode}
                    onPress={() => setMethod(option.mode)}
                    style={{
                      backgroundColor: selected ? Colors.primary500 : Colors.primary800,
                      borderColor: selected ? Colors.primary500 : `${Colors.primary500}55`,
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={[Fonts.p3Bold, selected ? Fonts.neutral900 : Fonts.neutral200]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <TextInput
          onChangeText={setNote}
          placeholder={['document-review', 'refund', 'reject', 'waive'].includes(type) ? 'Motif obligatoire' : 'Note optionnelle'}
          placeholderTextColor={Colors.neutral400}
          style={{
            borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12,
          }}
          value={note}
        />
        <View style={[Spaces.marginTop[8], { flexDirection: 'row', gap: licenseSpacing.actionGap }]}>
          <Button onPress={onClose} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
          <Button
            onPress={() => onSubmit({
              amountCents: euroToCents(amount), method, note, reason: note,
            })}
            style={{ flex: 1 }}
            title="Valider"
          />
        </View>
      </View>
    </BottomModal>
  );
}

/**
 *
 * @param root0
 * @param root0.route
 */
function ClubLicenseMemberDetail({ route }) {
  const {
    Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const assignmentId = route?.params?.assignmentId;
  const routeCampaignId = route?.params?.campaignId;
  const routeCanManageLicenses = route?.params?.canManageLicenses;
  const routeScope = route?.params?.scope;
  const query = useLicenseAssignment(assignmentId);
  const assignment = query.data;
  const campaignId = routeCampaignId || assignment?.campaign?.documentId || assignment?.campaign?.id;
  const permissionQuery = useLicenseDashboard(campaignId, {
    enabled: Boolean(campaignId && routeCanManageLicenses === undefined && !routeScope),
  });
  const scope = routeScope || permissionQuery.data?.scope;
  const canManageLicenses = resolveCanManageLicenses(scope, routeCanManageLicenses);
  const canUseSensitiveActions = canManageLicenses && scope !== 'coach';
  const [modal, setModal] = useState(null);
  const manualPaymentMutation = useLicenseMutation((payload) => addManualLicensePayment(assignmentId, payload), campaignId);
  const approvePaymentMutation = useLicenseMutation(({ paymentId, ...payload }) => approveExternalLicensePayment(paymentId, payload), campaignId);
  const rejectPaymentMutation = useLicenseMutation(({ paymentId, ...payload }) => rejectExternalLicensePayment(paymentId, payload), campaignId);
  const receiptMutation = useLicenseMutation((paymentId) => generateLicenseReceipt(paymentId), campaignId);
  const refundMutation = useLicenseMutation(({ paymentId, ...payload }) => refundLicensePayment(paymentId, payload), campaignId);
  const reviewDocumentMutation = useLicenseMutation(({ submissionId, ...payload }) => reviewLicenseDocument(submissionId, payload), campaignId);
  const officialLicenseMutation = useLicenseMutation((payload) => uploadOfficialLicenseDocument(assignmentId, payload), campaignId);
  const amountMutation = useLicenseMutation((payload) => updateLicenseAssignmentAmount(assignmentId, payload), campaignId);
  const waiveMutation = useLicenseMutation((payload) => waiveLicenseAssignment(assignmentId, payload), campaignId);
  const reminderMutation = useLicenseMutation((payload) => sendLicenseReminder(assignmentId, payload), campaignId);
  // T03 — le miroir d « Exempter la cotisation ». Cote serveur, `waived` etait
  // une porte a sens unique : `status()` (license.ts:811) le rend tel quel avant
  // tout calcul, donc ni « Modifier le montant » ni un encaissement n en
  // sortaient. Le geste s appuie sur une action neuve, `unwaive`.
  const unwaiveMutation = useLicenseMutation((payload) => unwaiveLicenseAssignment(assignmentId, payload), campaignId);

  const memberName = [assignment?.user?.firstname, assignment?.user?.lastname].filter(Boolean).join(' ') || assignment?.user?.username || 'Membre';
  const modalType = modal?.type;
  const modalTitle = {
    amount: 'Modifier le montant',
    'document-review': modal?.reviewStatus === 'to_replace' ? 'Demander un nouveau document' : 'Revoir le document',
    payment: 'Valider un paiement',
    refund: 'Rembourser le paiement',
    reject: 'Rejeter la déclaration',
    waive: 'Exempter la cotisation',
  }[modalType];
  const pendingReviewPayments = (assignment?.payments || []).filter((payment) => payment.status === 'manual_review');
  const paymentHistory = (assignment?.payments || []).slice(0, 6);
  const receipts = assignment?.receipts || [];
  const documentRequests = assignment?.campaign?.documentRequests || [];
  const officialLicenseDocument = assignment?.officialLicenseDocument || null;
  const currency = assignment?.currency || assignment?.campaign?.currency || 'EUR';
  const documentSubmissionByRequestId = useMemo(() => new Map(
    (assignment?.documentSubmissions || [])
      .map((submission) => [
        String(submission?.documentRequest?.documentId || submission?.documentRequest?.id || ''),
        submission,
      ])
      .filter(([key]) => key),
  ), [assignment?.documentSubmissions]);
  const manualMethodOptions = useMemo(() => {
    const enabledMethods = getEnabledManualPaymentMethods(assignment?.campaign?.paymentModes);
    if (enabledMethods.length) return enabledMethods;
    return manualPaymentMethods.map((mode) => ({ label: paymentModeLabels[mode], mode }));
  }, [assignment?.campaign?.paymentModes]);
  const canSendReminder = usefulReminderStatuses.includes(assignment?.status)
    && Number(assignment?.amountRemainingCents || 0) > 0;
  const isLoading = query.isLoading || (
    Boolean(campaignId)
    && routeCanManageLicenses === undefined
    && !routeScope
    && permissionQuery.isLoading
  );
  const hasError = query.isError || permissionQuery.isError;

  const submitModal = useCallback((payload) => {
    if (!canUseSensitiveActions) return;
    const common = { onSuccess: () => { setModal(null); query.refetch(); } };
    if (modalType === 'payment') manualPaymentMutation.mutate(payload, common);
    if (modalType === 'amount') amountMutation.mutate({ amountDueCents: payload.amountCents, note: payload.note }, common);
    if (modalType === 'waive') waiveMutation.mutate({ reason: payload.reason }, common);
    if (modalType === 'reject') rejectPaymentMutation.mutate({ paymentId: modal.paymentId, reason: payload.reason }, common);
    if (modalType === 'refund') refundMutation.mutate({ amountCents: payload.amountCents, paymentId: modal.paymentId, reason: payload.reason }, common);
    if (modalType === 'document-review') {
      reviewDocumentMutation.mutate({
        paymentId: undefined,
        reason: payload.reason,
        status: modal.reviewStatus || 'to_replace',
        submissionId: modal.submissionId,
      }, common);
    }
  }, [amountMutation, canUseSensitiveActions, manualPaymentMutation, modal, modalType, query, rejectPaymentMutation, refundMutation, reviewDocumentMutation, waiveMutation]);

  const remind = useCallback(() => {
    reminderMutation.mutate({}, { onSuccess: () => Alert.alert('Relance envoyée') });
  }, [reminderMutation]);

  // T03 — REMETTRE LA COTISATION A PAYER.
  //
  // Adel, recette du 2026-08-17 : « sur les fiches joueurs, ou tu vois
  // "relancer", il faut aussi le bouton pour dire "a payer" ».
  //
  // On DEMANDE avant : annuler une exemption remet de l argent a la charge de
  // quelqu un, et la personne recoit une notification. La question nomme donc le
  // membre ET le montant — pas « confirmer ? ».
  // ⛔ Aucun message de succes avant la reponse du serveur.
  const setBackToDue = useCallback(() => {
    if (!canUseSensitiveActions) return;
    Alert.alert(
      'Remettre cette cotisation à payer ?',
      `${memberName} devra régler ${formatLicenseMoney(assignment?.amountDueCents, currency)}. `
      + 'L exemption est annulée, les relances redeviennent possibles, '
      + 'et la personne en est prévenue.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => unwaiveMutation.mutate({}, {
            onError: (error) => Alert.alert(
              'Remise à payer impossible',
              error?.message || 'Le serveur a refusé ce changement.',
            ),
            onSuccess: () => {
              query.refetch();
              Alert.alert(
                'Cotisation à payer',
                `${memberName} n est plus exempté·e : le reste à payer est rétabli `
                + 'et tu peux de nouveau relancer.',
              );
            },
          }),
          text: 'À payer',
        },
      ],
    );
  }, [
    assignment?.amountDueCents,
    canUseSensitiveActions,
    currency,
    memberName,
    query,
    unwaiveMutation,
  ]);

  const approvePayment = useCallback((paymentId) => {
    if (!canUseSensitiveActions) return;
    Alert.alert('Valider le paiement déclare', 'Confirmer que le club a bien reçu ce paiement ?', [
      { style: 'cancel', text: 'Annuler' },
      {
        onPress: () => approvePaymentMutation.mutate({ paymentId }, {
          onSuccess: () => query.refetch(),
        }),
        text: 'Valider',
      },
    ]);
  }, [approvePaymentMutation, canUseSensitiveActions, query]);

  const approveDocument = useCallback((submissionId) => {
    if (!canUseSensitiveActions) return;
    Alert.alert('Valider le document', 'Confirmer que ce document est conforme ?', [
      { style: 'cancel', text: 'Annuler' },
      {
        onPress: () => reviewDocumentMutation.mutate({ status: 'validated', submissionId }, {
          onSuccess: () => query.refetch(),
        }),
        text: 'Valider',
      },
    ]);
  }, [canUseSensitiveActions, query, reviewDocumentMutation]);

  const generateReceiptForPayment = useCallback((paymentId) => {
    receiptMutation.mutate(paymentId, {
      onSuccess: () => {
        query.refetch();
        Alert.alert('Reçu génère', 'Le reçu est maintenant rattache à ce paiement.');
      },
    });
  }, [query, receiptMutation]);

  const openUploadedDocument = useCallback(async (submission) => {
    const url = resolveMediaUrl(submission?.file?.url || submission?.file?.formats?.thumbnail?.url || '');
    if (!url) {
      Alert.alert('Document indisponible', 'Aucun fichier exploitable n est rattaché à ce dépôt.');
      return;
    }
    await LinksPlatform.openUrl(url);
  }, []);

  const submitOfficialLicenseFile = useCallback(async (picked) => {
    if (!canUseSensitiveActions || !assignmentId) return;
    const file = Array.isArray(picked) ? picked[0] : picked;
    if (!file) return;
    officialLicenseMutation.mutate({ file }, {
      onSuccess: () => {
        query.refetch();
        Alert.alert('Licence ajoutée', 'La licence officielle est maintenant disponible pour les personnes autorisées.');
      },
    });
  }, [assignmentId, canUseSensitiveActions, officialLicenseMutation, query]);

  const uploadOfficialLicense = useCallback(() => {
    if (!canUseSensitiveActions) return;
    Alert.alert(
      'Ajouter la licence',
      'Choisis une source pour importer la licence officielle.',
      [
        {
          onPress: async () => {
            try {
              await submitOfficialLicenseFile(await MediaPlatform.capturePhoto({}));
            } catch (error) {
              if (!isPickerCancelError(error)) {
                Alert.alert('Upload impossible', error?.message || 'La photo n a pas pu être prise.');
              }
            }
          },
          text: 'Prendre une photo',
        },
        {
          onPress: async () => {
            try {
              await submitOfficialLicenseFile(await MediaPlatform.pickImage({}));
            } catch (error) {
              if (!isPickerCancelError(error)) {
                Alert.alert('Upload impossible', error?.message || 'La photo n a pas pu être choisie.');
              }
            }
          },
          text: 'Choisir une image',
        },
        {
          onPress: async () => {
            try {
              await submitOfficialLicenseFile(await MediaPlatform.pickDocument({ accept: '*/*', mode: 'open', type: ['*/*'] }));
            } catch (error) {
              if (!isPickerCancelError(error)) {
                Alert.alert('Upload impossible', error?.message || 'Le fichier n a pas pu être choisi.');
              }
            }
          },
          text: 'Importer un fichier',
        },
        { style: 'cancel', text: 'Annuler' },
      ],
    );
  }, [canUseSensitiveActions, submitOfficialLicenseFile]);

  const retryData = useCallback(() => {
    query.refetch();
    if (campaignId) permissionQuery.refetch();
  }, [campaignId, permissionQuery, query]);

  if (isLoading) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          description="On récupère la cotisation et les droits associes."
          title="Chargement de la fiche"
        />
      </ScreenContainer>
    );
  }

  if (hasError) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          action={<Button onPress={retryData} title="Réessayer" variant="Secondary" />}
          description="Impossible de charger cette fiche cotisation pour le moment."
          title="Fiche indisponible"
        />
      </ScreenContainer>
    );
  }

  if (!assignment) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          description="Cette cotisation est introuvable ou n est plus accessible."
          title="Cotisation introuvable"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="none" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: Math.max(insets.bottom + 8, 12) }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[Fonts.h2, Fonts.neutral00]}>{memberName}</Text>
          <View style={[Spaces.marginTop[8], Spaces.gap[licenseSpacing.titleGap]]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>{assignment?.team?.name || 'Sans équipe'}</Text>
            <LicenseStatusChip status={assignment?.status} />
          </View>
        </View>
        <LicenseCard>
          <LicenseMetricRow
            items={[
              { label: 'Total', value: formatLicenseMoney(assignment?.amountDueCents, currency) },
              { label: 'Paye', value: formatLicenseMoney(assignment?.amountPaidCents, currency) },
              { label: 'Reste', value: formatLicenseMoney(assignment?.amountRemainingCents, currency) },
            ]}
          />
        </LicenseCard>
        {!canUseSensitiveActions ? (
          <LicenseEmptyState
            description="Les validations de paiement, exemptions et modifications de montant sont réservées aux dirigeants."
            title="Vue entraîneur"
          />
        ) : null}
        {pendingReviewPayments.length ? (
          <>
            <LicenseSectionHeader
              description={canUseSensitiveActions
                ? 'Ces déclarations viennent du joueur ou d un payeur externe et doivent être controlees.'
                : 'Déclarations en attente de validation par un dirigeant.'}
              title={canUseSensitiveActions ? 'Paiements à valider' : 'Paiements declares'}
            />
            {pendingReviewPayments.map((payment) => (
              <LicenseCard key={payment.documentId || payment.id}>
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <InfoRow label="Montant déclare" value={formatLicenseMoney(payment.amountCents, payment.currency || currency)} />
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {paymentModeLabels[payment.method] || payment.method || 'Méthode non précisée'}
                    {' '}
                    -
                    {' '}
                    {payment.note || payment.externalPaymentId || 'Aucune référence fournie.'}
                  </Text>
                  {canUseSensitiveActions ? (
                    <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                      <Button isLoading={approvePaymentMutation.isPending} onPress={() => approvePayment(payment.documentId || payment.id)} style={{ flex: 1 }} title="Valider" />
                      <Button onPress={() => setModal({ paymentId: payment.documentId || payment.id, type: 'reject' })} style={{ flex: 1 }} title="Rejeter" variant="Secondary" />
                    </View>
                  ) : null}
                </View>
              </LicenseCard>
            ))}
          </>
        ) : null}
        <LicenseSectionHeader title="Echeancier" />
        <LicenseInstallmentList currency={currency} installments={assignment?.installments || []} />
        <LicenseSectionHeader
          description={canUseSensitiveActions
            ? 'Ajoute ou remplace la licence officielle de cet adherent.'
            : 'Consulte la licence officielle de cet adherent si elle est disponible.'}
          title="Licence officielle"
        />
        <LicenseCard variant="muted">
          <View style={Spaces.gap[licenseSpacing.actionGap]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {officialLicenseDocument?.request?.name || 'Licence officielle'}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {officialLicenseDocument?.uploadedAt
                ? `Dernière mise à jour ${documentDate(officialLicenseDocument.submission || {}) || '-'}`
                : 'Aucune licence officielle n est encore disponible.'}
            </Text>
            {officialLicenseDocument?.submission?.status ? (
              <LicenseStatusChip status={officialLicenseDocument.submission.status} />
            ) : null}
            {officialLicenseDocument?.file?.url ? (
              <Button onPress={() => openUploadedDocument(officialLicenseDocument.submission)} title="Voir la licence" variant="Secondary" />
            ) : null}
            {canUseSensitiveActions ? (
              <Button
                isLoading={officialLicenseMutation.isPending}
                onPress={uploadOfficialLicense}
                title={officialLicenseDocument?.file?.url ? 'Remplacer la licence' : 'Ajouter la licence'}
              />
            ) : null}
          </View>
        </LicenseCard>
        <LicenseSectionHeader
          description={canUseSensitiveActions
            ? 'Valide ou redemande les pièces fournies par le membre.'
            : 'Statut des pièces rattachées à cette cotisation.'}
          title="Documents"
        />
        {documentRequests.length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {documentRequests.map((request) => {
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
                          {request?.dueDate ? `A remettre avant ${request.dueDate}` : 'Pas de date limite définie'}
                          {request?.required === false ? ' - Facultatif' : ' - Obligatoire'}
                        </Text>
                      </View>
                      <LicenseStatusChip status={submissionStatus} />
                    </View>
                    {request?.description ? <Text style={[Fonts.p3, Fonts.neutral200]}>{request.description}</Text> : null}
                    {submission?.refusalReason ? (
                      <Text style={[Fonts.p3, { color: '#fda4af' }]}>{submission.refusalReason}</Text>
                    ) : null}
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {submission ? `Dernière mise à jour ${documentDate(submission) || '-'}` : 'Aucun document déposé'}
                    </Text>
                    {submission?.file?.url ? (
                      <Button onPress={() => openUploadedDocument(submission)} title="Ouvrir le document" variant="Secondary" />
                    ) : null}
                    {canUseSensitiveActions && submission ? (
                      <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                        <Button onPress={() => approveDocument(submission.documentId || submission.id)} style={{ flex: 1 }} title="Valider" />
                        <Button
                          onPress={() => setModal({
                            reviewStatus: 'to_replace',
                            submissionId: submission.documentId || submission.id,
                            type: 'document-review',
                          })}
                          style={{ flex: 1 }}
                          title="A remplacer"
                          variant="Secondary"
                        />
                      </View>
                    ) : null}
                  </View>
                </LicenseCard>
              );
            })}
          </View>
        ) : (
          <LicenseEmptyState
            description="Aucune pièce n est demandée pour cette campagne."
            title="Pas de documents"
          />
        )}
        <LicenseSectionHeader title="Historique" />
        {paymentHistory.length ? (
          <View style={Spaces.gap[licenseSpacing.listGap]}>
            {paymentHistory.map((payment) => (
              <LicenseCard key={payment.documentId || payment.id} variant="muted">
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <LicenseMetricRow
                    items={[
                      { label: paymentStatusLabels[payment.status] || payment.status || 'Paiement', value: formatLicenseMoney(payment.amountCents, payment.currency || currency) },
                      { label: 'Methode', value: paymentModeLabels[payment.method] || payment.method || '-' },
                      { label: 'Date', value: paymentDate(payment) || '-' },
                    ]}
                  />
                  {payment?.receiptNumber ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      Recu
                      {' '}
                      {payment.receiptNumber}
                    </Text>
                  ) : null}
                  {(payment?.refunds || []).map((refund) => (
                    <Text key={refund.documentId || refund.id} style={[Fonts.p3, Fonts.neutral200]}>
                      Remboursement
                      {' '}
                      {formatLicenseMoney(refund.amountCents, refund.currency || payment.currency || currency)}
                      {' '}
                      -
                      {' '}
                      {paymentStatusLabels[refund.status] || refund.status || 'En attente'}
                    </Text>
                  ))}
                  {canUseSensitiveActions && ['confirmed', 'partially_refunded'].includes(payment?.status) ? (
                    <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                      {!payment?.receipt ? (
                        <Button
                          isLoading={receiptMutation.isPending}
                          onPress={() => generateReceiptForPayment(payment.documentId || payment.id)}
                          style={{ flex: 1 }}
                          title="Générer un reçu"
                          variant="Secondary"
                        />
                      ) : null}
                      {refundableAmount(payment) > 0 ? (
                        <Button
                          onPress={() => setModal({ paymentId: payment.documentId || payment.id, type: 'refund' })}
                          style={{ flex: 1 }}
                          title="Rembourser"
                          variant="Secondary"
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </LicenseCard>
            ))}
          </View>
        ) : (
          <LicenseEmptyState
            description="Aucun paiement n est encore rattache à cette cotisation."
            title="Aucun historique"
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
            description="Les reçus apparaîtront ici après validation des paiements."
            title="Aucun reçu"
          />
        )}
        {canSendReminder || canUseSensitiveActions ? (
          <>
            <LicenseSectionHeader title="Actions" />
            {canSendReminder ? <Button isLoading={reminderMutation.isPending} onPress={remind} title="Relancer" variant="Secondary" /> : null}
            {/*
              T03 — « A payer », le miroir d « Exempter la cotisation », et il se
              tient juste a cote de « Relancer » comme Adel l a demande.
              ⛔ AUCUN BOUTON INERTE : il n apparait que sur une cotisation
              EXEMPTEE. Ailleurs il n aurait rien a faire — une cotisation en
              attente est deja a payer — et le serveur refuserait.
            */}
            {canUseSensitiveActions && assignment?.status === 'waived' ? (
              <Button
                isLoading={unwaiveMutation.isPending}
                onPress={setBackToDue}
                title="À payer"
                variant="Secondary"
              />
            ) : null}
            {canUseSensitiveActions ? (
              <>
                <Button onPress={() => setModal({ type: 'payment' })} title="Valider un paiement" />
                <Button onPress={() => setModal({ type: 'amount' })} title="Modifier le montant" variant="Secondary" />
                <Button onPress={() => setModal({ type: 'waive' })} title="Exempter la cotisation" variant="Secondary" />
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {modal && canUseSensitiveActions ? (
        <ActionModal
          methodOptions={manualMethodOptions}
          onClose={() => setModal(null)}
          onSubmit={submitModal}
          title={modalTitle}
          type={modalType}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default ClubLicenseMemberDetail;
