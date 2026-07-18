import { useMemo, useRef } from 'react';
import {
  Image, Text, TouchableWithoutFeedback, View,
} from 'react-native';
import BouncyCheckbox from 'react-native-bouncy-checkbox';

import useTheme from '@/theme/themeContext';

/**
 * Checkable component.
 * @param {object} props - The props of the component.
 * @param {boolean} props.isChecked - The checked state.
 * @param {(checked: boolean) => void} props.setIsChecked - The set checked state function.
 * @param {string} props.text - The text of the checkable.
 * @param {boolean} [props.disabled] - The disabled state of the checkable.
 * @param {'circle' | 'square'} [props.type] - The type (circle for radio, square for checkbox).
 * @param {React.ReactNode} [props.children] - The children of the component.
 * @param {import('react-native').ViewStyle
 * | Array<import('react-native').ViewStyle>} [props.wrapperStyle] - The wrapper style.
 * @param {import('react-native').ViewStyle
 * | Array<import('react-native').ViewStyle>} [props.fontStyle] - The font style.
 * @param {string} [props.customFillColor] - The custom fill color.
 * @param {boolean} [props.disableBounceAnimation] - Disable bounce animation for smoother large lists.
 * @returns {React.ReactElement} Checkable component.
 */
function Checkable({
  children,
  customFillColor = undefined,
  disableBounceAnimation = false,
  disabled = false,
  fontStyle,
  isChecked,
  setIsChecked,
  text,
  type = 'circle',
  wrapperStyle,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const bouncyCheckboxRef = useRef(null);

  const iconComponent = type === 'square'
    ? (
      <Image
        source={Images.check}
        style={[{ height: 16, width: 16 }, ApplicationStyle.tintColor.primary500]}
      />
    ) : (
      <View
        style={[
          { height: 14, width: 14 },
          ApplicationStyle.borderRadius16,
          ApplicationStyle.backgroundColor.transparent,
        ]}
      />
    );

  const canBePressed = useMemo(() => (disabled ? isChecked : true), [disabled, isChecked]);

  /**
   * Handle the checked state.
   * @param {boolean} checked - The checked state.
   */
  const handleIsChecked = (checked) => {
    if (canBePressed) {
      setIsChecked(checked);
    }
  };

  return (
    // Les props d'accessibilite sont portees par le Touchable, PAS par la View
    // enfant : TouchableWithoutFeedback reconstruit systematiquement
    // `accessibilityState` a partir de ses propres props et l'injecte par
    // cloneElement, ce qui ecraserait un accessibilityState pose sur l'enfant.
    <TouchableWithoutFeedback
      accessibilityRole={type === 'square' ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: Boolean(isChecked), disabled: !canBePressed }}
      onPress={() => {
        if (bouncyCheckboxRef.current && canBePressed) {
          // @ts-expect-error because ref are not typed well
          bouncyCheckboxRef.current.onCheckboxPress();
        }
      }}
    >
      <View
        style={[
          Alignments.fill,
          { opacity: canBePressed ? 1 : 0.5 },
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          ApplicationStyle.borderRadius12,
          ApplicationStyle.borderWidth2,
          ApplicationStyle.borderColor.neutral00,
          Spaces.padding[16],
          Spaces.gap[16],
          isChecked ? ApplicationStyle.backgroundColor.primary500
            : ApplicationStyle.backgroundColor.transparent,
          wrapperStyle,
        ]}
      >
        {children || (
        <Text style={[
          Alignments.fill,
          Fonts.p1Bold,
          isChecked ? Fonts.primary700 : Fonts.neutral00,
          fontStyle,
          { maxWidth: '85%' },
        ]}
        >
          {text}
        </Text>
        )}
        <BouncyCheckbox
          bounceEffectIn={disableBounceAnimation ? 1 : undefined}
          bounceEffectOut={disableBounceAnimation ? 1 : undefined}
          bounceVelocityIn={disableBounceAnimation ? 0 : undefined}
          bounceVelocityOut={disableBounceAnimation ? 0 : undefined}
          disableText
          fillColor={customFillColor || (type === 'circle' ? Colors.neutral00 : 'transparent')}
          iconComponent={(isChecked || type === 'circle') ? iconComponent : null}
          innerIconStyle={{
            borderColor: isChecked ? Colors.primary500 : Colors.neutral00,
            borderRadius: type === 'square' ? 4 : 12,
            borderWidth: 2,
          }}
          isChecked={isChecked}
          onPress={handleIsChecked}
          ref={bouncyCheckboxRef}
          size={24}
          unFillColor={Colors.primary700}
          useBuiltInState={canBePressed}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

export default Checkable;
