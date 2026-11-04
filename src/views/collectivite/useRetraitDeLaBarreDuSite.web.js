import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useIsDesktop } from '@/responsive';

/**
 * Sur le site mobile, la barre d'onglets flotte au-dessus du bas de l'écran. Sur ordinateur, la
 * coque réserve déjà le bas.
 * @returns {number} Le retrait bas de l'écran.
 */
const useRetraitDeLaBarreDuSite = () => {
  const { dockClearance } = useBottomDockLayout();
  return useIsDesktop() ? 0 : dockClearance;
};

export default useRetraitDeLaBarreDuSite;
