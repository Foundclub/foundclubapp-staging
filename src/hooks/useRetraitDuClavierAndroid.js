import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
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
// Android ≤ 14 (fenêtre rétrécie par `adjustResize`) et iPhone : 0, rien ne change.
// ponytail: réservé à Android 15+ comme ScreenContainer et Conversation ; si
// `edgeToEdgeEnabled` passe à true, Android ≤ 14 en aura besoin aussi.

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
 * Ce qu'un écran doit laisser en bas pour que son contenu s'arrête au haut du clavier.
 * @param {number} [reserveBasse] Ce que l'écran garde DÉJÀ en bas pour la barre système
 *   (dp) : 0 si rien, `insets.bottom` si son pied s'en charge.
 * @returns {{ ecoute: boolean, retrait: number }} `ecoute` : l'écran est sur Android 15+ (un
 *   `KeyboardAvoidingView` voisin doit alors se taire) ; `retrait` : la marge basse à poser,
 *   0 clavier fermé.
 */
export default function useRetraitDuClavierAndroid(reserveBasse = 0) {
  const bottom = useBarreDuBas();
  const ecoute = Platform.OS === 'android'
    && typeof Platform.Version === 'number'
    && Platform.Version >= 35;
  const [hauteurDuClavier, setHauteurDuClavier] = useState(0);

  useEffect(() => {
    if (!ecoute) return undefined;
    const hauteur = (/** @type {any} */ coordonnees) => Math.max(0, coordonnees?.height || 0);
    if (Keyboard.isVisible?.()) setHauteurDuClavier(hauteur(Keyboard.metrics?.()));
    const ouvert = Keyboard.addListener('keyboardDidShow', (evenement) => {
      setHauteurDuClavier(hauteur(evenement?.endCoordinates));
    });
    const ferme = Keyboard.addListener('keyboardDidHide', () => setHauteurDuClavier(0));
    return () => {
      ouvert.remove();
      ferme.remove();
    };
  }, [ecoute]);

  const retrait = ecoute && hauteurDuClavier > 0
    ? Math.max(0, hauteurDuClavier + bottom - reserveBasse)
    : 0;

  return { ecoute, retrait };
}
