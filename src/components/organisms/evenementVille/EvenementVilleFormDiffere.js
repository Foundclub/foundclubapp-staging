import { lazy } from 'react';

/**
 * 🏛️ R17-EVT-1-BIS (c) (20/10/2026) — le formulaire de l'événement de la Ville, CHARGÉ À LA
 * DEMANDE (le panneau de droite du planning d'une installation). Il tire la saisie d'adresse et
 * ses dépendances : inutiles tant qu'on ne l'ouvre pas, et les témoins du planning ne les
 * chargent pas. Téléphone (Metro) et témoins (jest) : `require` au premier rendu ; le site a son
 * jumeau `.web.js` (import dynamique, Vite).
 */
const EvenementVilleFormDiffere = lazy(async () => {
  // eslint-disable-next-line global-require
  const module = require('./EvenementVilleForm');
  // Un module ES (`default`) ou, doublé par un témoin, le composant lui-même.
  return { default: module.default || module };
});

export default EvenementVilleFormDiffere;
