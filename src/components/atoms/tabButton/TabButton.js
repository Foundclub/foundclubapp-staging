import {
  Image, Platform, Text, TouchableOpacity,
} from 'react-native';

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

  /**
   * Handle keyboard activation on web only.
   * @param {any} event
   */
  const handleKeyDown = (event) => {
    if (Platform.OS !== 'web' || !onPress) {
      return;
    }

    if (event?.key !== 'Enter' && event?.key !== ' ') {
      return;
    }

    event?.preventDefault?.();
    onPress(event);
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      focusable={Platform.OS === 'web'}
      onKeyDown={Platform.OS === 'web' ? handleKeyDown : undefined}
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
      {/*
        Fond actif = primary500 : texte et icone en encre foncee primary900 (7,96:1).
        primary100 sur primary500 vaut 2,18:1 et echoue au WCAG AA.
        Decision Adel 2026-07-14, cf. THEME.md.
      */}
      <Text style={[
        { maxWidth: '90%' },
        Fonts.p1,
        isActive ? Fonts.primary900 : Fonts.primary100,
      ]}
      >
        {title}
      </Text>
      <Image
        source={isActive ? Images.close : Images.arrowRight}
        style={[
          ApplicationStyle.icon20,
          ApplicationStyle.tintColor[isActive ? 'primary900' : 'primary100']]}
      />
    </TouchableOpacity>

  );
}

export default TabButton;
