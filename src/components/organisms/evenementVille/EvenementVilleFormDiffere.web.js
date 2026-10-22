import { lazy } from 'react';

/**
 * 🏛️ R17-EVT-1-BIS (c) (20/10/2026) — le jumeau du site de `EvenementVilleFormDiffere.js` : le
 * formulaire de l'événement de la Ville chargé à la demande (import dynamique, Vite), pour le
 * panneau de droite du planning d'une installation.
 */
const EvenementVilleFormDiffere = lazy(() => import('./EvenementVilleForm'));

export default EvenementVilleFormDiffere;
