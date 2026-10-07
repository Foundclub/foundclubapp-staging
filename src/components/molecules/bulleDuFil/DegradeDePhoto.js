import { StyleSheet, View } from 'react-native';
import {
  Defs, LinearGradient, Rect, Stop, Svg,
} from 'react-native-svg';

import useTheme from '@/theme/themeContext';

/**
 * MSG1A (§3.1) — LE DEGRADE DU BAS D'UNE PHOTO DU FIL (SPECS.md §1, `PhotoBody`).
 *
 * 44 de haut, du transparent au noir a 55 % : l'heure et les coches, en blanc, se lisent
 * sur n'importe quelle photo. Dessine avec `react-native-svg` (deja dans l'app et doublee
 * dans les temoins) plutot qu'avec `react-native-linear-gradient`, que jest ne transforme
 * pas et qui ferait tomber toutes les suites de l'ecran de conversation.
 * @returns {import('react').ReactElement} Le degrade, pose en bas de son parent.
 */
function DegradeDePhoto() {
  const { Colors } = useTheme();
  return (
    <View pointerEvents="none" style={styles.bas}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 10 10" width="100%">
        <Defs>
          <LinearGradient id="degrade-de-photo" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={Colors.neutral900} stopOpacity="0" />
            <Stop offset="1" stopColor={Colors.neutral900} stopOpacity="0.55" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#degrade-de-photo)" height="10" width="10" x="0" y="0" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bas: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    bottom: 0,
    height: 44,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
});

export default DegradeDePhoto;
