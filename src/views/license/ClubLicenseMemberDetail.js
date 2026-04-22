import { useCallback, useState } from 'react';
import {
  Alert, ScrollView, Text, TextInput, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  addManualLicensePayment,
  approveExternalLicensePayment,
  rejectExternalLicensePayment,
  sendLicenseReminder,
  updateLicenseAssignmentAmount,
  useLicenseAssignment,
  useLicenseMutation,
  waiveLicenseAssignment,
} from '@/services/license/licenseQueries';

import {
  formatLicenseMoney,
  LicenseCard,
  LicenseInstallmentList,
  LicenseMetricRow,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
} from './licenseDesignSystem';

const euroToCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);

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
 */
function ActionModal({
  onClose, onSubmit, title, type,
}) {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const needsAmount = ['amount', 'payment'].includes(type);
  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      scrollable={false}
      snapPoints={['42%']}
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
        <TextInput
          onChangeText={setNote}
          placeholder={['reject', 'waive'].includes(type) ? 'Motif obligatoire' : 'Note optionnelle'}
          placeholderTextColor={Colors.neutral400}
          style={{
            borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12,
          }}
          value={note}
        />
        <View style={[Spaces.marginTop[8], { flexDirection: 'row', gap: licenseSpacing.actionGap }]}>
          <Button onPress={onClose} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
          <Button onPress={() => onSubmit({ amountCents: euroToCents(amount), note, reason: note })} style={{ flex: 1 }} title="Valider" />
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
  const assignmentId = route?.params?.assignmentId;
  const campaignId = route?.params?.campaignId;
  const query = useLicenseAssignment(assignmentId);
  const assignment = query.data;
  const [modal, setModal] = useState(null);
  const manualPaymentMutation = useLicenseMutation((payload) => addManualLicensePayment(assignmentId, { ...payload, method: 'cash' }), campaignId);
  const approvePaymentMutation = useLicenseMutation(({ paymentId, ...payload }) => approveExternalLicensePayment(paymentId, payload), campaignId);
  const rejectPaymentMutation = useLicenseMutation(({ paymentId, ...payload }) => rejectExternalLicensePayment(paymentId, payload), campaignId);
  const amountMutation = useLicenseMutation((payload) => updateLicenseAssignmentAmount(assignmentId, payload), campaignId);
  const waiveMutation = useLicenseMutation((payload) => waiveLicenseAssignment(assignmentId, payload), campaignId);
  const reminderMutation = useLicenseMutation((payload) => sendLicenseReminder(assignmentId, payload), campaignId);

  const memberName = [assignment?.user?.firstname, assignment?.user?.lastname].filter(Boolean).join(' ') || assignment?.user?.username || 'Membre';
  const modalType = modal?.type;
  const modalTitle = {
    amount: 'Modifier le montant',
    payment: 'Valider un paiement',
    reject: 'Rejeter la declaration',
    waive: 'Exempter la cotisation',
  }[modalType];
  const pendingReviewPayments = (assignment?.payments || []).filter((payment) => payment.status === 'manual_review');
  const currency = assignment?.currency || assignment?.campaign?.currency || 'EUR';

  const submitModal = useCallback((payload) => {
    const common = { onSuccess: () => { setModal(null); query.refetch(); } };
    if (modalType === 'payment') manualPaymentMutation.mutate(payload, common);
    if (modalType === 'amount') amountMutation.mutate({ amountDueCents: payload.amountCents, note: payload.note }, common);
    if (modalType === 'waive') waiveMutation.mutate({ reason: payload.reason }, common);
    if (modalType === 'reject') rejectPaymentMutation.mutate({ paymentId: modal.paymentId, reason: payload.reason }, common);
  }, [amountMutation, manualPaymentMutation, modal, modalType, query, rejectPaymentMutation, waiveMutation]);

  const remind = useCallback(() => {
    reminderMutation.mutate({}, { onSuccess: () => Alert.alert('Relance envoyee') });
  }, [reminderMutation]);

  const approvePayment = useCallback((paymentId) => {
    Alert.alert('Valider le paiement declare', 'Confirmer que le club a bien recu ce paiement ?', [
      { style: 'cancel', text: 'Annuler' },
      {
        onPress: () => approvePaymentMutation.mutate({ paymentId }, {
          onSuccess: () => query.refetch(),
        }),
        text: 'Valider',
      },
    ]);
  }, [approvePaymentMutation, query]);

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[Fonts.h2, Fonts.neutral00]}>{memberName}</Text>
          <View style={[Spaces.marginTop[8], Spaces.gap[licenseSpacing.titleGap]]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>{assignment?.team?.name || 'Sans equipe'}</Text>
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
        {pendingReviewPayments.length ? (
          <>
            <LicenseSectionHeader
              description="Ces declarations viennent du joueur ou d un payeur externe et doivent etre controlees."
              title="Paiements a valider"
            />
            {pendingReviewPayments.map((payment) => (
              <LicenseCard key={payment.documentId || payment.id}>
                <View style={Spaces.gap[licenseSpacing.actionGap]}>
                  <InfoRow label="Montant declare" value={formatLicenseMoney(payment.amountCents, payment.currency || currency)} />
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{payment.note || payment.externalPaymentId || 'Aucune reference fournie.'}</Text>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <Button isLoading={approvePaymentMutation.isPending} onPress={() => approvePayment(payment.documentId || payment.id)} style={{ flex: 1 }} title="Valider" />
                    <Button onPress={() => setModal({ paymentId: payment.documentId || payment.id, type: 'reject' })} style={{ flex: 1 }} title="Rejeter" variant="Secondary" />
                  </View>
                </View>
              </LicenseCard>
            ))}
          </>
        ) : null}
        <LicenseSectionHeader title="Echeancier" />
        <LicenseInstallmentList currency={currency} installments={assignment?.installments || []} />
        <LicenseSectionHeader title="Actions" />
        <Button onPress={() => setModal({ type: 'payment' })} title="Valider un paiement" />
        <Button isLoading={reminderMutation.isPending} onPress={remind} title="Relancer" variant="Secondary" />
        <Button onPress={() => setModal({ type: 'amount' })} title="Modifier le montant" variant="Secondary" />
        <Button onPress={() => setModal({ type: 'waive' })} title="Exempter la cotisation" variant="Secondary" />
      </ScrollView>
      {modal ? (
        <ActionModal
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
