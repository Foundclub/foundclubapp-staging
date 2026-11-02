import { useEffect } from 'react';
import { TextInput, View } from 'react-native';

import { compactBubbleFits } from '@/components/molecules/tour/tourGuideGeometry';
import TourTarget from '@/components/molecules/tour/TourTarget';

import { useTour } from '@/context/useTour';
import useKeyboardFrame from '@/hooks/useKeyboardFrame';

// Hauteur d'une bulle courte du tunnel (titre de mission + 2 lignes), à 1,0.
export const TOUR_BUBBLE_SLOT_HEIGHT = 112;
// Clavier ouvert : hauteur de la bulle réduite à sa consigne (3 lignes, à 1,0), et de l'étiquette
// du champ, posée au-dessus du texte qu'on tape. Sous ce repère, le champ reste entier.
const COMPACT_BUBBLE_ROOM = 84;
const FIELD_LABEL_ROOM = 32;
// Le temps que la place s'efface et que le conteneur évite le clavier, avant de mesurer ; un 2ᵉ
// passage pour un téléphone lent : avant que la liste ait rétréci, le défilement voulu est refusé.
const SCROLL_DELAYS_MS = [80, 400];

/**
 * Place réservée à la bulle du guide sous le titre d'un écran (GUIDE-FINITIONS-3,
 * R2-2 et R2-4 du rejeu 2) : la bulle « en haut » couvrait le titre et la
 * consigne de chaque écran du tunnel équipe, puis « Terrain vide » sur la
 * composition. Rendue seulement pendant une étape `bubbleSlot` en cours ; la
 * couche du guide pose la bulle dans cette place.
 *
 * FIN-GUIDE, point 3 (capture 3 d'Adel) : clavier ouvert, ces 112 pt repoussaient le champ sous
 * le bord de la liste, et le voile empêchait de défiler ailleurs que dans la fente. La place
 * s'efface, et le champ actif remonte juste sous la bulle réduite.
 * ponytail: hauteur fixe ; une bulle plus haute (texte agrandi) déborde sur le
 * haut du contenu, qui défile. Sortie : faire publier la hauteur mesurée par la couche.
 * @param {{ scrollRef?: { current: any } }} props - La liste qui porte les champs de l'écran.
 * @returns {import('react').ReactElement | null}
 */
function TourBubbleSlot({ scrollRef }) {
  const { currentStep, isGuide, tourStatus } = useTour();
  const keyboard = useKeyboardFrame();
  const isActive = Boolean(isGuide && tourStatus === 'active' && currentStep?.bubbleSlot);
  const isKeyboardOpen = Boolean(keyboard);
  const room = FIELD_LABEL_ROOM
    + (keyboard && compactBubbleFits(keyboard.screenY) ? COMPACT_BUBBLE_ROOM : 0);

  useEffect(() => {
    if (!isActive || !isKeyboardOpen) return undefined;
    const scrollToInput = () => {
      const input = /** @type {any} */ (TextInput.State.currentlyFocusedInput?.());
      const list = scrollRef?.current;
      const content = list?.getInnerViewRef?.();
      if (!input?.measureLayout || !content) return;
      input.measureLayout(content, (/** @type {number} */ _x, /** @type {number} */ y) => {
        list.scrollTo({ animated: true, y: Math.max(0, y - room) });
      }, () => {});
    };
    const timers = SCROLL_DELAYS_MS.map((delay) => setTimeout(scrollToInput, delay));
    return () => timers.forEach(clearTimeout);
  }, [isActive, isKeyboardOpen, room, scrollRef]);

  if (!isActive) return null;
  return (
    <TourTarget id="tour.bubbleSlot">
      <View
        style={{ height: isKeyboardOpen ? 0 : TOUR_BUBBLE_SLOT_HEIGHT }}
        testID="tour.bubbleSlot"
      />
    </TourTarget>
  );
}

export default TourBubbleSlot;
