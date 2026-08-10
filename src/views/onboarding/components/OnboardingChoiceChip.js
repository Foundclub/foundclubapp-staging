import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import useTheme from '@/theme/themeContext';

// D56 — LA SECONDE GRAMMAIRE du pack d'inscription, celle des grilles :
// « grilles de chips 48 pt a REMPLISSAGE CYAN ».
//
// Ce qu'elle corrige : les chips choisies portaient un fond cyan tres pale
// (`${Colors.primary500}20`), un texte cyan et une coche « ✓ » en texte. Trois
// signaux faibles la ou le pack en veut UN fort — la chip se remplit.
//
// 🎨 L'encre sur cyan est `primary900`, jamais du clair : `primary100` sur
// `primary500` vaut 2,18:1 et echoue au WCAG AA. Decision Adel du 2026-07-14,
// consignee dans THEME.md et deja appliquee par `atoms/tabButton`.

const CHIP_MIN_HEIGHT = 48;
const CHIP_MIN_WIDTH = 70;

/**
 * Chip de selection des grilles de l'inscription.
 * @param {object} props - Component props.
 * @param {boolean} props.checked - Chip choisie.
 * @param {string} props.label - Libelle affiche.
 * @param {() => void} props.onPress - Selection de la chip.
 * @param {boolean} [props.multi] - Grille a choix multiple (case a cocher).
 * @returns {import('react').ReactElement} La chip.
 */
function OnboardingChoiceChip({
  checked,
  label,
  multi = false,
  onPress,
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[
        Spaces.paddingHorizontal[16],
        styles.chip,
        {
          backgroundColor: checked ? Colors.primary500 : Colors.neutral800,
          borderColor: checked ? Colors.primary500 : Colors.neutral700,
        },
      ]}
    >
      <Text
        style={[
          Fonts.p1Bold,
          { color: checked ? Colors.primary900 : Colors.neutral00 },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: CHIP_MIN_HEIGHT,
    minWidth: CHIP_MIN_WIDTH,
  },
});

export default OnboardingChoiceChip;
