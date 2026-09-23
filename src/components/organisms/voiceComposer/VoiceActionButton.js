import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import {
  resolveGestureAxis,
  VOICE_CANCEL_TX,
  VOICE_HOLD_ACTIVATION_MS,
  VOICE_LOCK_TY,
} from '@/services/chat/voiceWaveform';

// VOCAL — LE BOUTON À DROITE DE LA BARRE : le micro, qui devient Envoyer.
//
// Au repos : un rond cyan de 44, glyphe à l'encre sombre (8,0:1 — question 3
// de la maquette, tranchée par le chef d'orchestre). Maintenu 200 ms : il
// grossit (44 → 64), rougit, et un halo suit la voix. Le doigt glisse :
// le bouton le suit 1:1 (borné à −120 à gauche, −80 en haut). Verrouillé ou
// en réécoute : c'est le bouton Envoyer, à la même place.
//
// ✋ LES GESTES (section « Gestes ») :
// `Exclusive(Pan().activateAfterLongPress(200), Tap().maxDuration(200))`.
// Le micro s'ouvre dès le toucher (`onBegin`), pour ne pas couper la
// première syllabe ; si le geste échoue avant 200 ms, la prise est jetée sans
// bruit et le toucher court montre la bulle d'aide. Les seuils sont franchis
// sur le fil d'animation : l'annulation part AU franchissement, sans attendre
// le relâché.

/** Le micro agrandi pendant l'appui : 64 / 44. */
export const VOICE_MIC_HOLD_SCALE = 64 / 44;

/**
 * Le bouton micro / Envoyer.
 * @param {{
 *   actif: boolean,
 *   mode: 'micro' | 'envoyer',
 *   motion: any,
 *   onAbortArming: () => void,
 *   onActivateHold: () => void,
 *   onCancel: () => void,
 *   onInterrupt: () => void,
 *   onLock: () => void,
 *   onPressIn: () => void,
 *   onRelease: () => void,
 *   onScreenReaderStart: () => void,
 *   onSend: () => void,
 *   onShowTip: () => void,
 *   onUnavailable: () => void,
 *   visible: boolean,
 * }} props - `actif` : le micro sait enregistrer sur ce téléphone ; `mode` :
 *   micro au repos et pendant l'appui, Envoyer ensuite.
 * @returns {import('react').ReactElement} Le bouton.
 */
function VoiceActionButton({
  actif,
  mode,
  motion,
  onAbortArming,
  onActivateHold,
  onCancel,
  onInterrupt,
  onLock,
  onPressIn,
  onRelease,
  onScreenReaderStart,
  onSend,
  onShowTip,
  onUnavailable,
  visible,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const cyan = Colors.primary500;
  const rouge = Colors.error500;
  const encre = Colors.primary900;
  const blanc = Colors.neutral00;
  // Les valeurs que le geste écrit, tirées de la boîte partagée.
  const {
    active, axe, fini, indiceArrete, tx, ty,
  } = motion;

  const geste = useMemo(() => {
    const appui = Gesture.Pan()
      .activateAfterLongPress(VOICE_HOLD_ACTIVATION_MS)
      .onBegin(() => {
        'worklet';

        runOnJS(onPressIn)();
      })
      .onStart(() => {
        'worklet';

        active.value = true;
        fini.value = false;
        axe.value = null;
        runOnJS(onActivateHold)();
      })
      .onUpdate((evenement) => {
        'worklet';

        if (!active.value || fini.value) return;
        const dx = evenement.translationX;
        const dy = evenement.translationY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) indiceArrete.value = 1;
        const sens = resolveGestureAxis(dx, dy, axe.value);
        axe.value = sens;
        if (sens === 'x') {
          tx.value = Math.min(0, Math.max(VOICE_CANCEL_TX, dx));
          if (dx <= VOICE_CANCEL_TX) {
            fini.value = true;
            runOnJS(onCancel)();
          }
        } else if (sens === 'y') {
          ty.value = Math.min(0, Math.max(VOICE_LOCK_TY, dy));
          if (dy <= VOICE_LOCK_TY) {
            fini.value = true;
            runOnJS(onLock)();
          }
        }
      })
      .onEnd((_evenement, reussi) => {
        'worklet';

        if (!active.value || fini.value) return;
        // Relâché : ça part. Interrompu par le système : réécoute, rien n'est perdu.
        runOnJS(reussi ? onRelease : onInterrupt)();
      })
      .onFinalize(() => {
        'worklet';

        if (!active.value) runOnJS(onAbortArming)();
        active.value = false;
      });
    const toucher = Gesture.Tap()
      .maxDuration(VOICE_HOLD_ACTIVATION_MS)
      .onEnd((_evenement, reussi) => {
        'worklet';

        if (reussi) runOnJS(onShowTip)();
      });
    return Gesture.Exclusive(appui, toucher);
  }, [
    active, axe, fini, indiceArrete, onAbortArming, onActivateHold, onCancel, onInterrupt, onLock,
    onPressIn, onRelease, onShowTip, tx, ty,
  ]);

  const suivi = useAnimatedStyle(() => ({
    opacity: motion.visible.value,
    transform: [{ translateX: motion.tx.value }, { translateY: motion.ty.value }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: motion.halo.value,
    transform: [{ scale: motion.haloEchelle.value }],
  }));
  const gris = Colors.neutral700;
  const rond = useAnimatedStyle(() => ({
    backgroundColor: actif ? interpolateColor(motion.rouge.value, [0, 1], [cyan, rouge]) : gris,
    opacity: actif ? 1 : 0.6,
    transform: [{ scale: motion.echelle.value }],
  }), [actif, cyan, gris, rouge]);
  const microSombre = useAnimatedStyle(() => ({
    opacity: (1 - motion.rouge.value) * (1 - motion.envoyer.value),
  }));
  const microBlanc = useAnimatedStyle(() => ({
    opacity: motion.rouge.value * (1 - motion.envoyer.value),
  }));
  const envoyer = useAnimatedStyle(() => ({
    opacity: motion.envoyer.value,
    transform: [
      { rotate: `${-30 * (1 - motion.envoyer.value)}deg` },
      { scale: 0.6 + (0.4 * motion.envoyer.value) },
    ],
  }));

  const glyphes = (
    <Animated.View style={[styles.rond, rond]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.centre, microSombre]}>
        <GlyphIcon color={encre} name="microphone" size={22} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.centre, microBlanc]}>
        <GlyphIcon color={blanc} name="microphone" size={22} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.centre, envoyer]}>
        <GlyphIcon color={encre} name="send" size={22} />
      </Animated.View>
    </Animated.View>
  );

  let bouton;
  if (mode === 'envoyer') {
    bouton = (
      <Pressable
        accessibilityLabel={t('voiceComposer.send', 'Envoyer le message vocal')}
        accessibilityRole="button"
        onPress={onSend}
        testID="voice-send"
      >
        {glyphes}
      </Pressable>
    );
  } else if (!actif) {
    bouton = (
      <Pressable
        accessibilityLabel={t('voiceComposer.record', 'Enregistrer un message vocal')}
        accessibilityRole="button"
        onPress={onUnavailable}
        testID="voice-mic"
      >
        {glyphes}
      </Pressable>
    );
  } else {
    bouton = (
      <GestureDetector gesture={geste}>
        <View
          accessibilityActions={[{ label: t('voiceComposer.record', 'Enregistrer un message vocal'), name: 'activate' }]}
          accessibilityHint={t('voiceComposer.recordHint', 'Maintiens pour enregistrer, relâche pour envoyer.')}
          accessibilityLabel={t('voiceComposer.record', 'Enregistrer un message vocal')}
          accessibilityRole="button"
          accessible
          onAccessibilityAction={(evenement) => {
            // Lecteur d'écran : le double-tap ouvre directement le verrouillé.
            if (evenement.nativeEvent.actionName === 'activate') onScreenReaderStart();
          }}
          testID="voice-mic"
        >
          {glyphes}
        </View>
      </GestureDetector>
    );
  }

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.place, suivi]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { backgroundColor: withAlpha(rouge, 0.22) }, halo]}
      />
      {bouton}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ø 64 centré sur le micro : il déborde de 10 de chaque côté.
  halo: {
    borderRadius: 32,
    height: 64,
    left: -10,
    position: 'absolute',
    top: -10,
    width: 64,
  },
  place: {
    bottom: 0,
    height: 44,
    position: 'absolute',
    right: 0,
    width: 44,
  },
  rond: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
});

export default memo(VoiceActionButton);
