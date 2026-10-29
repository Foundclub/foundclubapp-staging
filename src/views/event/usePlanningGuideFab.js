import { useTour } from '@/context/useTour';

/**
 * Guide Entraîneur, N11 bis (GUIDE-FINITIONS-3, capture 39) : le bouton flottant
 * du Planning chevauchait la carte cadrée par b1-card. Il se range pendant une
 * étape `hidesFloatingAction`, sauf s'il n'y a aucune séance à ouvrir : c'est
 * alors lui que le guide montre (R2-3).
 * @param {string | null} nextEventId - Prochaine séance pas encore finie.
 * @returns {boolean} Le bouton doit-il se ranger ?
 */
export default function usePlanningGuideFab(nextEventId) {
  const { currentStep, isGuide, tourStatus } = useTour();
  return Boolean(isGuide && tourStatus === 'active'
    && currentStep?.hidesFloatingAction && nextEventId);
}
