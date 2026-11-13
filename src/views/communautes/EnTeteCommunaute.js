import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';

/**
 * COMMUNAUTES-L2 — l'en-tête des écrans des communautés : retour, titre, sous-titre (même habillage
 * que
 * « Autorisations du groupe »).
 * @param {object} props
 * @param {() => void} props.onRetour
 * @param {string} [props.sousTitre]
 * @param {string} props.titre
 * @returns {import('react').ReactElement} L'en-tête.
 */
function EnTeteCommunaute({ onRetour, sousTitre = '', titre }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.enTete, { backgroundColor: Colors.chatBar, paddingTop: top + 8 }]}>
      <TouchableOpacity
        accessibilityLabel={t('common.back', 'Retour')}
        accessibilityRole="button"
        onPress={onRetour}
        style={[styles.retour, { borderColor: Colors.primary500 }]}
        testID="communautes-retour"
      >
        <GlyphIcon color={Colors.neutral00} name="chevronLeft" size={20} />
      </TouchableOpacity>
      <View style={styles.textes}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.titre, { color: Colors.neutral00 }]}
        >
          {titre}
        </Text>
        {sousTitre ? (
          <Text
            numberOfLines={1}
            style={[styles.sousTitre, { color: withAlpha(Colors.neutral00, 0.6) }]}
          >
            {sousTitre}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  enTete: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  retour: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sousTitre: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    marginTop: 2,
  },
  textes: {
    flex: 1,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 18,
  },
});

export default EnTeteCommunaute;
