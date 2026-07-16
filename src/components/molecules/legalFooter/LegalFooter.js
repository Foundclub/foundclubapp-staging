import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import { getSubscriptionBillingErrorMessage } from '@/domains/subscription/subscriptionBilling';
import { restoreAllSubscriptionPurchases } from '@/domains/subscription/subscriptionPurchaseRail';
import useTheme from '@/theme/themeContext';

/**
 * Mention legale partagee de toute surface d'achat (handoff design) :
 * « Prix TTC. Renouvellement automatique, résiliable à tout moment. »
 * + lien « Restaurer mes achats » (restauration RevenueCat + invalidation du contexte).
 * @param {object} props
 * @param {boolean} [props.restore] - Affiche le lien de restauration (defaut true).
 * @param {object | Array<object>} [props.style] - Style additionnel du conteneur.
 * @returns {import('react').ReactElement}
 */
function LegalFooter({ restore = true, style }) {
  const { Fonts, Spaces } = useTheme();
  const queryClient = useQueryClient();

  const restoreMutation = useMutation({
    mutationFn: async () => restoreAllSubscriptionPurchases(),
  });

  const handleRestorePurchases = async () => {
    if (restoreMutation.isPending) {
      return;
    }

    try {
      await restoreMutation.mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] }),
        queryClient.invalidateQueries({ queryKey: ['get-me'] }),
      ]);
      Alert.alert(
        'Restauration terminée',
        "Ton contexte abonnement vient d'être mis à jour.",
      );
    } catch (error) {
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
    }
  };

  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <Text style={[Fonts.p4, Fonts.neutral400, Fonts.textCenter]}>
        Prix TTC. Renouvellement automatique, résiliable à tout moment.
      </Text>
      {restore ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={restoreMutation.isPending}
          onPress={handleRestorePurchases}
          style={[Spaces.paddingVertical[8], Spaces.paddingHorizontal[16]]}
        >
          <Text
            style={[
              Fonts.p4,
              Fonts.neutral300,
              Fonts.textCenter,
              { textDecorationLine: 'underline' },
            ]}
          >
            {restoreMutation.isPending
              ? 'Restauration en cours…'
              : 'Restaurer mes achats'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default LegalFooter;
