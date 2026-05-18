import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getFloatingActionBottomOffset,
  getFloatingTabBarMetrics,
  getFloatingTabBarScenePaddingBottom,
} from '@/navigation/commonOptions';

/**
 * Shared dock metrics for screens rendered under the floating tab bar.
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

  return {
    bottomInset,
    dockClearance: Platform.OS === 'web'
      ? Math.max(sceneBottomInset - 12, 0)
      : getFloatingTabBarMetrics(bottomInset).clearance,
    floatingActionBottomOffset,
    sceneBottomInset,
  };
}

export default useBottomDockLayout;
