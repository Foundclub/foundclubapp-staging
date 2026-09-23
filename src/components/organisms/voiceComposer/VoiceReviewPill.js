import {
  memo,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import useVoiceProgress from '@/components/molecules/voiceWave/useVoiceProgress';
import VoiceStaticWave from '@/components/molecules/voiceWave/VoiceStaticWave';
import { easeOut } from '@/components/organisms/voiceComposer/voiceMotion';

import {
  bucketPeaks,
  formatVoiceClock,
  storedWaveformToLevels,
} from '@/services/chat/voiceWaveform';

import useAudioPlayback from '@/hooks/useAudioPlayback';

// VOCAL — LA PASTILLE DE RÉÉCOUTE AVANT ENVOI (maquette, état 3B, M3).
//
// Même rangée que le verrouillé : Supprimer à gauche, Envoyer à droite, et au
// milieu la prise ENTIÈRE — lecture Ø 36 (zone 44), l'onde de toute la prise
// (barres 2 / 4) qui se remplit en cyan pendant la lecture, la durée (totale à
// l'arrêt, écoulée pendant la lecture). Les barres montent en cascade à
// l'ouverture (8 ms par barre), sauf si le téléphone réduit les animations.

const PAS = 4;
const LARGEUR_BARRE = 2;

/**
 * La pastille de réécoute.
 * @param {{
 *   actif: boolean,
 *   brouillon: null | { durationMs: number, levels?: number[], uri: string, waveform?: number[] },
 *   motion: any,
 *   reduire: boolean,
 * }} props - `brouillon` : la prise (null tant que le micro s'arrête).
 * @returns {import('react').ReactElement} La pastille.
 */
function VoiceReviewPill({
  actif, brouillon, motion, reduire,
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const [largeurOnde, setLargeurOnde] = useState(0);
  const {
    durationMs,
    endedAt,
    isPlaying,
    positionMs,
    speed,
    togglePlayback,
  } = useAudioPlayback({ sourceUrl: brouillon?.uri || '' });
  const totalMs = Math.max(Number(brouillon?.durationMs) || 0, Number(durationMs) || 0);
  const { opaciteLue, progression } = useVoiceProgress({
    dureeMs: totalMs,
    enLecture: Boolean(isPlaying),
    finiLe: Number(endedAt) || 0,
    positionMs: Number(positionMs) || 0,
    vitesse: Number(speed) || 1,
  });

  // L'onde de TOUTE la prise : un pic par tranche, autant de barres que la
  // pastille en contient (≈ 38).
  const niveaux = useMemo(() => {
    if (!brouillon || largeurOnde <= 0) return [];
    const source = Array.isArray(brouillon.levels) && brouillon.levels.length > 0
      ? brouillon.levels
      : storedWaveformToLevels(brouillon.waveform);
    const nombre = Math.max(1, Math.floor((largeurOnde + (PAS - LARGEUR_BARRE)) / PAS));
    return bucketPeaks(source, nombre);
  }, [brouillon, largeurOnde]);

  // ▶ ↔ ❚❚ : fondu croisé + scale 0,8 → 1 (120 ms easeOut).
  const lecture = useSharedValue(0);
  useEffect(() => {
    lecture.value = easeOut(isPlaying ? 1 : 0, 120);
  }, [isPlaying, lecture]);
  const triangle = useAnimatedStyle(() => ({
    opacity: 1 - lecture.value,
    transform: [{ scale: 1 - (0.2 * lecture.value) }],
  }));
  const barres = useAnimatedStyle(() => ({
    opacity: lecture.value,
    transform: [{ scale: 0.8 + (0.2 * lecture.value) }],
  }));
  const pastille = useAnimatedStyle(() => ({ opacity: motion.pastille.value }));

  return (
    <Animated.View
      pointerEvents={actif ? 'box-none' : 'none'}
      style={[styles.pastille, {
        backgroundColor: Colors.primary800,
        borderColor: Colors.primary700,
      }, pastille]}
      testID="voice-review-pill"
    >
      <Pressable
        accessibilityLabel={isPlaying
          ? t('voiceComposer.pause', 'Mettre en pause')
          : t('voiceComposer.replay', 'Réécouter')}
        accessibilityRole="button"
        disabled={!brouillon}
        hitSlop={4}
        onPress={togglePlayback}
        style={[styles.lecture, { backgroundColor: Colors.primary500 }]}
        testID="voice-review-play"
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.centre, triangle]}>
          <GlyphIcon color={Colors.primary900} name="play" size={19.2} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.centre, barres]}>
          <GlyphIcon color={Colors.primary900} name="pause" size={19.2} />
        </Animated.View>
      </Pressable>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(evenement) => setLargeurOnde(evenement.nativeEvent.layout.width)}
        style={styles.onde}
      >
        {niveaux.length > 0 ? (
          <VoiceStaticWave
            couleurLue={Colors.primary500}
            couleurNonLue={withAlpha(Colors.neutral00, 0.38)}
            largeurBarre={LARGEUR_BARRE}
            montee={reduire ? null : { duree: 200, pas: 8 }}
            niveaux={niveaux}
            opaciteLue={opaciteLue}
            pas={PAS}
            progression={progression}
          />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{
          ...Fonts.p2Bold,
          color: Colors.neutral00,
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
          width: 34,
        }}
        testID="voice-review-time"
      >
        {formatVoiceClock(isPlaying ? positionMs : totalMs)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lecture: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  onde: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  pastille: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    height: 44,
    left: 52,
    paddingLeft: 3,
    paddingRight: 13,
    position: 'absolute',
    right: 52,
  },
});

export default memo(VoiceReviewPill);
