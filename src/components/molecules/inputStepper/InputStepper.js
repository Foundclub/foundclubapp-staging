import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Compteur - / valeur / +.
 *
 * 🎨 D58 — `tone` choisit le registre visuel, et le defaut ne bouge pas.
 * `'surface'` est l'historique : fond clair, boutons blancs, chiffre sombre.
 * `'tunnel'` est celui du pack « Tunnel Evenement » (§2.8, « fini le stepper
 * blanc ») : le meme compteur que l'etape Participants, sur fond sombre.
 * ⚠️ Ce composant est partage par 4 ecrans — la fiche Tache, les licences et
 * deux ecrans de recrutement. Changer le defaut les repeindrait tous les
 * quatre ; seul l'appelant concerne demande l'autre registre.
 * @param {object} root0 Proprietes.
 * @param {string} [root0.label] Intitule affiche au-dessus du compteur.
 * @param {number} [root0.max] Valeur maximale atteignable.
 * @param {number} [root0.min] Valeur minimale atteignable.
 * @param {() => void} root0.onDecrement Appele au « - ».
 * @param {() => void} root0.onIncrement Appele au « + ».
 * @param {'surface' | 'tunnel'} [root0.tone] Registre visuel.
 * @param {number} root0.value Valeur courante.
 * @returns {import('react').ReactElement} Le compteur rendu.
 */
function InputStepper({
  label, max = 100, min = 0, onDecrement, onIncrement, tone = 'surface', value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const isTunnelTone = tone === 'tunnel';
  const containerStyle = isTunnelTone
    ? {
      backgroundColor: 'rgba(4, 31, 44, 0.82)',
      borderColor: 'rgba(1, 179, 244, 0.24)',
      borderRadius: 16,
      borderWidth: 1,
      padding: 8,
    }
    : { backgroundColor: Colors.neutral100, borderRadius: 8, padding: 4 };
  const buttonStyle = isTunnelTone
    ? {
      backgroundColor: 'rgba(1, 179, 244, 0.12)',
      borderColor: 'rgba(1, 179, 244, 0.28)',
      borderRadius: 16,
      borderWidth: 1,
    }
    : { backgroundColor: Colors.neutral00, borderRadius: 6 };
  const signStyle = isTunnelTone ? Fonts.primary500 : Fonts.primary700;
  const valueStyle = isTunnelTone ? Fonts.neutral00 : Fonts.neutral900;
  const labelStyle = isTunnelTone ? Fonts.neutral200 : Fonts.neutral300;

  return (
    <View>
      {label && <Text style={[Fonts.p2, labelStyle, Spaces.marginBottom[8]]}>{label}</Text>}
      <View style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        containerStyle,
      ]}
      >
        <TouchableOpacity
          accessibilityLabel={`${t('common.previous')} ${label || ''}`.trim()}
          accessibilityRole="button"
          accessibilityState={{ disabled: value <= min }}
          disabled={value <= min}
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={onDecrement}
          style={[
            Spaces.padding[12],
            buttonStyle,
            value <= min && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, signStyle]}>-</Text>
        </TouchableOpacity>

        <Text style={[Fonts.h3, valueStyle]}>{value}</Text>

        <TouchableOpacity
          accessibilityLabel={`${t('common.next')} ${label || ''}`.trim()}
          accessibilityRole="button"
          accessibilityState={{ disabled: value >= max }}
          disabled={value >= max}
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={onIncrement}
          style={[
            Spaces.padding[12],
            buttonStyle,
            value >= max && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, signStyle]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default InputStepper;
