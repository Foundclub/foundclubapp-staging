import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Platform,
} from 'react-native';

import useReduceMotion from '@/hooks/useReduceMotion';

/** Respiration entre deux passages : le nom s'arrête, puis repart. */
const PAUSE_BETWEEN_PASSES_MS = 1000;

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

// LE PLAFOND (MARQUEE, 27/08). Le registre savait COMPTER, rien ne le BORNAIT,
// et aucun appelant ne passait `paused` : une liste pleine de 15 noms longs
// faisait tourner 15 boucles — mesuré, c'est le point de départ du lot.
//
// Adel a tranché que le défilement est une BOUCLE SANS FIN. Un plafond n'est
// donc plus un confort : sans lui, chaque nom long affiché anime le téléphone
// en permanence. 6 = de quoi couvrir un écran de cartes visibles, et pas la
// réserve que la liste garde montée en dessous.
//
// Ce qui arrive à une carte qui n'obtient pas de place n'est PAS une coupure
// nette : elle rend exactement ce qu'elle rendait avant le défilement, une
// ligne tronquée par « … ». Le repli est le comportement d'origine.
export const MAX_CONCURRENT_MARQUEES = 6;

// Les boucles qui attendent une place. Sans ce rappel, une place rendue par une
// carte qui sort de l'écran resterait morte, et les cartes du bas ne
// défileraient plus jamais.
const waitingForSlot = new Set();

/**
 * Tente de prendre une place d'animation.
 * @param {object} loopId - Jeton propre à la boucle appelante.
 * @param {() => void} onSlotFreed - Rappel joué quand une place se libère.
 * @returns {boolean} - Vrai si la place est accordée.
 */
const acquireSlot = (loopId, onSlotFreed) => {
  if (activeLoops.size >= MAX_CONCURRENT_MARQUEES) {
    waitingForSlot.add(onSlotFreed);
    return false;
  }
  activeLoops.add(loopId);
  return true;
};

/**
 * Rend une place et réveille UNE boucle en attente.
 * @param {object} loopId - Jeton propre à la boucle appelante.
 * @param {() => void} onSlotFreed - Rappel à retirer de la file d'attente.
 * @returns {void}
 */
const releaseSlot = (loopId, onSlotFreed) => {
  waitingForSlot.delete(onSlotFreed);
  if (!activeLoops.delete(loopId)) return;

  const [next] = waitingForSlot;
  if (next) {
    waitingForSlot.delete(next);
    next();
  }
};

/**
 * Nombre de boucles de défilement réellement en cours dans l'application.
 * @returns {number} - 0 attendu hors écran, écran non focus ou app en fond.
 */
export const getActiveMarqueeCount = () => activeLoops.size;

// CE QUI EMPÊCHAIT L'OUTIL DE SORTIR DE SA CARTE (MARQUEE, 27/08).
//
// `useIsFocused()` ne rend pas `false` quand il n'y a pas de navigateur : il
// JETTE (« Couldn't find a navigation object »). Tant que le défilement ne
// servait qu'à ClubCard — toujours rendue dans un écran — personne ne pouvait
// le voir. Au premier écran branché ailleurs, 36 témoins déjà verts sont
// devenus rouges d'un coup : ils montent l'écran SEUL, sans conteneur de
// navigation, ce qui est le cas normal d'un test d'écran.
//
// Le repli est volontairement « visible » : un composant rendu hors navigateur
// (test, aperçu web, bloc monté à part) est à l'écran, donc il a le droit de
// défiler. Le vrai garde-fou du budget reste ailleurs — plafond, `paused`,
// app en arrière-plan.
const useIsFocusedSafely = () => {
  // L'appel est INCONDITIONNEL : le `try` ne couvre que l'absence de
  // navigateur, qui ne change jamais pendant la vie du composant. L'ordre des
  // crochets est donc le même à chaque rendu.
  try {
    return useIsFocused();
  } catch {
    return true;
  }
};

/**
 * Boucle de défilement horizontale, suspendue dès qu'elle n'est pas vue.
 * @param {object} params - Réglages de la boucle.
 * @param {number} params.distance - Largeur d'une copie du contenu, en pixels.
 * @param {number} params.durationMs - Durée d'un tour complet, en millisecondes.
 * @param {boolean} [params.enabled] - Faux quand le défilement n'a pas lieu d'être.
 * @returns {{
 *   isRunning: boolean,
 *   translateX: import('react-native').Animated.Value,
 * }} - Décalage à appliquer, et si la boucle tourne VRAIMENT (plafond, accessibilité).
 */
const useMarqueeLoop = ({ distance, durationMs, enabled = true }) => {
  const isFocused = useIsFocusedSafely();
  const reduceMotion = useReduceMotion();
  const [isAppActive, setIsAppActive] = useState(AppState.currentState !== 'background');
  const translateX = useRef(new Animated.Value(0)).current;
  const loopIdRef = useRef({});
  // Compteur de relance : une place rendue par une autre carte doit refaire
  // passer CET effet, sinon la boucle qui attendait ne démarrerait jamais.
  const [slotAttempt, setSlotAttempt] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  // Même garde que dans `useReduceMotion` : l'immense majorité des textes ne
  // défilent pas, et annoncer « toujours à l'arrêt » à chaque montage
  // redemanderait un rendu pour rien. Dans un test, ça se voit comme « An
  // update was not wrapped in act(...) » sur CHAQUE écran qui affiche un nom.
  const enMarcheRef = useRef(false);
  /**
   * Retient l'état de marche, et ne redemande un rendu que s'il a changé.
   * @param {boolean} valeur - Vrai quand la boucle tourne réellement.
   * @returns {void}
   */
  const majEnMarche = (valeur) => {
    if (enMarcheRef.current === valeur) return;
    enMarcheRef.current = valeur;
    setIsRunning(valeur);
  };

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
    && isFocused
    // ♿ Le système demande moins de mouvement : avec une boucle sans fin,
    // l'ignorer serait une vraie faute d'accessibilité, pas une négligence.
    && !reduceMotion;

  useEffect(() => {
    if (!shouldAnimate) {
      majEnMarche(false);
      return undefined;
    }

    const loopId = loopIdRef.current;
    const reessayer = () => setSlotAttempt((tour) => tour + 1);
    if (!acquireSlot(loopId, reessayer)) {
      majEnMarche(false);
      // Toujours en file d'attente : on s'en retire si la carte disparaît.
      return () => { waitingForSlot.delete(reessayer); };
    }

    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        // La respiration entre deux passages : le nom s'arrête une seconde en
        // haut de boucle avant de repartir. Ça reste une boucle — c'est ce
        // qu'Adel a tranché — mais elle se lit au lieu de glisser sans fin.
        delay: PAUSE_BETWEEN_PASSES_MS,
        duration: durationMs,
        easing: Easing.linear,
        toValue: -distance,
        // react-native-web ne supporte pas le driver natif : repli JS
        // silencieux plutôt qu'un avertissement en boucle.
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    majEnMarche(true);

    return () => {
      loop.stop();
      releaseSlot(loopId, reessayer);
    };
  }, [distance, durationMs, shouldAnimate, slotAttempt, translateX]);

  return { isRunning, translateX };
};

export default useMarqueeLoop;
