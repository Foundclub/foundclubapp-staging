import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Shared auth/onboarding screen container with desktop-friendly defaults on web.
 * Native keeps the current full-screen behavior because the extra props are ignored there.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'form' | 'readable' | 'content' | 'wide' | 'full' | number} [props.contentWidth]
 * @param {'top' | 'center'} [props.desktopAlignment]
 * @param {'none' | 'screen' | 'tab-scene' | 'edge-to-edge'} [props.bottomInsetMode]
 * @param {boolean} [props.keyboardAvoiding]
 * Defilement sous le clavier (U02). ⛔ Il ne s'HERITE pas : un ecran qui porte
 * deja son propre ScrollView / FlatList ne doit PAS le demander, sinon deux
 * defilements verticaux s'imbriquent. Un temoin de balayage le verifie.
 * @param {boolean} [props.keyboardScroll]
 * @param {'none' | 'card'} [props.surface]
 * @returns {import('react').ReactElement}
 */
function FormScreenContainer({
  bgImage = 'bg2',
  bottomInsetMode = 'none',
  children,
  contentContainerStyle = [],
  contentWidth = 'form',
  desktopAlignment = 'center',
  desktopMinHeight = 640,
  gradient = null,
  keyboardAvoiding = true,
  keyboardScroll = false,
  responsiveHorizontalPadding = true,
  responsivePadding = true,
  style = [],
  surface = 'none',
  withHeaderPadding = true,
}) {
  return (
    <ScreenContainer
      bgImage={bgImage}
      bottomInsetMode={bottomInsetMode}
      contentContainerStyle={contentContainerStyle}
      contentWidth={contentWidth}
      desktopAlignment={desktopAlignment}
      desktopMinHeight={desktopMinHeight}
      gradient={gradient}
      keyboardAvoiding={keyboardAvoiding}
      keyboardScroll={keyboardScroll}
      responsiveHorizontalPadding={responsiveHorizontalPadding}
      responsivePadding={responsivePadding}
      style={style}
      surface={surface}
      withHeaderPadding={withHeaderPadding}
    >
      {children}
    </ScreenContainer>
  );
}

export default FormScreenContainer;
