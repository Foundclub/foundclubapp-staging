import { Platform, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { BREAKPOINTS } from '@/responsive';

const CONTENT_WIDTHS = {
  content: 960,
  form: 560,
  readable: 720,
  wide: 1180,
};

const DESKTOP_FOOTER_CLEARANCE = 196;

const resolveContentWidth = (contentWidth) => {
  if (typeof contentWidth === 'number') {
    return contentWidth;
  }

  if (contentWidth === 'full') {
    return null;
  }

  return CONTENT_WIDTHS[contentWidth] || CONTENT_WIDTHS.form;
};

const resolveHorizontalPadding = (width) => {
  if (width >= 1440) return 56;
  if (width >= 1280) return 48;
  if (width >= BREAKPOINTS.desktop) return 40;
  if (width >= BREAKPOINTS.tablet) return 28;
  return 20;
};

/**
 * Sticky action footer used on longer onboarding steps.
 * On web, actions stay visible near the viewport bottom while the list scrolls.
 * @param {{
 *   children: import('react').ReactNode,
 *   contentWidth?: 'form' | 'readable' | 'content' | 'wide' | 'full' | number,
 * }} props
 * @returns {import('react').ReactElement}
 */
function OnboardingStickyFooter({ children, contentWidth = 'form' }) {
  const { Spaces } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = width >= BREAKPOINTS.desktop;
  const horizontalPadding = resolveHorizontalPadding(width);
  const maxContentWidth = resolveContentWidth(contentWidth);
  const shouldUseFixedFooter = isWeb && isDesktop;
  const fixedShellStyle = shouldUseFixedFooter
    ? {
      bottom: 0,
      left: 0,
      paddingBottom: Math.max(insets.bottom, 24),
      position: 'fixed',
      right: 0,
      zIndex: 40,
    }
    : null;
  const fixedFrameStyle = shouldUseFixedFooter
    ? {
      alignSelf: 'center',
      maxWidth: maxContentWidth || undefined,
      paddingHorizontal: horizontalPadding,
      width: '100%',
    }
    : null;
  const footerContentStyle = [
    Spaces.gap[16],
    {
      paddingTop: 16,
    },
    shouldUseFixedFooter
      ? {
        backgroundColor: 'rgba(9, 24, 35, 0.96)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        borderTopWidth: 1,
        boxShadow: '0 16px 48px rgba(4, 12, 20, 0.28)',
        paddingBottom: 16,
        paddingHorizontal: 16,
      }
      : null,
  ];

  return (
    <>
      {shouldUseFixedFooter ? <View style={{ height: DESKTOP_FOOTER_CLEARANCE }} /> : null}
      {shouldUseFixedFooter ? (
        <View pointerEvents="box-none" style={fixedShellStyle}>
          <View style={fixedFrameStyle}>
            <View style={footerContentStyle}>
              {children}
            </View>
          </View>
        </View>
      ) : (
        <View style={footerContentStyle}>
          {children}
        </View>
      )}
    </>
  );
}

export default OnboardingStickyFooter;
