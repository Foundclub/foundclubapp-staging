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

  if (Platform.OS === 'web') {
    return {
      bottomInset,
      dockClearance: 0,
      floatingActionBottomOffset: Math.max(bottomInset + 24, 24),
      sceneBottomInset: 0,
    };
  }

  return {
    bottomInset,
    dockClearance: getFloatingTabBarMetrics(bottomInset).clearance,
    floatingActionBottomOffset: getFloatingActionBottomOffset(bottomInset, 14),
    sceneBottomInset: getFloatingTabBarScenePaddingBottom(bottomInset),
  };
}

export default useBottomDockLayout;
