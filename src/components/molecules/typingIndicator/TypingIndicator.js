import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import useReduceMotion from '@/hooks/useReduceMotion';

/** Identifiants de test — la bulle et ses points, nommés en un seul endroit. */
export const TYPING_INDICATOR_TEST_ID = 'conversation-typing-indicator';
export const TYPING_DOT_TEST_ID = 'conversation-typing-dot';

/** Les trois points, toujours trois : c'est la forme que tout le monde connaît. */
const DOTS = [0, 1, 2];
/** Un aller-retour complet d'un point. */
const CYCLE_MS = 900;
/** Le décalage d'un point sur le suivant : c'est lui qui fait la « vague ». */
const STAGGER_MS = 160;
/** Le point au repos reste VISIBLE : il ne disparaît jamais tout à fait. */
const OPACITY_MIN = 0.3;

// MSGLIVE — « untel est en train d'écrire », la bulle à trois points.
//
// Avant ce composant, l'écran affichait une ligne de texte nue. Le fil
// téléphonique existait déjà des deux côtés (le serveur diffuse
// `typing-started`/`typing-stopped`) : il ne manquait que la forme.
//
// ♿ LE TEXTE N'EST JAMAIS REMPLACÉ PAR L'ANIMATION. Les trois points sont un
// SECOND signal, posé à côté de la phrase, jamais à sa place. Quelqu'un qui a
// coupé les animations, ou qui écoute l'écran au lecteur vocal, lit exactement
// la même chose. Les points sont d'ailleurs masqués au lecteur d'écran : ils ne
// diraient rien de plus que la phrase, et ils la diraient trois fois.
//
// 🫧 L'ANIMATION NE TOUCHE QUE `opacity` ET `translateY` — jamais une hauteur
// ni une largeur. C'est ce qui permet au téléphone de la jouer HORS du fil JS
// (`useNativeDriver`), comme le défilement des noms longs. Sur le web,
// react-native-web ne sait pas piloter en natif : repli JS silencieux, même
// motif que `useMarqueeLoop`.

/**
 * La bulle « untel est en train d'écrire » : trois points animés et la phrase.
 * @param {{ label: string }} props - La phrase déjà traduite et accordée.
 * @returns {import('react').ReactElement | null} La bulle, ou rien sans phrase.
 */
function TypingIndicator({ label }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const reduceMotion = useReduceMotion();
  // Un `Animated.Value` par point, créé UNE fois pour la vie du composant.
  const progressions = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // ♿ Le système demande moins de mouvement : on ne lance rien, et les
    // points restent posés à leur opacité de repos. La phrase, elle, ne bouge
    // pas d'un pixel — c'est tout l'intérêt de ne pas s'appuyer sur le geste.
    if (reduceMotion) {
      progressions.forEach((valeur) => valeur.setValue(0));
      return undefined;
    }

    const boucles = progressions.map((valeur, rang) => Animated.loop(
      Animated.sequence([
        Animated.delay(rang * STAGGER_MS),
        Animated.timing(valeur, {
          duration: CYCLE_MS / 2,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(valeur, {
          duration: CYCLE_MS / 2,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ));

    boucles.forEach((boucle) => boucle.start());
    // Le ménage est OBLIGATOIRE : une boucle sans fin qui survit à son
    // composant est exactement ce qui fait chauffer un téléphone sans que rien
    // ne le montre à l'écran.
    return () => boucles.forEach((boucle) => boucle.stop());
  }, [progressions, reduceMotion]);

  if (!label) return null;

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="text"
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[8],
        Spaces.marginLeft[16],
        { gap: 8 },
      ]}
      testID={TYPING_INDICATOR_TEST_ID}
    >
      <View
        // Les points ne disent rien que la phrase ne dise déjà : le lecteur
        // d'écran les saute au lieu d'annoncer trois cases vides.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          Alignments.row,
          Alignments.alignCenter,
          {
            backgroundColor: Colors.neutral100,
            borderRadius: 12,
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 7,
          },
        ]}
      >
        {DOTS.map((rang) => (
          <Animated.View
            key={`typing-dot-${rang}`}
            style={{
              backgroundColor: Colors.primary500,
              borderRadius: 3,
              height: 6,
              opacity: progressions[rang].interpolate({
                inputRange: [0, 1],
                outputRange: [OPACITY_MIN, 1],
              }),
              transform: [{
                translateY: progressions[rang].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -3],
                }),
              }],
              width: 6,
            }}
            testID={TYPING_DOT_TEST_ID}
          />
        ))}
      </View>
      <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral500]}>{label}</Text>
    </View>
  );
}

export default TypingIndicator;
