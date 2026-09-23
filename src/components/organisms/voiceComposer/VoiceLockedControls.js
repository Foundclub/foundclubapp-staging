import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { ombre } from './VoiceLockPillar';

// VOCAL — LES DEUX BOUTONS DU VERROUILLÉ (maquette, états 3A et 3B, M3).
//
// Supprimer prend la place du + (44, sans fond, corbeille rouge 5,1:1 sur la
// barre) ; Stop prend la place du cadenas, dont il est la suite (Ø 44, carré
// rouge de 14). Chacun est un vrai bouton : c'est aussi l'alternative au
// « glisser pour annuler » pour qui ne peut pas glisser.

/**
 * Le bouton Supprimer.
 * @param {{ actif: boolean, motion: any, onPress: () => void }} props - `actif` :
 *   il capte le doigt (verrouillé ou réécoute).
 * @returns {import('react').ReactElement} Le bouton.
 */
function VoiceTrashButtonBrut({ actif, motion, onPress }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const style = useAnimatedStyle(() => ({
    opacity: motion.supprimer.value,
    transform: [{ scale: motion.supprimerEchelle.value }],
  }));
  return (
    <Animated.View pointerEvents={actif ? 'auto' : 'none'} style={[styles.supprimer, style]}>
      <Pressable
        accessibilityElementsHidden={!actif}
        accessibilityLabel={t('voiceComposer.delete', "Supprimer l'enregistrement")}
        accessibilityRole="button"
        importantForAccessibility={actif ? 'auto' : 'no-hide-descendants'}
        onPress={onPress}
        style={styles.cible}
        testID="voice-trash"
      >
        <GlyphIcon color={Colors.error500} name="trashAlt" size={22} />
      </Pressable>
    </Animated.View>
  );
}
export const VoiceTrashButton = memo(VoiceTrashButtonBrut);

/**
 * Le bouton Stop : arrête la prise et ouvre la réécoute.
 * @param {{ actif: boolean, motion: any, onPress: () => void }} props - `actif` :
 *   il capte le doigt (verrouillé seulement).
 * @returns {import('react').ReactElement} Le bouton.
 */
function VoiceStopButtonBrut({ actif, motion, onPress }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const style = useAnimatedStyle(() => ({
    opacity: motion.stop.value,
    transform: [{ scale: motion.stopEchelle.value }],
  }));
  return (
    <Animated.View
      pointerEvents={actif ? 'auto' : 'none'}
      style={[styles.stop, ombre(Colors), {
        backgroundColor: Colors.primary700,
        borderColor: withAlpha(Colors.neutral00, 0.08),
      }, style]}
    >
      <Pressable
        accessibilityElementsHidden={!actif}
        accessibilityLabel={t('voiceComposer.stop', 'Arrêter et réécouter')}
        accessibilityRole="button"
        importantForAccessibility={actif ? 'auto' : 'no-hide-descendants'}
        onPress={onPress}
        style={styles.cible}
        testID="voice-stop"
      >
        <View style={[styles.carre, { backgroundColor: Colors.error500 }]} />
      </Pressable>
    </Animated.View>
  );
}
export const VoiceStopButton = memo(VoiceStopButtonBrut);

const styles = StyleSheet.create({
  carre: {
    borderRadius: 3,
    height: 14,
    width: 14,
  },
  cible: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stop: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    bottom: 44 + 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 44,
  },
  supprimer: {
    bottom: 0,
    height: 44,
    left: 0,
    position: 'absolute',
    width: 44,
  },
});
