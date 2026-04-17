import { useCallback, useMemo } from 'react';
import {
  Alert, Linking, ScrollView, Share, Text, View,
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

import { getApiBaseUrl } from '@/config/runtimeUrls';

const money = (value = 0) => new Intl.NumberFormat('fr-FR', { currency: 'EUR', style: 'currency' }).format((value || 0) / 100);
const statusLabel = {
  manual_review: 'En attente de validation', overdue: 'Paiement en retard', paid: 'Cotisation payee', partial: 'Paiement partiel', pending: 'Reste a payer', waived: 'Cotisation exemptee',
};
const statusColor = (Colors, status) => ({
  manual_review: Colors.primary200,
  overdue: Colors.error500,
  paid: Colors.success500,
  partial: Colors.warning500,
}[status] || Colors.primary500);

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
  const apiBaseUrl = getApiBaseUrl();
  const payerLink = current?.securePaymentToken && apiBaseUrl
    ? `${apiBaseUrl}/licenses/pay/${current.securePaymentToken}`
    : null;

  const openCheckout = useCallback((provider) => {
    checkoutMutation.mutate(provider, {
      onError: (error) => Alert.alert('Paiement indisponible', error?.message || 'Aucun lien de paiement configure.'),
      onSuccess: async (result) => {
        if (result?.checkoutUrl) {
          await Linking.openURL(result.checkoutUrl);
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
    Share.share({
      message: `Paiement cotisation FoundClub: ${payerLink}`,
      url: payerLink,
    });
  }, [payerLink]);

  if (!current) {
    return (
      <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
        <View style={Spaces.gap[16]}>
          <Text style={[Fonts.h2, Fonts.neutral00]}>Ma cotisation</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Aucune cotisation n est encore disponible pour ton compte.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const tone = statusColor(Colors, current.status);
  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[24], { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View style={[ApplicationStyle.card, {
          backgroundColor: Colors.primary700, borderColor: `${tone}99`, borderRadius: 26, paddingHorizontal: 20, paddingVertical: 22,
        }]}
        >
          <Text style={[Fonts.h2, { color: tone }]}>{statusLabel[current.status] || current.status}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
            {current?.club?.name || current?.campaign?.club?.name || 'Ton club'}
            {' '}
            -
            {' '}
            {current?.campaign?.seasonLabel}
          </Text>
        </View>
        <View style={[ApplicationStyle.card, {
          backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}55`, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 20,
        }]}
        >
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>Total</Text>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{money(current.amountDueCents)}</Text>
            </View>
            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>Paye</Text>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{money(current.amountPaidCents)}</Text>
            </View>
            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>Reste</Text>
              <Text style={[Fonts.p1Bold, { color: tone }]}>{money(current.amountRemainingCents)}</Text>
            </View>
          </View>
        </View>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Echeancier</Text>
        {(current.installments || []).map((installment) => (
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
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Payer ou regulariser</Text>
        <Button isLoading={checkoutMutation.isPending} onPress={() => openCheckout('stripe')} title="Payer en ligne" />
        <Button onPress={() => openCheckout('external')} title="Ouvrir HelloAsso / lien club" variant="Secondary" />
        <Button isLoading={declareMutation.isPending} onPress={() => declareMutation.mutate(undefined, { onSuccess: () => Alert.alert('Declaration envoyee', 'Le club devra valider ce paiement.') })} title="J'ai paye hors app" variant="Secondary" />
        <Button onPress={sharePayerLink} title="Partager le lien payeur" variant="Secondary" />
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Relances</Text>
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
