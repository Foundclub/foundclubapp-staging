import { useMemo } from 'react';

import useBreakpoint from './useBreakpoint';

export const useResponsiveValue = (values) => {
  const { isDesktop, isTablet } = useBreakpoint();

  return useMemo(() => {
    if (isDesktop && Object.prototype.hasOwnProperty.call(values, 'desktop')) {
      return values.desktop;
    }

    if (isTablet && Object.prototype.hasOwnProperty.call(values, 'tablet')) {
      return values.tablet;
    }

    if (Object.prototype.hasOwnProperty.call(values, 'mobile')) {
      return values.mobile;
    }

    if (Object.prototype.hasOwnProperty.call(values, 'default')) {
      return values.default;
    }

    return undefined;
  }, [isDesktop, isTablet, values]);
};

export default useResponsiveValue;
