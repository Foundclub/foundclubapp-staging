import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

// INSCRIPTION-PARCOURS A3 (D245, 18/11) — un vrai inscrit : « rien ne dit qu'une étape est
// facultative ». En HAUT de chaque étape facultative de l'inscription : la phrase, et « Passer »
// à côté, visible sans défiler. Le lien « Passer cette étape » du bas (OnboardingSkipLink) reste :
// rien n'est retiré. Les étapes obligatoires (rôle, « Qui es-tu ? », déclaration parentale) ne
// le montent pas.

/**
 * Bandeau « Facultatif : tu peux passer cette étape » + « Passer ».
 * @param {object} props - Component props.
 * @param {() => void} props.onPress - Le même saut que le lien du bas.
 * @returns {import('react').ReactElement} Le bandeau.
 */
function OnboardingFacultatif({ onPress }) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const passer = t('onboarding.actions.skipShort', 'Passer');

  return (
    <View
      style={[
        styles.bandeau,
        { borderColor: Colors?.primary500 },
      ]}
      testID="onboarding-facultatif"
    >
      <Text style={[Fonts?.p2, Fonts?.neutral00, styles.phrase]}>
        {t('onboarding.actions.optionalNotice', 'Facultatif : tu peux passer cette étape')}
      </Text>
      <TouchableOpacity
        accessibilityHint={t(
          'onboardingAffiliation.a11y.continueLaterHint',
          "Passe cette étape et continue l'onboarding.",
        )}
        accessibilityLabel={passer}
        accessibilityRole="button"
        // Cible tactile de 44 pt : 24 pt rendus (16 de texte + 2 × 4) et 10 pt de chaque côté,
        // comme `min44From24` du lien du bas.
        hitSlop={HIT_SLOP}
        onPress={onPress}
        style={styles.bouton}
        testID="onboarding-facultatif-passer"
      >
        <Text style={[styles.passer, { color: Colors?.primary500 }]}>{passer}</Text>
      </TouchableOpacity>
    </View>
  );
}

const HIT_SLOP = {
  bottom: 10, left: 10, right: 10, top: 10,
};

const styles = StyleSheet.create({
  bandeau: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bouton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  passer: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  phrase: {
    flex: 1,
  },
});

export default OnboardingFacultatif;
