import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import useTheme from '@/theme/themeContext';

// D15 - REGISTRE DU PACK D'INSCRIPTION : une etape facultative porte UN SEUL
// bouton plein, et dessous ce lien en TEXTE. Il remplace le second bouton
// `variant="Secondary"` « Continuer plus tard », qui donnait a un saut le meme
// poids visuel qu'a l'action principale.
//
// Le modele est `AffiliationSkipLink` de UserAffiliationGuide.js (l.160), qui
// avait deja fait ce virage pour l'etape club : meme role d'accessibilite, meme
// hitSlop, meme couleur.

/**
 * Lien « Passer cette etape » des etapes facultatives de l'inscription.
 * @param {object} props - Component props.
 * @param {() => void} props.onPress - Navigation vers l'etape suivante.
 * @param {string} [props.label] - Libelle affiche. Defaut : « Passer cette etape ».
 * @param {string} [props.hint] - Indication d'accessibilite.
 * @returns {import('react').ReactElement} Le lien de saut.
 */
function OnboardingSkipLink({ hint, label, onPress }) {
  const { ApplicationStyle, Colors, Spaces } = useTheme();
  const { t } = useTranslation();

  const visibleLabel = label || t('onboarding.actions.skipStep', 'Passer cette étape');
  const accessibilityHint = hint || t(
    'onboardingAffiliation.a11y.continueLaterHint',
    'Passe cette étape et continue l\'onboarding.',
  );

  return (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={visibleLabel}
      accessibilityRole="button"
      // La cible rendue fait 32 pt de haut (14 pt de texte + 2 x 8 pt) : le
      // hitSlop la complete jusqu'aux 44 pt exiges.
      hitSlop={ApplicationStyle.hitSlop?.min44From32}
      onPress={onPress}
      style={[Spaces.paddingHorizontal[16], Spaces.paddingVertical[8]]}
      testID="onboarding-skip-link"
    >
      <Text style={[styles.label, { color: Colors.primary500 }]}>{visibleLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default OnboardingSkipLink;
