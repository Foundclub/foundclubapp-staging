import { View } from 'react-native';

import TourTarget from '@/components/molecules/tour/TourTarget';

import { useTour } from '@/context/useTour';

// Hauteur d'une bulle courte du tunnel (titre de mission + 2 lignes), à 1,0.
export const TOUR_BUBBLE_SLOT_HEIGHT = 112;

/**
 * Place réservée à la bulle du guide sous le titre d'un écran (GUIDE-FINITIONS-3,
 * R2-2 et R2-4 du rejeu 2) : la bulle « en haut » couvrait le titre et la
 * consigne de chaque écran du tunnel équipe, puis « Terrain vide » sur la
 * composition. Rendue seulement pendant une étape `bubbleSlot` en cours ; la
 * couche du guide pose la bulle dans cette place.
 * ponytail: hauteur fixe ; une bulle plus haute (texte agrandi) déborde sur le
 * haut du contenu, qui défile. Sortie : faire publier la hauteur mesurée par la couche.
 * @returns {import('react').ReactElement | null}
 */
function TourBubbleSlot() {
  const { currentStep, isGuide, tourStatus } = useTour();
  if (!isGuide || tourStatus !== 'active' || !currentStep?.bubbleSlot) return null;
  return (
    <TourTarget id="tour.bubbleSlot">
      <View style={{ height: TOUR_BUBBLE_SLOT_HEIGHT }} testID="tour.bubbleSlot" />
    </TourTarget>
  );
}

export default TourBubbleSlot;
