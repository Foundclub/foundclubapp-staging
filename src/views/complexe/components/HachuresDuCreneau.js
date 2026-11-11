import { View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

// Assez de traits pour couvrir la plus large case de la grille, une fois tournés.
const TRAITS = Array.from({ length: 80 }, (_v, index) => index);

/**
 * GERANT-CONSTRUCTION (11/11/2026, D50) — LE HACHURÉ ORANGE D'UNE RÉSERVATION « EN
 * CONSTRUCTION », dans la frise de l'accueil et la grille du planning (maquette
 * gerant-accueil.png : « Le hachuré la distingue sans compter sur la couleur »). Des traits fins
 * tournés de 45°, sous le texte, dans une case qui coupe ce qui dépasse (`overflow: 'hidden'`,
 * `styleDuCreneau`). Il ne capte aucun appui.
 * ponytail: des vues plutôt qu'un dégradé répété (que React Native ne sait pas dessiner) ; 80
 * traits couvrent une case de 600 px ; au-delà, la fin de la case n'est que teintée.
 * @returns {import('react').ReactElement} Le hachuré.
 */
function HachuresDuCreneau() {
  const { Colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0,
      }}
      testID="hachures-creneau"
    >
      <View
        style={{
          flexDirection: 'row',
          height: 640,
          left: -160,
          position: 'absolute',
          top: -300,
          transform: [{ rotate: '45deg' }],
        }}
      >
        {TRAITS.map((trait) => (
          <View
            key={trait}
            style={{ backgroundColor: withAlpha(Colors.warning500, 0.5), marginRight: 5, width: 3 }}
          />
        ))}
      </View>
    </View>
  );
}

export default HachuresDuCreneau;
