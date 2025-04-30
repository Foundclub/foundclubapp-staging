import { Image, Text, TouchableOpacity } from 'react-native';

import useTheme from '../../../theme/themeContext';

/**
 * TabButton component.
 * @param {object} props - Component props
 * @param {string} props.title - Button title
 * @param {() => void} props.onPress - On press handler
 * @param {boolean} props.isActive - Is active
 * @returns {React.ReactElement} TabButton component
 */
function TabButton({
  isActive,
  onPress,
  title,
}) {
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.paddingVertical[12],
        Spaces.paddingHorizontal[16],
        ApplicationStyle.borderRadius12,
        ApplicationStyle.borderWidth2,
        isActive ? ApplicationStyle.borderColor.primary500
          : ApplicationStyle.borderColor.primary100,
        isActive ? ApplicationStyle.backgroundColor.primary500
          : ApplicationStyle.backgroundColor.transparent,
      ]}
    >
      <Text style={[{ maxWidth: '90%' }, Fonts.p1, Fonts.primary100]}>
        {title}
      </Text>
      <Image
        source={isActive ? Images.close : Images.arrowRight}
        style={[
          ApplicationStyle.icon20,
          ApplicationStyle.tintColor[isActive ? 'neutral900' : 'primary100']]}
      />
    </TouchableOpacity>

  );
}

export default TabButton;
