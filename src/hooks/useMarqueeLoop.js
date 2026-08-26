import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Platform,
} from 'react-native';

// Mécanique PARTAGÉE de tous les défilements continus de l'app (« marquee »).
//
// POURQUOI CE FICHIER EXISTE (U01) : le pied sponsors des cartes savait déjà
// faire défiler une ligne sans faire souffrir le téléphone. Le nom d'un club
// trop long devait défiler lui aussi. Plutôt qu'une DEUXIÈME animation dans le
// dépôt, les deux morceaux délicats vivent ici en un seul exemplaire :
//   1. `useNativeDriver` sur téléphone — l'animation ne traverse pas le fil JS
//      (le défaut de famille payé sur le glisser-déposer de compo) ; repli JS
//      silencieux sur le web, où react-native-web ne sait pas piloter en natif ;
//   2. le REGISTRE des boucles réellement en vie, qui rend le budget
//      d'animation MESURABLE au lieu de le déclarer : une carte hors écran, un
//      écran non focus ou une app en arrière-plan doivent afficher 0.
const activeLoops = new Set();

/**
 * Nombre de boucles de défilement réellement en cours dans l'application.
 * @returns {number} - 0 attendu hors écran, écran non focus ou app en fond.
 */
export const getActiveMarqueeCount = () => activeLoops.size;

/**
 * Boucle de défilement horizontale, suspendue dès qu'elle n'est pas vue.
 * @param {object} params - Réglages de la boucle.
 * @param {number} params.distance - Largeur d'une copie du contenu, en pixels.
 * @param {number} params.durationMs - Durée d'un tour complet, en millisecondes.
 * @param {boolean} [params.enabled] - Faux quand le défilement n'a pas lieu d'être.
 * @returns {{ translateX: import('react-native').Animated.Value }} - Décalage à appliquer.
 */
const useMarqueeLoop = ({ distance, durationMs, enabled = true }) => {
  const isFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(AppState.currentState !== 'background');
  const translateX = useRef(new Animated.Value(0)).current;
  const loopIdRef = useRef({});

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });
    return () => subscription?.remove?.();
  }, []);

  const shouldAnimate = enabled
    && distance > 0
    && durationMs > 0
    && isAppActive
    && isFocused;

  useEffect(() => {
    if (!shouldAnimate) return undefined;

    const loopId = loopIdRef.current;
    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        duration: durationMs,
        easing: Easing.linear,
        toValue: -distance,
        // react-native-web ne supporte pas le driver natif : repli JS
        // silencieux plutôt qu'un avertissement en boucle.
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    activeLoops.add(loopId);
    loop.start();

    return () => {
      loop.stop();
      activeLoops.delete(loopId);
    };
  }, [distance, durationMs, shouldAnimate, translateX]);

  return { translateX };
};

export default useMarqueeLoop;
