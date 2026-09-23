import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { VOICE_LOCK_TY } from '@/services/chat/voiceWaveform';

// VOCAL — LE CADENAS AU-DESSUS DU MICRO (maquette, état 2, mesures M2).
//
// 44 × 96, rayon 22, posé 22 au-dessus de la rangée (12 au-dessus du micro
// agrandi). Le doigt monte : le cadenas descend à sa rencontre (96 → 64,
// ancré en bas) et son chevron s'efface. À −80 : l'anse se ferme (Unlock →
// Lock), le cadenas se replie à 44 et laisse la place au bouton Stop.
// C'est un dessin, pas un bouton : le lecteur d'écran l'ignore.

/**
 * Le cadenas.
 * @param {{ motion: any }} props - Les valeurs animées partagées.
 * @returns {import('react').ReactElement} Le cadenas.
 */
function VoiceLockPillar({ motion }) {
  const { Colors } = useTheme();

  const pilier = useAnimatedStyle(() => {
    const monte = Math.min(1, Math.max(0, motion.ty.value / VOICE_LOCK_TY));
    const hauteurSuivie = 96 - (32 * monte);
    return {
      height: hauteurSuivie + ((44 - hauteurSuivie) * motion.cadenasRepli.value),
      opacity: motion.cadenas.value,
      transform: [{ translateY: motion.cadenasTy.value }],
    };
  });
  const ouvert = useAnimatedStyle(() => ({ opacity: 1 - motion.cadenasFerme.value }));
  const ferme = useAnimatedStyle(() => ({ opacity: motion.cadenasFerme.value }));
  const chevron = useAnimatedStyle(() => {
    const monte = Math.min(1, Math.max(0, motion.ty.value / VOICE_LOCK_TY));
    return {
      opacity: (1 - monte) * (1 - motion.cadenasFerme.value),
      transform: [{ translateY: motion.chevron.value }],
    };
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.pilier, ombre(Colors), {
        backgroundColor: Colors.primary700,
        borderColor: withAlpha(Colors.neutral00, 0.08),
      }, pilier]}
      testID="voice-lock"
    >
      <View style={styles.anse}>
        <Animated.View style={[StyleSheet.absoluteFill, ouvert]}>
          <GlyphIcon color={Colors.neutral00} name="lockOpen" size={20} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, ferme]}>
          <GlyphIcon color={Colors.neutral00} name="lockShut" size={20} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.chevron, chevron]}>
        <GlyphIcon color={Colors.neutral300} name="chevronUp" size={16} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * L'ombre du cadenas et du bouton Stop : 0 6 16, noir à 35 %.
 * @param {any} Colors - Les couleurs du thème.
 * @returns {object} Le style d'ombre.
 */
export const ombre = (Colors) => ({
  elevation: 8,
  shadowColor: Colors.neutral900,
  shadowOffset: { height: 6, width: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
});

const styles = StyleSheet.create({
  anse: {
    height: 20,
    marginTop: 12,
    width: 20,
  },
  chevron: {
    marginTop: 6,
  },
  pilier: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    bottom: 44 + 22,
    // Pas de `overflow: hidden` : sur iPhone, il couperait l'ombre. Le chevron,
    // seul à dépasser quand le cadenas se replie, s'est déjà effacé.
    position: 'absolute',
    right: 0,
    width: 44,
  },
});

export default memo(VoiceLockPillar);
