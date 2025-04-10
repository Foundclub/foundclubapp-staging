import { Image, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Custom header component displaying app logo for navigation headers.
 * @returns {import('react').ReactElement} Header component with logo
 */
function Header() {
  const { Images } = useTheme();

  /**
   * @type {import('react-native').ImageStyle}
   */
  const logoSize = {
    height: 23,
    resizeMode: 'contain',
    width: 211,
  };

  return (
    <View>
      <Image
        source={Images.logo}
        style={logoSize}
      />
    </View>
  );
}

export default Header;
