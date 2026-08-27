import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Réglage système « réduire les animations », en UN seul exemplaire.
//
// Ce crochet existait déjà, mais enfermé dans un écran
// (`views/event/EventPublishedShowcase.js`) : personne d'autre ne pouvait s'en
// servir. Il est sorti ici tel quel — même code, même repli silencieux — le
// jour où le défilement des noms longs en a eu besoin à son tour. Deux
// exemplaires du même réglage, c'est un des deux qu'on oublie de corriger.
//
// Le repli est volontairement `false` : si la plateforme ne sait pas répondre
// (web, vieux téléphone), on ne coupe pas une animation que l'utilisateur n'a
// jamais demandé de couper.

/**
 * Suit le réglage système « réduire les animations ».
 * @returns {boolean} - true si le système demande de réduire les animations.
 */
const useReduceMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(false);
  // La réponse du système arrive APRÈS le premier rendu, et elle vaut « non »
  // dans l'immense majorité des cas. Sans ce garde, on redemanderait un rendu
  // pour annoncer une valeur déjà en place — ce qui, dans un test, se voit
  // comme « An update was not wrapped in act(...) » sur CHAQUE écran qui
  // affiche un nom défilant. On ne prévient donc que d'un vrai changement.
  const dernierEtat = useRef(false);

  useEffect(() => {
    let cancelled = false;
    /**
     * Retient le réglage, et ne redemande un rendu que s'il a changé.
     * @param {boolean | null | undefined} enabled - Réponse du système.
     * @returns {void}
     */
    const appliquer = (enabled) => {
      const actif = !!enabled;
      if (cancelled || dernierEtat.current === actif) return;
      dernierEtat.current = actif;
      setReduceMotion(actif);
    };

    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then(appliquer)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      appliquer,
    );
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
};

export default useReduceMotion;
