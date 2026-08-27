import { useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useMarqueeLoop, { getActiveMarqueeCount } from '@/hooks/useMarqueeLoop';

// Texte d'UNE ligne qui défile quand il ne tient pas, et qui reste strictement
// immobile quand il tient (U01 — un nom de club trop long était coupé par
// « … » et obligeait à ouvrir la fiche pour le lire en entier).
//
// L'animation n'est PAS écrite ici : elle est partagée avec le pied sponsors
// dans `@/hooks/useMarqueeLoop`, registre des boucles compris. Ce fichier ne
// s'occupe que de la question que le pied sponsors n'a jamais eu à poser :
// « est-ce que ça dépasse ? ».
//
// TROIS POINTS QUI NE SONT PAS DES DÉTAILS :
//  · la largeur se MESURE. Une sonde hors flux donne la largeur NATURELLE du
//    texte, l'enveloppe donne la place disponible. Compter les caractères ne
//    dirait rien : « Illiers » et « WWWWWWW » n'occupent pas la même place.
//  · tant que les deux mesures ne sont pas arrivées — premier rendu, web sans
//    layout, test sans moteur de mise en page — on rend EXACTEMENT ce que la
//    carte affichait avant : une ligne coupée par « … ». Jamais un texte
//    tranché net, jamais une animation qui tourne pour rien.
//  · le lecteur d'écran ne lit jamais ce bloc. Un texte qui bouge et qui est
//    rendu en double n'est pas une source d'accessibilité : le libellé complet
//    reste porté par le parent (`accessibilityLabel` de la carte).

// Vitesse de lecture confortable, et écart entre les deux copies : c'est lui
// qui fait respirer la boucle au moment où la fin rejoint le début.
const PIXELS_PER_SECOND = 30;
const COPY_GAP = 36;
// La sonde a besoin d'une place plus large que tout nom imaginable : sans elle,
// le moteur de mise en page tronquerait… la mesure elle-même.
const PROBE_WIDTH = 9999;
// Marge sous-pixel : un nom qui tient PILE ne doit pas se mettre à trembler.
const OVERFLOW_EPSILON = 1;

/**
 * Largeur rendue portee par un evenement de mise en page.
 * @param {import('react-native').LayoutChangeEvent} [event] - Evenement onLayout.
 * @returns {number} - Largeur en pixels, 0 tant que la mesure n'est pas arrivee.
 */
const readWidth = (event) => event?.nativeEvent?.layout?.width || 0;

export { getActiveMarqueeCount };

/**
 * Texte d'une ligne, défilant seulement s'il dépasse de la place disponible.
 * @param {object} props
 * @param {boolean} [props.paused] - Suspension forcée (carte connue hors écran).
 * @param {import('react-native').StyleProp<import('react-native').TextStyle>} [props.style]
 * @param {string} props.text - Texte à afficher.
 * @returns {import('react').ReactElement}
 */
function MarqueeText({ paused = false, style = null, text }) {
  const [viewportWidth, setViewportWidth] = useState(0);
  // La mesure est retenue AVEC le texte qu'elle décrit. Une liste de clubs est
  // virtualisée : la même carte est recyclée pour un autre club, et la largeur
  // de l'ancien nom ne doit surtout pas s'appliquer au nouveau — sinon un nom
  // court hérite du défilement du précédent. Texte changé ⇒ mesure périmée
  // ⇒ on repart du repli tronqué, le temps d'une mesure.
  const [measured, setMeasured] = useState({ text: '', width: 0 });
  const textWidth = measured.text === text ? measured.width : 0;

  const isOverflowing = viewportWidth > 0
    && textWidth > viewportWidth + OVERFLOW_EPSILON;
  const loopDistance = isOverflowing ? textWidth + COPY_GAP : 0;

  const { isRunning, translateX } = useMarqueeLoop({
    distance: loopDistance,
    durationMs: Math.round((loopDistance / PIXELS_PER_SECOND) * 1000),
    enabled: !paused,
  });

  const copy = (
    <Text numberOfLines={1} style={[style, styles.copy, { width: textWidth }]}>
      {text}
    </Text>
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setViewportWidth(readWidth(event))}
      style={styles.viewport}
    >
      {/*
        Sonde de mesure : hors flux, invisible, et posée dans une place très
        large. C'est la seule façon d'obtenir la largeur que le texte AURAIT
        s'il n'était pas contraint — celle qui dit s'il dépasse.
      */}
      <View pointerEvents="none" style={styles.probeLayer}>
        <Text
          numberOfLines={1}
          onLayout={(event) => setMeasured({ text, width: readWidth(event) })}
          style={style}
        >
          {text}
        </Text>
      </View>

      {/*
        `isRunning`, et pas seulement « ça dépasse » : une boucle peut être
        refusée (plafond atteint) ou interdite (« réduire les animations »).
        Dans ces deux cas le texte NE DOIT PAS rester figé au bord, coupé net
        et sans « … » — il retombe sur la troncature d'origine.
      */}
      {isOverflowing && isRunning ? (
        <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
          {/*
            Le texte est rendu DEUX fois : quand la première copie sort par la
            gauche, la seconde est déjà arrivée à sa place. C'est ce qui rend la
            boucle continue au lieu de « sauter » au retour.
          */}
          {copy}
          {copy}
        </Animated.View>
      ) : (
        <Text ellipsizeMode="tail" numberOfLines={1} style={style}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flexShrink: 0,
    marginRight: COPY_GAP,
  },
  probeLayer: {
    // Sans `flex-start`, le texte serait ÉTIRÉ à la largeur de la sonde et
    // mesurerait 9999 : la mesure ne dirait plus rien.
    alignItems: 'flex-start',
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: PROBE_WIDTH,
  },
  track: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  viewport: {
    flexShrink: 1,
    // Découpe la sonde et la copie en attente : sans elle, le nom déborderait
    // de la carte au lieu de défiler dedans.
    overflow: 'hidden',
  },
});

export default MarqueeText;
