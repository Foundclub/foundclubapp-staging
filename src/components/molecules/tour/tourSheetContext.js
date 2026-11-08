import { createContext } from 'react';

/**
 * GUIDE-D-CORR TG-01/TG-02 (tournée du 07/11) : vrai dans le contenu d'une feuille du bas
 * (BottomModal). Une ancre du guide posée dedans le dit au registre ; la couche du guide, qui
 * passe au-dessus des feuilles, ne se retire alors pas pendant que la feuille est ouverte.
 * Module à part : BottomModal le lit sans tirer la navigation de `TourTarget`.
 */
const TourSheetContext = createContext(false);

// Signal « une feuille du bas est ouverte » : BottomModal le dépose, la couche du guide le mesure.
export const TOUR_SHEET_TARGET = 'tour.sheet';
const SHEET_RECT = {
  height: 1, width: 1, x: 0, y: 0,
};

/**
 * Mesure du signal : un point, seule sa présence compte.
 * @param {(rect: { height: number; width: number; x: number; y: number }) => void} done - Retour.
 * @returns {void}
 */
export const measureTourSheet = (done) => done(SHEET_RECT);

export default TourSheetContext;
