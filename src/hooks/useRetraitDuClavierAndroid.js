import { useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🤖 ANDROIDBAR-4 — le motif d'ANDROIDBAR-1 (Conversation) et d'ANDROIDBAR-3 (ScreenContainer),
// pour les écrans qui ne passent par AUCUN des deux : fenêtres `<Modal>` à barre d'état
// translucide, écran sans en-tête.
//
// Android 15 et 16 imposent le bord à bord (targetSdk 35+) : `adjustResize` ne rétrécit plus la
// fenêtre, rien ne remonte au-dessus du clavier. Un `KeyboardAvoidingView` ne suffit pas :
// MESURÉ à l'émulateur le 13/10/2026 (ANDROIDBAR-3, Pixel 9, Android 16), à la FERMETURE du
// clavier Android lui envoie la hauteur VISIBLE comme haut du clavier (ReactRootView.java) et il
// garde un vide de la barre d'état (54 dp) sous l'écran.
// D'où la hauteur qu'Android envoie à l'ouverture — clavier SANS la barre système — remise à 0
// à la fermeture, et lue au montage si le clavier est déjà ouvert.
//
// 📱 CLAVIER-MODALES (13/10) — iPhone, sur demande (`{ iPhone: true }`) : une `<Modal>` n'y évite
// RIEN, le clavier se pose par-dessus (VU par Adel, TestFlight 2.6.75 : « Envoyer la
// convocation » caché). iOS ANNONCE le mouvement du clavier (`keyboardWillShow` /
// `keyboardWillHide`) : la marge part en même temps, avec sa durée et sa courbe, comme le
// `KeyboardAvoidingView` de React Native ; sa hauteur compte DÉJÀ la barre d'accueil.
//
// Android ≤ 14 (fenêtre rétrécie par `adjustResize`), et iPhone sans la demande : 0, rien ne
// change.
// ponytail: réservé à Android 15+ comme ScreenContainer et Conversation ; si
// `edgeToEdgeEnabled` passe à true, Android ≤ 14 en aura besoin aussi.
// ponytail: le nom dit « Android » ; l'iPhone n'entre que sur demande, sinon le
// `KeyboardAvoidingView` d'EventDetails et d'EventPublishedShowcase se tairait sur iPhone
// (`ecoute`). Sortie : `useRetraitDuClavier` quand EventDetails sera retouché (son témoin
// ANDROIDBAR-4 lit le nom du crochet dans le texte d'EventDetails.js).

/**
 * La barre du bas (dp), ou 0 sans fournisseur de zone sûre.
 * ponytail: l'app a TOUJOURS son fournisseur (AppProviders) ; seul un écran monté seul (31
 * suites d'EventDetails, qui n'en lisaient pas avant ce crochet) n'en a pas. `useSafeAreaInsets`
 * lit son contexte AVANT de lever : l'ordre des crochets ne change pas. Sortie : un fournisseur
 * dans ces suites, puis `useSafeAreaInsets().bottom` tout court.
 * @returns {number}
 */
const useBarreDuBas = () => {
  try {
    return useSafeAreaInsets().bottom;
  } catch {
    return 0;
  }
};

/**
 * iPhone : la marge suit la durée et la courbe que le clavier annonce (même réglage que le
 * `KeyboardAvoidingView` de React Native ; 10 ms est le minimum de RCTLayoutAnimation.m).
 * @param {any} evenement La charge de `keyboardWillShow` / `keyboardWillHide`.
 */
const suivreLeClavierIOS = (evenement) => {
  const { duration, easing } = evenement || {};
  if (!duration || !easing) return;
  const duree = Math.max(duration, 10);
  LayoutAnimation.configureNext({
    duration: duree,
    update: {
      duration: duree,
      type: LayoutAnimation.Types[/** @type {keyof typeof LayoutAnimation.Types} */ (easing)]
        || 'keyboard',
    },
  });
};

/**
 * Ce qu'un écran doit laisser en bas pour que son contenu s'arrête au haut du clavier.
 * @param {number} [reserveBasse] Ce que l'écran garde DÉJÀ en bas pour la barre système
 *   (dp) : 0 si rien, `insets.bottom` si son pied s'en charge.
 * @param {{ android?: boolean, iPhone?: boolean }} [options] `iPhone` : suivre aussi le clavier
 *   d'iOS (fenêtre `<Modal>`, où iOS n'évite rien). `android: false` : ne PAS suivre celui
 *   d'Android 15+, pour une `<Modal>` NON translucide — Android la remonte déjà (cadre
 *   `fitsSystemWindows` + `adjustResize`, ReactModalHostView.kt) : la suivre aussi la
 *   remonterait deux fois.
 * @returns {{ ecoute: boolean, retrait: number }} `ecoute` : le crochet suit le clavier
 *   (Android 15+, ou iPhone sur demande ; un `KeyboardAvoidingView` voisin doit alors se
 *   taire) ; `retrait` : la marge basse à poser, 0 clavier fermé.
 */
export default function useRetraitDuClavierAndroid(
  reserveBasse = 0,
  { android = true, iPhone = false } = {},
) {
  const bottom = useBarreDuBas();
  const surIPhone = iPhone && Platform.OS === 'ios';
  const ecoute = surIPhone || (android
    && Platform.OS === 'android'
    && typeof Platform.Version === 'number'
    && Platform.Version >= 35);
  const [hauteurDuClavier, setHauteurDuClavier] = useState(0);
  const hauteurPosee = useRef(0);

  useEffect(() => {
    if (!ecoute) return undefined;
    const hauteur = (/** @type {any} */ coordonnees) => Math.max(0, coordonnees?.height || 0);
    const poser = (/** @type {number} */ valeur, /** @type {any} */ evenement = null) => {
      // Une annonce qui ne change rien n'anime rien (le prochain rendu n'a rien à suivre).
      if (surIPhone && valeur !== hauteurPosee.current) suivreLeClavierIOS(evenement);
      hauteurPosee.current = valeur;
      setHauteurDuClavier(valeur);
    };
    // L'état RÉEL du clavier au branchement : déjà ouvert, sa hauteur ; fermé, 0 — une fenêtre
    // cachée clavier ouvert (`iPhone: visible`) ne garde pas l'ancienne hauteur en revenant.
    poser(Keyboard.isVisible?.() ? hauteur(Keyboard.metrics?.()) : 0);
    const ouvert = Keyboard.addListener(
      surIPhone ? 'keyboardWillShow' : 'keyboardDidShow',
      (evenement) => poser(hauteur(evenement?.endCoordinates), evenement),
    );
    const ferme = Keyboard.addListener(
      surIPhone ? 'keyboardWillHide' : 'keyboardDidHide',
      (evenement) => poser(0, evenement),
    );
    return () => {
      ouvert.remove();
      ferme.remove();
    };
  }, [ecoute, surIPhone]);

  // Android envoie le clavier SANS sa barre système ; iOS, barre d'accueil COMPRISE.
  const clavierDepuisLeBas = hauteurDuClavier + (surIPhone ? 0 : bottom);
  const retrait = ecoute && hauteurDuClavier > 0
    ? Math.max(0, clavierDepuisLeBas - reserveBasse)
    : 0;

  return { ecoute, retrait };
}
