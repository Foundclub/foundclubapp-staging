import { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Text, TextInput, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  approveExternalLicensePayment,
  rejectExternalLicensePayment,
  useCurrentLicenseCampaign,
  useLicenseMutation,
  useLicensePaymentReviews,
} from '@/services/license/licenseQueries';

import {
  formatLicenseMoney,
  LicenseCard,
  LicenseEmptyState,
  LicenseMetricRow,
  LicenseSectionHeader,
  licenseSpacing,
  LicenseStatusChip,
} from './licenseDesignSystem';

const memberName = (user = {}) => [user.firstname, user.lastname].filter(Boolean).join(' ') || user.username || 'Membre';
const reviewPayments = (assignment = {}) => (assignment.payments || []).filter((payment) => payment.status === 'manual_review');

/**
 *
 * @param root0
 * @param root0.isLoading
 * @param root0.onClose
 * @param root0.onSubmit
 */
function RejectPaymentModal({
  isLoading, onClose, onSubmit,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const [reason, setReason] = useState('');

  return (
    <BottomModal
      close={onClose}
      hideCloseButton={false}
      isVisible
      scrollable={false}
      snapPoints={['38%']}
      webPresentation="dialog"
    >
      <View style={Spaces.gap[licenseSpacing.fieldGap]}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>Rejeter la declaration</Text>
        <TextInput
          onChangeText={setReason}
          placeholder="Motif obligatoire"
          placeholderTextColor={Colors.neutral400}
          style={{
            borderBottomColor: Colors.neutral200,
            borderBottomWidth: 1,
            color: Colors.neutral00,
            minHeight: 48,
            paddingVertical: 12,
          }}
          value={reason}
        />
        <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
          <Button onPress={onClose} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
          <Button isLoading={isLoading} onPress={() => onSubmit(reason)} style={{ flex: 1 }} title="Rejeter" />
        </View>
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
function ClubLicensePayments({ navigation, route }) {
  const { Fonts, Spaces } = useTheme();
  const clubId = route?.params?.clubId;
  const routeCampaignId = route?.params?.campaignId;
  const campaignQuery = useCurrentLicenseCampaign(
    useMemo(() => ({ clubId, includeDraft: true }), [clubId]),
    { enabled: Boolean(clubId && !routeCampaignId) },
  );
  const campaign = campaignQuery.data;
  const campaignId = routeCampaignId || campaign?.documentId || campaign?.id;
  const reviewsQuery = useLicensePaymentReviews(campaignId, { pageSize: 50 }, { enabled: Boolean(campaignId) });
  const approveMutation = useLicenseMutation(({ paymentId, ...payload }) => approveExternalLicensePayment(paymentId, payload), campaignId);
  const rejectMutation = useLicenseMutation(({ paymentId, ...payload }) => rejectExternalLicensePayment(paymentId, payload), campaignId);
  const [paymentToReject, setPaymentToReject] = useState(null);

  const assignments = reviewsQuery.data?.data || [];
  const totalReviewPayments = assignments.reduce((sum, assignment) => sum + reviewPayments(assignment).length, 0);
  const totalReviewCents = assignments.reduce((sum, assignment) => (
    sum + reviewPayments(assignment).reduce((paymentSum, payment) => paymentSum + (Number(payment.amountCents) || 0), 0)
  ), 0);

  const approvePayment = useCallback((paymentId) => {
    Alert.alert('Valider le paiement declare', 'Confirmer que le club a bien recu ce paiement ?', [
      { style: 'cancel', text: 'Annuler' },
      {
        onPress: () => approveMutation.mutate({ paymentId }, {
          onSuccess: () => reviewsQuery.refetch(),
        }),
        text: 'Valider',
      },
    ]);
  }, [approveMutation, reviewsQuery]);

  const rejectPayment = useCallback((reason) => {
    if (!paymentToReject) return;
    rejectMutation.mutate({ paymentId: paymentToReject, reason }, {
      onSuccess: () => {
        setPaymentToReject(null);
        reviewsQuery.refetch();
      },
    });
  }, [paymentToReject, rejectMutation, reviewsQuery]);

  const renderAssignment = ({ item }) => {
    const payments = reviewPayments(item);
    const currency = item.currency || item.campaign?.currency || 'EUR';

    return (
      <LicenseCard>
        <View style={Spaces.gap[licenseSpacing.actionGap]}>
          <View style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: licenseSpacing.actionGap,
            justifyContent: 'space-between',
          }}
          >
            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{memberName(item.user)}</Text>
              <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{item.team?.name || 'Sans equipe'}</Text>
            </View>
            <LicenseStatusChip status={item.status} />
          </View>
          {payments.map((payment) => (
            <LicenseCard key={payment.documentId || payment.id} variant="muted">
              <View style={Spaces.gap[licenseSpacing.actionGap]}>
                <LicenseMetricRow
                  items={[
                    { label: 'Declare', value: formatLicenseMoney(payment.amountCents, payment.currency || currency) },
                    { label: 'Reference', value: payment.externalPaymentId || '-' },
                  ]}
                />
                {payment.note ? <Text style={[Fonts.p3, Fonts.neutral200]}>{payment.note}</Text> : null}
                <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                  <Button isLoading={approveMutation.isPending} onPress={() => approvePayment(payment.documentId || payment.id)} style={{ flex: 1 }} title="Valider" />
                  <Button onPress={() => setPaymentToReject(payment.documentId || payment.id)} style={{ flex: 1 }} title="Rejeter" variant="Secondary" />
                </View>
              </View>
            </LicenseCard>
          ))}
          <Button
            onPress={() => navigation.navigate(RouteNames.ClubLicenseMemberDetail, {
              assignmentId: item.documentId || item.id,
              campaignId,
            })}
            title="Ouvrir la fiche membre"
            variant="Secondary"
          />
        </View>
      </LicenseCard>
    );
  };

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <View style={[Spaces.gap[licenseSpacing.sectionGap], { flex: 1 }]}>
        <View style={Spaces.gap[licenseSpacing.titleGap]}>
          <Text style={[Fonts.h2, Fonts.neutral00]}>Paiements a valider</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Controle les declarations externes avant de les passer en encaisse.
          </Text>
        </View>
        <LicenseCard>
          <LicenseMetricRow
            items={[
              { label: 'Dossiers', value: String(assignments.length) },
              { label: 'Declarations', value: String(totalReviewPayments) },
              { label: 'Montant', value: formatLicenseMoney(totalReviewCents) },
            ]}
          />
        </LicenseCard>
        <LicenseSectionHeader title="A traiter" />
        <FlatList
          contentContainerStyle={{ gap: licenseSpacing.listGap, paddingBottom: 40 }}
          data={assignments}
          keyExtractor={(item) => String(item.documentId || item.id)}
          ListEmptyComponent={(
            <LicenseEmptyState
              description="Aucune declaration de paiement n attend de validation."
              title="Tout est propre"
            />
          )}
          onRefresh={reviewsQuery.refetch}
          refreshing={reviewsQuery.isRefetching}
          renderItem={renderAssignment}
        />
      </View>
      {paymentToReject ? (
        <RejectPaymentModal
          isLoading={rejectMutation.isPending}
          onClose={() => setPaymentToReject(null)}
          onSubmit={rejectPayment}
        />
      ) : null}
    </ScreenContainer>
  );
}

export default ClubLicensePayments;
