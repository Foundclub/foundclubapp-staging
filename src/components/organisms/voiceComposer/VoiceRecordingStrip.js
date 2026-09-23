import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { VOICE_CANCEL_TX } from '@/services/chat/voiceWaveform';

import VoiceChrono from './VoiceChrono';
import VoiceLiveWave from './VoiceLiveWave';

// VOCAL — LA BANDE D'ENREGISTREMENT (maquette, états 2 et 3A, mesures M2).
//
// Elle prend la place du + et du champ, à la même hauteur (44), et y pose :
// le point rouge qui clignote, le chronomètre, l'onde qui défile, et
// « ‹ Glisser pour annuler » qui oscille. Glisser à gauche la vide 1:1 (indice
// qui suit le doigt et s'efface, onde qui pâlit jusqu'à 0,3). Verrouillé, elle
// glisse de 12 à 64 et l'onde récupère la place de l'indice.
//
// Mesures (M2) : bord 1, puis 13 · point 10 · 8 · chrono 34 · 10 · onde · 8 ·
// indice · 7, soit 14 / 8 à l'extérieur du bord, comme la planche.

/**
 * La bande d'enregistrement.
 * @param {{
 *   generation: number,
 *   motion: any,
 *   subscribeTick: (ecouteur: (niveau: number, dureeMs: number) => void) => () => void,
 * }} props - `generation` change à chaque nouvelle prise : l'onde et le chrono repartent de zéro.
 * @returns {import('react').ReactElement} La bande.
 */
function VoiceRecordingStrip({ generation, motion, subscribeTick }) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();

  const bande = useAnimatedStyle(() => ({
    left: motion.bandeGauche.value,
    opacity: motion.bande.value,
    transform: [{ translateX: motion.bandeDecalage.value }],
  }));
  const point = useAnimatedStyle(() => ({ opacity: motion.point.value }));
  const corbeille = useAnimatedStyle(() => ({
    opacity: motion.corbeille.value,
    transform: [{ scale: motion.corbeilleEchelle.value }],
  }));
  const onde = useAnimatedStyle(() => {
    const glisse = Math.min(1, Math.max(0, motion.tx.value / VOICE_CANCEL_TX));
    return {
      opacity: (1 - (0.7 * glisse)) * (1 - motion.ondeRepli.value),
      transform: [{ scaleY: 1 - (0.9 * motion.ondeRepli.value) }],
    };
  });
  const indice = useAnimatedStyle(() => {
    const glisse = Math.min(1, Math.max(0, motion.tx.value / VOICE_CANCEL_TX));
    const balance = motion.indiceArrete.value ? 0 : motion.balancier.value;
    const largeur = motion.largeurIndice.value;
    return {
      marginLeft: 8 * motion.indiceLargeur.value,
      opacity: motion.indice.value * (1 - glisse),
      transform: [{ translateX: motion.tx.value + balance }],
      // Tant que l'indice n'est pas mesuré, il prend sa largeur naturelle.
      ...(largeur > 0 ? { width: largeur * motion.indiceLargeur.value } : null),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bande, {
        backgroundColor: Colors.primary800,
        borderColor: Colors.primary700,
      }, bande]}
      testID="voice-recording-strip"
    >
      <View style={styles.pointCadre}>
        <Animated.View style={[styles.point, { backgroundColor: Colors.error500 }, point]} />
        {/* Annulé : le point devient une corbeille, qui grandit puis s'efface. */}
        <Animated.View style={[styles.corbeille, corbeille]}>
          <GlyphIcon color={Colors.error500} name="trashAlt" size={18} />
        </Animated.View>
      </View>
      <View style={styles.chrono}>
        <VoiceChrono generation={generation} subscribeTick={subscribeTick} />
      </View>
      <Animated.View style={[styles.onde, onde]}>
        <VoiceLiveWave
          couleur={Colors.neutral00}
          generation={generation}
          subscribeTick={subscribeTick}
        />
      </Animated.View>
      <Animated.View
        onLayout={(evenement) => {
          // La largeur naturelle de l'indice (elle dépend de la langue), mesurée
          // une fois : c'est d'elle que l'indice se replie au verrouillage.
          const largeurNaturelle = evenement.nativeEvent.layout.width;
          if (motion.largeurIndice.value === 0 && largeurNaturelle > 0) {
            // eslint-disable-next-line no-param-reassign -- valeur partagée, faite pour être écrite
            motion.largeurIndice.value = largeurNaturelle;
          }
        }}
        style={[styles.indice, indice]}
      >
        <GlyphIcon color={Colors.neutral300} name="chevronLeft" size={16} />
        <Text
          numberOfLines={1}
          style={{ ...Fonts.p3, color: Colors.neutral300, lineHeight: 16 }}
        >
          {t('voiceComposer.slideToCancel', 'Glisser pour annuler')}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bande: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    height: 44,
    paddingLeft: 13,
    paddingRight: 7,
    position: 'absolute',
    right: 52,
  },
  chrono: {
    marginLeft: 8,
  },
  corbeille: {
    left: -4,
    position: 'absolute',
    top: -4,
  },
  indice: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    overflow: 'hidden',
  },
  onde: {
    flex: 1,
    marginLeft: 10,
  },
  point: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  pointCadre: {
    height: 10,
    width: 10,
  },
});

export default memo(VoiceRecordingStrip);
