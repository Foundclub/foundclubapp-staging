// @ts-nocheck
/**
 * CardSheen — CARTECODE Q10 B : le reflet de la carte GLISSE sous le doigt (à l'écran
 * seulement ; l'image partagée reste figée, reflet au repos). reanimated 3 et
 * gesture-handler, déjà installés : aucune dépendance neuve. Sans mouvement réduit demandé
 * par le système : sinon la carte reste telle quelle.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Le reflet qui suit le doigt, posé sur la carte.
 * @param {{
 *   children: import('react').ReactNode, height: number, width: number,
 * }} props
 * @returns {import('react').ReactElement}
 */
function CardSheen({
  children, height, width,
}) {
  // « Réduire les animations » du système : la carte reste telle quelle.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let actif = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((valeur) => { if (actif) setReduceMotion(Boolean(valeur)); })
      .catch(() => {});
    return () => { actif = false; };
  }, []);
  const position = useSharedValue(0);
  const visible = useSharedValue(0);

  // Un glissé horizontal déplace la lumière ; un glissé vertical laisse défiler l'écran.
  const geste = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onBegin((e) => {
        position.value = e.x / width - 0.5;
        visible.value = withTiming(1, { duration: 150 });
      })
      .onUpdate((e) => {
        position.value = e.x / width - 0.5;
      })
      .onFinalize(() => {
        visible.value = withTiming(0, { duration: 600 });
      }),
    [position, visible, width],
  );

  const bande = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateX: position.value * width * 1.2 }, { rotate: '20deg' }],
  }));

  if (reduceMotion) return children;

  return (
    <GestureDetector gesture={geste}>
      <View collapsable={false} style={{ height, width }}>
        {children}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: width * 0.044 }]}
        >
          <Animated.View
            style={[
              styles.bande,
              {
                height: height * 1.6,
                left: width * 0.1,
                top: -height * 0.3,
                width: width * 0.8,
              },
              bande,
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0)',
                'rgba(255,255,255,0.22)',
                'rgba(102,210,249,0.27)',
                'rgba(255,255,255,0)',
              ]}
              end={{ x: 1, y: 0.5 }}
              locations={[0.2, 0.46, 0.54, 0.8]}
              start={{ x: 0, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bande: { position: 'absolute' },
  clip: { overflow: 'hidden' },
});

export default CardSheen;
