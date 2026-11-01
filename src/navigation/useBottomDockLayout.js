import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getFloatingActionBottomOffset,
  getFloatingTabBarMetrics,
  getFloatingTabBarScenePaddingBottom,
} from '@/navigation/commonOptions';

/**
 * Shared dock metrics for screens rendered under the floating tab bar.
 * dockClearance est le retrait LOCAL : la coque web peut déjà réserver cette place.
 * @returns {{
 *   bottomInset: number,
 *   dockClearance: number,
 *   floatingActionBottomOffset: number,
 *   sceneBottomInset: number,
 * }}
 */
function useBottomDockLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;
  const sceneBottomInset = getFloatingTabBarScenePaddingBottom(bottomInset);
  const floatingActionBottomOffset = getFloatingActionBottomOffset(bottomInset, 14);
  const [shellReservesDock, setShellReservesDock] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined'
      || typeof window === 'undefined') return undefined;
    const measure = () => {
      const shell = document.querySelector('.shell-content');
      const shellStyle = shell ? window.getComputedStyle(shell) : null;
      // Le même contrat est consommé par ScreenContainer.web. Sans lui (ancienne coque ou
      // composant isolé), garder la protection historique plutôt que supposer la place réservée.
      setShellReservesDock(Boolean(shellStyle?.getPropertyValue('--fc-shell-bottom-space').trim())
        && Number.parseFloat(shellStyle?.paddingBottom || '0') > 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const webDockClearance = shellReservesDock ? 0 : Math.max(sceneBottomInset - 12, 0);

  return {
    bottomInset,
    dockClearance: Platform.OS === 'web'
      ? webDockClearance
      : getFloatingTabBarMetrics(bottomInset).clearance,
    floatingActionBottomOffset,
    sceneBottomInset,
  };
}

export default useBottomDockLayout;
