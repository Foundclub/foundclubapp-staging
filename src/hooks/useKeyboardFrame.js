import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Le cadre du clavier tant qu'il est ouvert (FIN-GUIDE, point 3). L'iPhone annonce le mouvement
 * (`keyboardWill…`), Android le constate (`keyboardDid…`, seul événement émis).
 * `screenY` est le haut du clavier dans le repère de la fenêtre : il vaut sur Android 15+ (bord à
 * bord, fenêtre entière) comme avant (fenêtre rétrécie), où il tombe sur le bas de la fenêtre.
 * @returns {{ height: number; screenY: number } | null} Le cadre, ou null clavier fermé.
 */
function useKeyboardFrame() {
  const [frame, setFrame] = useState(/** @type {any} */ (null));
  useEffect(() => {
    const prefix = Platform.OS === 'ios' ? 'keyboardWill' : 'keyboardDid';
    if (Keyboard.isVisible?.()) setFrame(Keyboard.metrics?.() || null);
    const shown = Keyboard.addListener(
      /** @type {any} */ (`${prefix}Show`),
      (event) => setFrame(event?.endCoordinates || null),
    );
    const hidden = Keyboard.addListener(
      /** @type {any} */ (`${prefix}Hide`),
      () => setFrame(null),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return frame;
}

export default useKeyboardFrame;
