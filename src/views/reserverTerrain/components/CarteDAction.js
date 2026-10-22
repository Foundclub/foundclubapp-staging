import { Image, Text, TouchableOpacity } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * UNE CARTE D'ACTION — RESA-L6B-2 (20/10/2026), planche EP07 (`carte-action`) : une icône du
 * système (jamais d'emoji), le libellé, un chevron ; zone de toucher de 52 px.
 * @param {object} props - Les propriétés.
 * @param {string} props.icone - Le nom d'une image du thème (`share`, `users`, `envelope`…).
 * @param {string} props.libelle - Le libellé (aussi lu par le lecteur d'écran).
 * @param {boolean} [props.occupee] - Le serveur répond : la carte attend.
 * @param {() => void} props.onPress - Toucher.
 * @param {string} [props.testID] - Le repère des témoins.
 * @returns {import('react').ReactElement} La carte.
 */
function CarteDAction({
  icone, libelle, occupee = false, onPress, testID = undefined,
}) {
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  const source = /** @type {any} */ (Images)[icone];
  return (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      accessibilityState={{ busy: occupee }}
      disabled={occupee}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: withAlpha(Colors.primary800, 0.6),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 16,
          borderWidth: 1,
          gap: 12,
          minHeight: 52,
          opacity: occupee ? 0.6 : 1,
          paddingHorizontal: 14,
        },
      ]}
      testID={testID}
    >
      {source ? (
        <Image source={source} style={{ height: 20, tintColor: Colors.primary500, width: 20 }} />
      ) : null}
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{libelle}</Text>
      {Images.arrowRight ? (
        <Image
          source={Images.arrowRight}
          style={{ height: 12, tintColor: Colors.primary200, width: 12 }}
        />
      ) : null}
    </TouchableOpacity>
  );
}

export default CarteDAction;
