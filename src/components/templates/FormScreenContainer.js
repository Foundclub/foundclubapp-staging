import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Shared auth/onboarding screen container with desktop-friendly defaults on web.
 * Native keeps the current full-screen behavior because the extra props are ignored there.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'form' | 'readable' | 'content' | 'wide' | 'full' | number} [props.contentWidth]
 * @param {'top' | 'center'} [props.desktopAlignment]
 * @param {'none' | 'card'} [props.surface]
 * @returns {import('react').ReactElement}
 */
function FormScreenContainer({
  contentWidth = 'form',
  desktopAlignment = 'center',
  desktopMinHeight = false,
  responsiveHorizontalPadding = true,
  responsivePadding = true,
  surface = 'none',
  ...props
}) {
  return (
    <ScreenContainer
      contentWidth={contentWidth}
      desktopAlignment={desktopAlignment}
      desktopMinHeight={desktopMinHeight}
      responsiveHorizontalPadding={responsiveHorizontalPadding}
      responsivePadding={responsivePadding}
      surface={surface}
      {...props}
    />
  );
}

export default FormScreenContainer;
