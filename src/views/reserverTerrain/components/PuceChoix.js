import { Text, TouchableOpacity } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

const HAUTEUR = 44;

/**
 * UNE PUCE À TOUCHER — RESA-L6A (14/10/2026), planches EP01, RA1, EP03 : un filtre, un jour, un
 * créneau. Choisie : pleine cyan, encre foncée (P00 bloc 3) ; sinon liserée cyan. Zone de toucher
 * de 44 px (décision d'Adel : ≥ 44 px), même quand le dessin la montre plus basse.
 * @param {object} props - Les propriétés.
 * @param {string} [props.accessibilityLabel] - Le libellé lu (sinon le texte).
 * @param {boolean} [props.choisie] - Choisie.
 * @param {string} props.libelle - Le texte.
 * @param {() => void} props.onPress - Toucher.
 * @param {string} [props.testID] - Le repère des témoins.
 * @returns {import('react').ReactElement} La puce.
 */
function PuceChoix({
  accessibilityLabel = undefined, choisie = false, libelle, onPress, testID = undefined,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel || libelle}
      accessibilityRole="button"
      accessibilityState={{ selected: choisie }}
      onPress={onPress}
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          backgroundColor: choisie ? Colors.primary500 : withAlpha(Colors.primary500, 0.08),
          borderColor: withAlpha(Colors.primary500, choisie ? 1 : 0.5),
          borderRadius: 999,
          borderWidth: 1,
          minHeight: HAUTEUR,
          paddingHorizontal: 14,
        },
      ]}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, choisie ? Fonts.primary900 : Fonts.primary200]}>{libelle}</Text>
    </TouchableOpacity>
  );
}

export default PuceChoix;
