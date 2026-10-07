import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  View,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import useReduceMotion from '@/hooks/useReduceMotion';

/** Identifiants de test — la bulle et ses points, nommés en un seul endroit. */
export const TYPING_INDICATOR_TEST_ID = 'conversation-typing-indicator';
export const TYPING_DOT_TEST_ID = 'conversation-typing-dot';

/** Les trois points, toujours trois : c'est la forme que tout le monde connaît. */
const DOTS = [0, 1, 2];
/** Un aller-retour complet d'un point. */
// MSG1A (§3.1) — 1,2 s, comme le pack (SPECS.md §1 « … écrit »).
const CYCLE_MS = 1200;
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
 * La bulle « untel est en train d'écrire » : trois points animés.
 *
 * 🫧 MSG1A (§3.1) — c'est une BULLE RECUE du fil (fond `primary700`, 34 de haut, queue a
 * gauche, points de 7 a 72 % de blanc), precedee de l'avatar de celui qui ecrit dans un fil
 * a plusieurs. La phrase « Prenom ecrit… » est passee dans l'en-tete du fil ; ici elle reste
 * l'etiquette lue par le lecteur d'ecran.
 * @param {{ avatar?: import('react').ReactNode, label: string }} props - La phrase deja
 *   traduite et accordee ; l'avatar (28) de celui qui ecrit, ou rien.
 * @returns {import('react').ReactElement | null} La bulle, ou rien sans phrase.
 */
function TypingIndicator({ avatar = null, label }) {
  const { Colors } = useTheme();
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
      style={{
        alignItems: 'flex-end',
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
        paddingLeft: 8,
        paddingRight: 40,
      }}
      testID={TYPING_INDICATOR_TEST_ID}
    >
      {avatar}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          alignItems: 'center',
          backgroundColor: Colors.primary700,
          borderRadius: 18,
          flexDirection: 'row',
          gap: 4,
          height: 34,
          paddingHorizontal: 14,
        }}
      >
        <Svg
          height={18}
          style={{ bottom: 0, left: -6, position: 'absolute' }}
          viewBox="0 0 24 18"
          width={24}
        >
          <Path
            d="M6 0V9C6 13.5 3.8 16.6 0 18C4.6 18.6 8.8 17.6 11.6 15.6C13.6 17.2 16.4 18 20 18H24V0Z"
            fill={Colors.primary700}
          />
        </Svg>
        {DOTS.map((rang) => (
          <Animated.View
            key={`typing-dot-${rang}`}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.72),
              borderRadius: 4,
              height: 7,
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
              width: 7,
            }}
            testID={TYPING_DOT_TEST_ID}
          />
        ))}
      </View>
    </View>
  );
}

export default TypingIndicator;
