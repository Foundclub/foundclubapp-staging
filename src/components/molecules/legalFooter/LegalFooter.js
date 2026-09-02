import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Linking, Text, TouchableOpacity, View,
} from 'react-native';

import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/config/legalUrls';
import { getSubscriptionBillingErrorMessage } from '@/domains/subscription/subscriptionBilling';
import { restoreAllSubscriptionPurchases } from '@/domains/subscription/subscriptionPurchaseRail';
import useTheme from '@/theme/themeContext';

/**
 * Mention legale partagee de toute surface d'achat (handoff design) :
 * « Prix TTC. Renouvellement automatique, résiliable à tout moment. »
 * + les liens CGU et confidentialite (B4 / Apple 3.1.2, exiges DANS le binaire
 * la ou on vend) + lien « Restaurer mes achats » (restauration RevenueCat +
 * invalidation du contexte).
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

  // Un lien legal qui n'ouvre rien vaut un lien absent pour un examinateur :
  // l'echec d'ouverture se dit, il ne se tait pas.
  const openLegalUrl = (url) => {
    Promise.resolve(Linking.openURL(url)).catch(() => {
      Alert.alert(
        'Page indisponible',
        `Impossible d'ouvrir ${url} depuis l'application.`,
      );
    });
  };

  const linkTextStyle = [
    Fonts.p4,
    Fonts.neutral300,
    Fonts.textCenter,
    { textDecorationLine: 'underline' },
  ];

  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <Text style={[Fonts.p4, Fonts.neutral400, Fonts.textCenter]}>
        Prix TTC. Renouvellement automatique, résiliable à tout moment.
      </Text>
      <View
        style={[
          Spaces.paddingTop[8],
          {
            alignItems: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
          },
        ]}
      >
        <TouchableOpacity
          accessibilityHint="Ouvre les conditions générales d'utilisation dans le navigateur."
          accessibilityRole="link"
          onPress={() => openLegalUrl(LEGAL_TERMS_URL)}
          style={Spaces.paddingHorizontal[8]}
        >
          <Text style={linkTextStyle}>Conditions générales</Text>
        </TouchableOpacity>
        <Text style={[Fonts.p4, Fonts.neutral400]}>·</Text>
        <TouchableOpacity
          accessibilityHint="Ouvre la politique de confidentialité dans le navigateur."
          accessibilityRole="link"
          onPress={() => openLegalUrl(LEGAL_PRIVACY_URL)}
          style={Spaces.paddingHorizontal[8]}
        >
          <Text style={linkTextStyle}>Confidentialité</Text>
        </TouchableOpacity>
      </View>
      {restore ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={restoreMutation.isPending}
          onPress={handleRestorePurchases}
          style={[Spaces.paddingVertical[8], Spaces.paddingHorizontal[16]]}
        >
          <Text style={linkTextStyle}>
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
