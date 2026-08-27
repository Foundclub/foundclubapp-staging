import { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Text, TextInput, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  approveExternalLicensePayment,
  rejectExternalLicensePayment,
  useCurrentLicenseCampaign,
  useLicenseDashboard,
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
const resolveCanManageLicenses = (scope, routeCanManageLicenses) => {
  if (scope === 'coach') return false;
  if (typeof routeCanManageLicenses === 'boolean') return routeCanManageLicenses;
  return Boolean(scope && scope !== 'coach');
};

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
        <Text style={[Fonts.h3, Fonts.neutral00]}>Rejeter la déclaration</Text>
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
  const routeCanManageLicenses = route?.params?.canManageLicenses;
  const routeScope = route?.params?.scope;
  const campaignQuery = useCurrentLicenseCampaign(
    useMemo(() => ({ clubId, includeDraft: true }), [clubId]),
    { enabled: Boolean(clubId && !routeCampaignId) },
  );
  const campaign = campaignQuery.data;
  const campaignId = routeCampaignId || campaign?.documentId || campaign?.id;
  const permissionQuery = useLicenseDashboard(campaignId, {
    enabled: Boolean(campaignId && routeCanManageLicenses === undefined && !routeScope),
  });
  const scope = routeScope || permissionQuery.data?.scope;
  const canManageLicenses = resolveCanManageLicenses(scope, routeCanManageLicenses);
  const reviewsQuery = useLicensePaymentReviews(campaignId, { pageSize: 50 }, { enabled: Boolean(campaignId && canManageLicenses) });
  const approveMutation = useLicenseMutation(({ paymentId, ...payload }) => approveExternalLicensePayment(paymentId, payload), campaignId);
  const rejectMutation = useLicenseMutation(({ paymentId, ...payload }) => rejectExternalLicensePayment(paymentId, payload), campaignId);
  const [paymentToReject, setPaymentToReject] = useState(null);

  const assignments = reviewsQuery.data?.data || [];
  const totalReviewPayments = assignments.reduce((sum, assignment) => sum + reviewPayments(assignment).length, 0);
  const totalReviewCents = assignments.reduce((sum, assignment) => (
    sum + reviewPayments(assignment).reduce((paymentSum, payment) => paymentSum + (Number(payment.amountCents) || 0), 0)
  ), 0);
  const isLoading = campaignQuery.isLoading || (
    Boolean(campaignId)
    && routeCanManageLicenses === undefined
    && !routeScope
    && permissionQuery.isLoading
  ) || (canManageLicenses && reviewsQuery.isLoading);
  const hasError = campaignQuery.isError || permissionQuery.isError || reviewsQuery.isError;

  const approvePayment = useCallback((paymentId) => {
    if (!canManageLicenses) return;
    Alert.alert('Valider le paiement déclare', 'Confirmer que le club a bien reçu ce paiement ?', [
      { style: 'cancel', text: 'Annuler' },
      {
        onPress: () => approveMutation.mutate({ paymentId }, {
          onSuccess: () => reviewsQuery.refetch(),
        }),
        text: 'Valider',
      },
    ]);
  }, [approveMutation, canManageLicenses, reviewsQuery]);

  const rejectPayment = useCallback((reason) => {
    if (!paymentToReject || !canManageLicenses) return;
    rejectMutation.mutate({ paymentId: paymentToReject, reason }, {
      onSuccess: () => {
        setPaymentToReject(null);
        reviewsQuery.refetch();
      },
    });
  }, [canManageLicenses, paymentToReject, rejectMutation, reviewsQuery]);

  const retryData = useCallback(() => {
    campaignQuery.refetch();
    if (campaignId) {
      permissionQuery.refetch();
      reviewsQuery.refetch();
    }
  }, [campaignId, campaignQuery, permissionQuery, reviewsQuery]);

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
              {/* MARQUEE — le nom du licencie se lit en entier */}
              <MarqueeText
                style={[Fonts.p1Bold, Fonts.neutral00]}
                text={memberName(item.user)}
              />
              {/* MARQUEE — l equipe du licencie se lit en entier */}
              <MarqueeText
                style={[Fonts.p3, Fonts.neutral200]}
                text={item.team?.name || 'Sans équipe'}
              />
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
              canManageLicenses,
              scope,
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
          <Text style={[Fonts.h2, Fonts.neutral00]}>Paiements à valider</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Controle les déclarations externes avant de les passer en encaisse.
          </Text>
        </View>
        {isLoading ? (
          <LicenseEmptyState
            description="On charge les déclarations en attente."
            title="Chargement"
          />
        ) : null}
        {!isLoading && !hasError && !canManageLicenses ? (
          <LicenseEmptyState
            description="La validation des paiements est réservée aux dirigeants."
            title="Action réservée"
          />
        ) : null}
        {!isLoading && hasError ? (
          <LicenseEmptyState
            action={<Button onPress={retryData} title="Réessayer" variant="Secondary" />}
            description="Impossible de charger les paiements à valider."
            title="Paiements indisponibles"
          />
        ) : null}
        {!isLoading && canManageLicenses && !hasError ? (
          <>
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
                  description="Aucune déclaration de paiement n attend de validation."
                  title="Tout est propre"
                />
              )}
              onRefresh={reviewsQuery.refetch}
              refreshing={reviewsQuery.isRefetching}
              renderItem={renderAssignment}
            />
          </>
        ) : null}
      </View>
      {paymentToReject && canManageLicenses ? (
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
