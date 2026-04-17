import { useCallback, useState } from 'react';
import {
  Alert, Modal, ScrollView, Text, TextInput, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  addManualLicensePayment,
  sendLicenseReminder,
  updateLicenseAssignmentAmount,
  useLicenseAssignment,
  useLicenseMutation,
  waiveLicenseAssignment,
} from '@/services/license/licenseQueries';

const money = (value = 0) => new Intl.NumberFormat('fr-FR', { currency: 'EUR', style: 'currency' }).format((value || 0) / 100);
const euroToCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);
const statusLabel = {
  manual_review: 'A valider', overdue: 'En retard', paid: 'Payee', partial: 'Partiel', pending: 'En attente', waived: 'Exemptee',
};

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
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={{ backgroundColor: `${Colors.neutral900}cc`, flex: 1, justifyContent: 'flex-end' }}>
        <View style={[ApplicationStyle.card, Spaces.gap[16], {
          backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}66`, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 24,
        }]}
        >
          <Text style={[Fonts.h3, Fonts.neutral00]}>{title}</Text>
          {type !== 'waive' ? (
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
            placeholder={type === 'waive' ? 'Motif obligatoire' : 'Note optionnelle'}
            placeholderTextColor={Colors.neutral400}
            style={{
              borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12,
            }}
            value={note}
          />
          <View style={[Spaces.marginTop[8], { flexDirection: 'row', gap: 12 }]}>
            <Button onPress={onClose} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
            <Button onPress={() => onSubmit({ amountCents: euroToCents(amount), note, reason: note })} style={{ flex: 1 }} title="Valider" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 *
 * @param root0
 * @param root0.route
 */
function ClubLicenseMemberDetail({ route }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const assignmentId = route?.params?.assignmentId;
  const campaignId = route?.params?.campaignId;
  const query = useLicenseAssignment(assignmentId);
  const assignment = query.data;
  const [modal, setModal] = useState(null);
  const manualPaymentMutation = useLicenseMutation((payload) => addManualLicensePayment(assignmentId, { ...payload, method: 'cash' }), campaignId);
  const amountMutation = useLicenseMutation((payload) => updateLicenseAssignmentAmount(assignmentId, payload), campaignId);
  const waiveMutation = useLicenseMutation((payload) => waiveLicenseAssignment(assignmentId, payload), campaignId);
  const reminderMutation = useLicenseMutation((payload) => sendLicenseReminder(assignmentId, payload), campaignId);

  const memberName = [assignment?.user?.firstname, assignment?.user?.lastname].filter(Boolean).join(' ') || assignment?.user?.username || 'Membre';
  const modalTitle = {
    amount: 'Modifier le montant',
    payment: 'Valider un paiement',
    waive: 'Exempter la cotisation',
  }[modal];

  const submitModal = useCallback((payload) => {
    const common = { onSuccess: () => { setModal(null); query.refetch(); } };
    if (modal === 'payment') manualPaymentMutation.mutate(payload, common);
    if (modal === 'amount') amountMutation.mutate({ amountDueCents: payload.amountCents, note: payload.note }, common);
    if (modal === 'waive') waiveMutation.mutate({ reason: payload.reason }, common);
  }, [amountMutation, manualPaymentMutation, modal, query, waiveMutation]);

  const remind = useCallback(() => {
    reminderMutation.mutate({}, { onSuccess: () => Alert.alert('Relance envoyee') });
  }, [reminderMutation]);

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[24], { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[Fonts.h2, Fonts.neutral00]}>{memberName}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
            {assignment?.team?.name || 'Sans equipe'}
            {' '}
            -
            {' '}
            {statusLabel[assignment?.status] || assignment?.status || ''}
          </Text>
        </View>
        <View style={[ApplicationStyle.card, {
          backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}66`, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 20,
        }]}
        >
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <InfoRow label="Total" value={money(assignment?.amountDueCents)} />
            <InfoRow label="Paye" value={money(assignment?.amountPaidCents)} />
            <InfoRow label="Reste" value={money(assignment?.amountRemainingCents)} />
          </View>
        </View>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Echeancier</Text>
        {(assignment?.installments || []).map((installment) => (
          <View
            key={installment.id}
            style={[ApplicationStyle.card, {
              backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}44`, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 18,
            }]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              Echeance
              {installment.order}
              {' '}
              -
              {money(installment.amountDueCents)}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8]]}>
              {installment.dueDate || 'Date non definie'}
              {' '}
              -
              {' '}
              {statusLabel[installment.status] || installment.status}
            </Text>
          </View>
        ))}
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Actions</Text>
        <Button onPress={() => setModal('payment')} title="Valider un paiement" />
        <Button isLoading={reminderMutation.isPending} onPress={remind} title="Relancer" variant="Secondary" />
        <Button onPress={() => setModal('amount')} title="Modifier le montant" variant="Secondary" />
        <Button onPress={() => setModal('waive')} title="Exempter la cotisation" variant="Secondary" />
      </ScrollView>
      {modal ? (
        <ActionModal
          onClose={() => setModal(null)}
          onSubmit={submitModal}
          title={modalTitle}
          type={modal}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default ClubLicenseMemberDetail;
