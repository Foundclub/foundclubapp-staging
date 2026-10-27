import { createContext, useContext } from 'react';

/**
 * Contexte du tour guidé, SANS le moteur (TUTOE, 27/10). Les écrans qui ne font
 * que lire le tour (Mon compte, tutoriels par écran, couche du guide)
 * l'importent d'ici : `TourContext.js` tire la navigation et le client HTTP,
 * qu'aucun de ces écrans ne doit charger pour autant.
 */
export const TourContext = createContext(/** @type {any} */ (null));

/**
 * Valeur du tour, ou un tour éteint hors de `TourProvider`.
 * @returns {any} Contexte du tour.
 */
export const useTour = () => useContext(TourContext) || {
  completeCurrentStep: () => {},
  created: {},
  currentMission: null,
  currentStep: null,
  exitTour: () => {},
  finishGuide: () => {},
  flags: {},
  gauge: 0,
  isGuide: false,
  isLockedStep: false,
  isTourActive: false,
  missionPosition: null,
  missions: [],
  missionStatus: {},
  pauseTour: () => {},
  profileKey: null,
  resumeTour: () => {},
  reward: null,
  skipMission: () => {},
  startTour: () => false,
  stepIndex: 0,
  stepRoute: null,
  totalSteps: 0,
  tourStatus: null,
};
