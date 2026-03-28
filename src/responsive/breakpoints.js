export const BREAKPOINTS = {
  desktop: 1024,
  tablet: 768,
};

export const getBreakpointName = (width) => {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};

export const isDesktopWidth = (width) => width >= BREAKPOINTS.desktop;

export const isTabletWidth = (width) => width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;

export default BREAKPOINTS;
