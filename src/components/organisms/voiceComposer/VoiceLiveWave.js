import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { voiceBarHeight } from '@/services/chat/voiceWaveform';

// VOCAL — L'ONDE QUI DÉFILE PENDANT L'ENREGISTREMENT (maquette, « Forme d'onde » §2).
//
// Un tapis roulant : 1 barre = 1 niveau du micro (toutes les 50 ms). Le niveau
// arrive → la barre naît à DROITE, à sa hauteur exacte, dans la même image.
// Entre deux niveaux, le rang glisse de 4 px sur le fil d'animation : le
// défilement est continu (80 px/s), sans jamais interpoler une hauteur.
// Rien ici ne passe par un état React : aucun rendu par niveau.

/** 2 px de barre + 2 px d'écart. */
const PAS = 4;
const LARGEUR_BARRE = 2;
/** La largeur la plus grande que l'onde puisse prendre (verrouillé : ≈ 172). */
const CAPACITE = 200;
const NOMBRE = Math.ceil(CAPACITE / PAS) + 2;
/** Le fondu d'entrée, sur les 24 px de gauche : chaque barre y pâlit selon sa place. */
const FONDU = 24;

/**
 * Une barre du tapis : elle lit SON niveau dans la liste partagée.
 * @param {{ couleur: string, largeur: any, niveaux: any, rang: number }} props - La barre
 *   (`largeur` : celle de l'onde, pour le fondu de gauche).
 * @returns {import('react').ReactElement} La barre.
 */
function BarreVivanteBrute({
  couleur, largeur, niveaux, rang,
}) {
  const style = useAnimatedStyle(() => {
    const niveau = niveaux.value[rang];
    // La place de la barre depuis le bord gauche (le rang est calé à droite).
    const gauche = largeur.value - ((NOMBRE - rang) * PAS);
    return {
      height: voiceBarHeight(Math.max(0, niveau)),
      opacity: niveau < 0 ? 0 : Math.min(1, Math.max(0, gauche / FONDU)),
    };
  });
  return (
    <Animated.View
      style={[{
        backgroundColor: couleur,
        borderRadius: LARGEUR_BARRE / 2,
        marginLeft: rang === 0 ? 0 : PAS - LARGEUR_BARRE,
        width: LARGEUR_BARRE,
      }, style]}
    />
  );
}
const BarreVivante = memo(BarreVivanteBrute);

/**
 * L'onde vivante.
 * @param {{
 *   couleur: string,
 *   generation: number,
 *   subscribeTick: (ecouteur: (niveau: number) => void) => () => void,
 * }} props - `couleur` des barres, `generation` qui change à chaque prise (l'onde
 *   repart vide), `subscribeTick` la source des niveaux.
 * @returns {import('react').ReactElement} L'onde.
 */
function VoiceLiveWave({
  couleur, generation, subscribeTick,
}) {
  // -1 = pas encore de son : l'onde démarre vide, les barres naissent à droite.
  const niveaux = useSharedValue(Array.from({ length: NOMBRE }, () => -1));
  const decalage = useSharedValue(0);
  const largeur = useSharedValue(0);

  // Une nouvelle prise : le tapis repart vide, les barres renaîtront à droite.
  useEffect(() => {
    runOnUI(() => {
      'worklet';

      niveaux.value = Array.from({ length: NOMBRE }, () => -1);
      decalage.value = 0;
    })();
  }, [decalage, generation, niveaux]);

  useEffect(() => subscribeTick((niveau) => {
    runOnUI((/** @type {number | undefined} */ valeur) => {
      'worklet';

      niveaux.modify((liste) => {
        'worklet';

        liste.shift();
        liste.push(valeur ?? 0);
        return liste;
      });
      decalage.value = 0;
      decalage.value = withTiming(PAS, { duration: 50, easing: Easing.linear });
    })(niveau);
  }), [decalage, niveaux, subscribeTick]);

  // Le rang ne bouge que par transformation : jamais de mise en page.
  const rang = useAnimatedStyle(() => ({ transform: [{ translateX: -decalage.value }] }));

  return (
    <View
      // L'onde est une image du son : le chronomètre porte déjà l'information.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(evenement) => { largeur.value = evenement.nativeEvent.layout.width; }}
      style={styles.cadre}
    >
      <Animated.View style={[styles.rang, rang]}>
        {Array.from({ length: NOMBRE }, (_, i) => (

          <BarreVivante couleur={couleur} key={i} largeur={largeur} niveaux={niveaux} rang={i} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    flex: 1,
    height: 28,
    overflow: 'hidden',
  },
  rang: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default memo(VoiceLiveWave);
