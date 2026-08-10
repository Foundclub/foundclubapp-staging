import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

// D56 — LA GRAMMAIRE DE SELECTION UNIQUE du pack d'inscription : une rangee
// d'au moins 56 pt, un vrai bouton radio de 24 pt a droite, et rien d'autre.
//
// Elle remplace le melange que le pack nomme comme defaut : « fini le melange
// carte remplie + X / fleches ». L'ancien motif remplissait la rangee de cyan
// quand elle etait choisie, et changeait une fleche en CROIX — deux signes qui
// disent « fermer », pas « choisi ».
//
// ⛔ VOLONTAIREMENT LOCAL a l'onboarding. L'atome partage
// `components/atoms/tabButton/TabButton` porte l'ancien motif, mais il vit
// aussi dans `views/profile/UserDetails.js` : le corriger la-bas depasse ce
// lot, et casserait un ecran que personne n'aurait mesure ici.

const RADIO_SIZE = 24;
const RADIO_DOT_SIZE = 12;
const ROW_MIN_HEIGHT = 56;

/**
 * Rangee-radio des ecrans de selection de l'inscription.
 * @param {object} props - Component props.
 * @param {boolean} props.checked - Rangee choisie.
 * @param {string} props.label - Libelle affiche.
 * @param {() => void} props.onPress - Selection de la rangee.
 * @param {string} [props.subtitle] - Precision facultative sous le libelle.
 * @param {string} [props.testID] - Identifiant de test.
 * @returns {import('react').ReactElement} La rangee.
 */
function OnboardingRadioRow({
  checked,
  label,
  onPress,
  subtitle = undefined,
  testID = undefined,
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[12],
        Spaces.gap[12],
        styles.row,
        {
          backgroundColor: checked
            ? withAlpha(Colors.primary500, 0.08)
            : Colors.neutral800,
          borderColor: checked ? Colors.primary500 : Colors.neutral700,
        },
      ]}
      testID={testID}
    >
      <View style={styles.labelColumn}>
        <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Le bouton radio lui-meme : cercle vide, point plein quand choisi. */}
      <View
        importantForAccessibility="no"
        style={[
          styles.radio,
          { borderColor: checked ? Colors.primary500 : Colors.neutral600 },
        ]}
      >
        {checked ? (
          <View style={[styles.radioDot, { backgroundColor: Colors.primary500 }]} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  labelColumn: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  radio: {
    alignItems: 'center',
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 2,
    flexShrink: 0,
    height: RADIO_SIZE,
    justifyContent: 'center',
    width: RADIO_SIZE,
  },
  radioDot: {
    borderRadius: RADIO_DOT_SIZE / 2,
    height: RADIO_DOT_SIZE,
    width: RADIO_DOT_SIZE,
  },
  row: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: ROW_MIN_HEIGHT,
  },
});

export default OnboardingRadioRow;
