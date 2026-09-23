import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { VOICE_EASE_OUT } from '@/components/organisms/voiceComposer/voiceMotion';

import { voiceBarHeight } from '@/services/chat/voiceWaveform';

// VOCAL — L'ONDE D'UN VOCAL ENREGISTRÉ, QUI SE REMPLIT PENDANT L'ÉCOUTE
// (maquette, « Forme d'onde » §4). Sert à la pastille de réécoute et à la bulle.
//
// Sans Skia : DEUX rangs de barres identiques, l'un « non lu », l'autre « lu ».
// Le rang « lu » est découpé par deux translations opposées — le cadre part à
// gauche, son contenu revient à droite d'autant — si bien que seule une
// transformation bouge, et que la barre en cours se colore À MOITIÉ, jamais
// par à-coups. La progression (0 → 1) est une valeur partagée animée sur le
// fil d'animation par le propriétaire du lecteur.

/**
 * Une animation d'entrée : la barre monte (scaleY 0 → 1), avec un décalage.
 * @param {number} delai - Le décalage de cette barre.
 * @param {number} duree - La durée de la montée.
 * @returns {() => any} L'animation d'entrée, pour Reanimated.
 */
const monteeDeBarre = (delai, duree) => () => {
  'worklet';

  return {
    animations: {
      transform: [{ scaleY: withDelay(delai, withTiming(1, { duration: duree, easing: VOICE_EASE_OUT })) }],
    },
    initialValues: { transform: [{ scaleY: 0 }] },
  };
};

/**
 * Un rang de barres.
 * @param {{
 *   couleur: string,
 *   hauteurs: number[],
 *   largeurBarre: number,
 *   pas: number,
 *   montee: null | { pas: number, duree: number },
 * }} props - Le rang.
 * @returns {import('react').ReactElement} Le rang.
 */
function RangBrut({
  couleur, hauteurs, largeurBarre, montee, pas,
}) {
  return (
    <View style={styles.rang}>
      {hauteurs.map((hauteur, rang) => {
        const style = {
          backgroundColor: couleur,
          borderRadius: largeurBarre / 2,
          height: hauteur,
          marginLeft: rang === 0 ? 0 : pas - largeurBarre,
          width: largeurBarre,
        };
        return montee ? (
          <Animated.View
            entering={monteeDeBarre(rang * montee.pas, montee.duree)}
          // eslint-disable-next-line react/no-array-index-key -- une barre = une tranche du vocal
            key={rang}
            style={style}
          />
        ) : (
        // eslint-disable-next-line react/no-array-index-key -- une barre = une tranche du vocal
          <View key={rang} style={style} testID="voice-static-bar" />
        );
      })}
    </View>
  );
}
const Rang = memo(RangBrut);

/**
 * L'onde figée et son remplissage.
 * @param {{
 *   niveaux: number[],
 *   largeurBarre: number,
 *   pas: number,
 *   couleurNonLue: string,
 *   couleurLue: string,
 *   progression: { value: number },
 *   opaciteLue?: { value: number },
 *   montee?: null | { pas: number, duree: number },
 * }} props - `niveaux` déjà réduits à une valeur par barre (0 → 1).
 * @returns {import('react').ReactElement} L'onde.
 */
function VoiceStaticWave({
  couleurLue,
  couleurNonLue,
  largeurBarre,
  montee = null,
  niveaux,
  opaciteLue,
  pas,
  progression,
}) {
  const hauteurs = niveaux.map((niveau) => voiceBarHeight(niveau));
  const largeur = Math.max(0, (hauteurs.length * pas) - (pas - largeurBarre));

  const cadre = useAnimatedStyle(() => ({
    opacity: opaciteLue ? opaciteLue.value : 1,
    transform: [{ translateX: -(1 - Math.min(1, Math.max(0, progression.value))) * largeur }],
  }));
  const contenu = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - Math.min(1, Math.max(0, progression.value))) * largeur }],
  }));

  return (
    <View
      pointerEvents="none"
      style={{ height: 28, width: largeur }}
    >
      <Rang
        couleur={couleurNonLue}
        hauteurs={hauteurs}
        largeurBarre={largeurBarre}
        montee={montee}
        pas={pas}
      />
      <Animated.View style={[styles.decoupe, { width: largeur }, cadre]}>
        <Animated.View style={[StyleSheet.absoluteFill, contenu]}>
          <Rang
            couleur={couleurLue}
            hauteurs={hauteurs}
            largeurBarre={largeurBarre}
            montee={montee}
            pas={pas}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  decoupe: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  rang: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 0,
  },
});

export default memo(VoiceStaticWave);
