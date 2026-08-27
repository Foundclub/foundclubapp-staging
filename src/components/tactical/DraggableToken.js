import {
  Image, StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import TacticalPlayerToken, { useTokenIdentity } from './TacticalPlayerToken';

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 */

/**
 * La taille DESSINEE du jeton fantome, publiee parce que c'est elle qui met le
 * doigt au centre de l'apercu : qui pilote le fantome doit retrancher sa moitie
 * a la position du doigt. Les ecrans la recopiaient a la main (`GHOST_SIZE = 64`
 * alors que le jeton fait 70 x 88), et l'apercu tombait a cote de 3 px en
 * largeur et 12 px en hauteur.
 */
export const GHOST_TOKEN_SIZE = Object.freeze({ height: 88, width: 70 });

/**
 * DraggableToken - Player token for tactical board
 * Stateless component - position controlled by parent via Animated style
 *
 * 🧩 COMPOLECT-2 — CE FICHIER NE PORTE PLUS QUE LE FANTOME. Les deux autres
 * apparences (terrain, banc) vivent dans `TacticalPlayerToken`, qui n a AUCUNE
 * dependance au moteur d animation. Motif : `react-native-reanimated` n est pas
 * analysable par jest, et ne servait qu au fantome — le faire suivre le jeton
 * partout rendait 21 suites rouges des qu un ecran sans glissement voulait
 * dessiner un joueur (mesure du 27/08).
 * ⚠️ L API de ce composant est INCHANGEE, volontairement : les 6 ecrans qui
 * l emploient et leurs doubles de test n ont pas une ligne a modifier.
 * @param {object} props
 * @param {TacticalPlayer} props.player
 * @param {boolean} [props.isOnField] - Different style for field vs bench
 * @param {boolean} [props.isGhost] - Ghost/Clone style for dragging
 * @param {import('react-native-reanimated').SharedValue<number>} [props.translateX]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.translateY]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.scale]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.opacity]
 */
function DraggableToken({
  isGhost = false,
  isOnField = false,
  opacity,
  player,
  scale,
  translateX,
  translateY,
}) {
  const { Colors } = useTheme();
  const { avatarUri, initials } = useTokenIdentity(player);

  // Animated style for ghost token (follows finger)
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    if (!isGhost || !translateX || !translateY) return {};

    return {
      opacity: opacity?.value ?? 1,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale?.value ?? 1 },
      ],
    };
  });

  // Ghost Token - Absolute positioned, follows finger
  if (isGhost) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ghostToken,
          {
            backgroundColor: Colors.primary500,
            borderColor: Colors.neutral00,
            shadowColor: Colors.primary500,
          },
          animatedStyle,
        ]}
      >
        <View style={styles.ghostAvatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.ghostAvatar} />
          ) : (
            <Text style={styles.ghostInitials}>{initials}</Text>
          )}
        </View>
        <Text numberOfLines={1} style={styles.ghostName}>{player?.firstname || ''}</Text>
      </Animated.View>
    );
  }

  return <TacticalPlayerToken isOnField={isOnField} player={player} />;
}

const styles = StyleSheet.create({
  // === GHOST TOKEN (Dragging overlay) ===
  ghostAvatar: {
    borderRadius: 26,
    height: 52,
    width: 52,
  },
  ghostAvatarContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  ghostInitials: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  ghostName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  ghostToken: {
    alignItems: 'center',
    borderRadius: 35,
    borderWidth: 3,
    elevation: 30,
    height: GHOST_TOKEN_SIZE.height,
    paddingTop: 6,
    position: 'absolute',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    width: GHOST_TOKEN_SIZE.width,
  },
});

export default DraggableToken;
