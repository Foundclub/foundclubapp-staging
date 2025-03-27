import { useMemo } from 'react';
import { Image, Platform, View } from 'react-native';
import useTheme from '../../../theme/themeContext';

/**
 * Header back button component.
 * @param {object} props
 * @param {keyof import('theme/types').AllColors} [props.customBackgroundColor]
 * @param {keyof import('theme/types').AllColors} [props.customColor]
 * @returns {React.ReactElement}
 */
function HeaderBackButton({ customBackgroundColor = null, customColor = null }) {
  const {
    Images, Spaces, ApplicationStyle, Colors, scheme,
  } = useTheme();

  /**
   * @type {keyof import('theme/types').AllColors}
   */
  const backgroundColor = useMemo(() => {
    if (customBackgroundColor) {
      return customBackgroundColor;
    }
    if (scheme === 'dark') {
      return 'neutral7C8';
    }
    return 'neutral515';
  }, [scheme, customBackgroundColor]);

  /**
   * @type {keyof import('theme/types').AllColors}
   */
  const tintColor = useMemo(() => {
    if (customColor) {
      return customColor;
    }
    if (scheme === 'dark') {
      return 'neutralFFF';
    }
    return 'neutral515';
  }, [scheme, customColor]);

  return (
    <View style={[
      ApplicationStyle.borderRadius8,
      ApplicationStyle.backgroundColor[backgroundColor],
      Spaces.padding[8], Platform.OS === 'ios'
        ? Spaces.marginLeft[24] : Spaces.marginLeft[12],
    ]}
    >
      <Image
        source={Images.caretLeft}
        style={[
          ApplicationStyle.icon20,
          { tintColor: Colors[tintColor] },
        ]}
      />
    </View>
  );
}

export default HeaderBackButton;
