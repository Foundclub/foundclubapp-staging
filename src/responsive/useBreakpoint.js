import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { getBreakpointName, isDesktopWidth, isTabletWidth } from './breakpoints';

export const useBreakpoint = () => {
  const { height, width } = useWindowDimensions();

  return useMemo(() => ({
    height,
    isDesktop: isDesktopWidth(width),
    isMobile: getBreakpointName(width) === 'mobile',
    isTablet: isTabletWidth(width),
    name: getBreakpointName(width),
    width,
  }), [height, width]);
};

export default useBreakpoint;
