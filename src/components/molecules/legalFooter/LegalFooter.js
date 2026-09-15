import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Alert, Linking, Text, TouchableOpacity, View,
} from 'react-native';

import { getSubscriptionBillingErrorMessage } from '@/domains/subscription/subscriptionBilling';
import { restoreAllSubscriptionPurchases } from '@/domains/subscription/subscriptionPurchaseRail';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/config/legalUrls';

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
  const { t } = useTranslation();
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
        t('legalFooter.restoreDone.title', 'Restauration terminée'),
        t('legalFooter.restoreDone.message', "Ton contexte abonnement vient d'être mis à jour."),
      );
    } catch (error) {
      Alert.alert(t(
        'legalFooter.restoreError.title',
        'Erreur abonnement',
      ), getSubscriptionBillingErrorMessage(error));
    }
  };

  // Un lien legal qui n'ouvre rien vaut un lien absent pour un examinateur :
  // l'echec d'ouverture se dit, il ne se tait pas.
  const openLegalUrl = (url) => {
    Promise.resolve(Linking.openURL(url)).catch(() => {
      Alert.alert(
        t('legalFooter.linkError.title', 'Page indisponible'),
        t(
          'legalFooter.linkError.message',
          "Impossible d'ouvrir {{url}} depuis l'application.",
          { url, ...SANS_ECHAPPEMENT },
        ),
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
        {t(
          'legalFooter.pricesNotice',
          'Prix TTC. Renouvellement automatique, résiliable à tout moment.',
        )}
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
          accessibilityHint={t(
            'legalFooter.termsHint',
            "Ouvre les conditions générales d'utilisation dans le navigateur.",
          )}
          accessibilityRole="link"
          onPress={() => openLegalUrl(LEGAL_TERMS_URL)}
          style={Spaces.paddingHorizontal[8]}
        >
          <Text style={linkTextStyle}>{t('legalFooter.terms', 'Conditions générales')}</Text>
        </TouchableOpacity>
        <Text style={[Fonts.p4, Fonts.neutral400]}>·</Text>
        <TouchableOpacity
          accessibilityHint={t(
            'legalFooter.privacyHint',
            'Ouvre la politique de confidentialité dans le navigateur.',
          )}
          accessibilityRole="link"
          onPress={() => openLegalUrl(LEGAL_PRIVACY_URL)}
          style={Spaces.paddingHorizontal[8]}
        >
          <Text style={linkTextStyle}>{t('legalFooter.privacy', 'Confidentialité')}</Text>
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
              ? t('legalFooter.restoring', 'Restauration en cours…')
              : t('legalFooter.restore', 'Restaurer mes achats')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default LegalFooter;
