import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext } from 'react';

/**
 * IMPL-4-ACCUEIL, page 7 — l'écran est-il sous l'en-tête dessiné par sa pile (flèche + titre) ?
 * Même source que `ScreenContainer` (`HeaderHeightContext`). Le site a sa variante
 * (`sousEnTeteDeLaPile.web.js`) : il n'embarque pas `@react-navigation/elements`, et sa pile
 * n'en dessine aucun.
 * @returns {boolean} Vrai sous un en-tête de pile.
 */
const useSousEnTeteDeLaPile = () => (useContext(HeaderHeightContext) || 0) > 0;

export default useSousEnTeteDeLaPile;
