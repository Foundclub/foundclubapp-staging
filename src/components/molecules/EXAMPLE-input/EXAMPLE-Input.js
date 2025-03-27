import { forwardRef } from 'react';
import {
  TextInput, View, Text, Image,
  TouchableOpacity,
} from 'react-native';
// hooks
import useTheme from '../../../theme/themeContext';

/**
 * @typedef {object} InputAdditionalProps
 * @property {string} [label]
 * @property {import('react-native').ViewStyle
 * | Array<import('react-native').ViewStyle>} [wrapperStyle]
 * @property {import('react-native').TextStyle
 * | Array<import('react-native').TextStyle>} [iconStyle]
 * @property {import('react').RefObject<import('react-native').TextInput>} [reference]
 * @property {import('react-native').ImageSourcePropType} [icon]
 * @property {import('react-native').ImageSourcePropType} [iconBottom]
 * @property {number} [labelPosition]
 * @property {React.ReactNode} [children]
 * @property {string} [error]
 * @property {Function} [onFocus]
 * @property {Function} [onBlur]
 * @property {() => void} [onIconPress]
 * @property {string} [iconColor]
 */

/**
 * Input component.
 * @inheritdoc
 */
const Input = forwardRef(
  /**
   * Input component.
   * @param {Omit<import('react-native').TextInputProps, 'onBlur' | 'onFocus'>
   *  & InputAdditionalProps} props
   * @param {React.RefObject<TextInput>} ref
   * @returns {React.ReactElement}
   */
  (props, ref) => {
  // hooks
    const {
      ApplicationStyle, Colors, Fonts, Spaces, Alignments,
    } = useTheme();

    // methods
    const handleFocus = () => {
      if (props?.onFocus) {
        props?.onFocus();
      }
    };

    const handleBlur = () => {
      if (props?.onBlur) {
        props?.onBlur();
      }
    };

    return (
      <View style={[Alignments.relative]}>
        <View
          style={[
            props.error && ApplicationStyle.borderColor.error500,
            props.error && ApplicationStyle.borderWidth1,
            ApplicationStyle.borderRadius8,
            ApplicationStyle.backgroundColor.neutral7C8,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[12],
            Fonts.p1,
            Alignments.justifyCenter,
            Alignments.row,
            Alignments.justifyStart,
            props.multiline ? Alignments.alignStart : Alignments.alignCenter,
            props.wrapperStyle,
          ]}
        >
          <View style={[
            Alignments.row,
            Alignments.justifyStart,
            props.multiline ? Alignments.alignStart : Alignments.alignCenter,
          ]}
          >
            { props.icon
              ? (
                <TouchableOpacity
                  onPress={props.onIconPress}
                  disabled={!props.onIconPress}
                  style={[Spaces.marginRight[12],
                    props.iconStyle]}
                >
                  <Image
                    source={props.icon}
                    style={[
                      ApplicationStyle.icon24,
                      { tintColor: props.iconColor ? props.iconColor : Colors.neutralFFF },
                    ]}
                  />
                </TouchableOpacity>
              )
              : null}
            <View style={[Alignments.fill]}>
              {props.value && props.label ? (
                <Text style={[
                  Fonts.p3,
                  Fonts.neutralD3D,
                  props.style,
                ]}
                >
                  {props.value ? props.label : ''}
                </Text>
              ) : null}
              <TextInput
                style={[
                  Fonts.p1,
                  Fonts.neutralFFF,
                  props.children && Alignments.absolute,
                  Alignments.fullWidth,
                  props.style,
                ]}
                placeholderTextColor={props.placeholderTextColor || Colors.neutralD3D}
                selectionColor={Colors.primaryViolet}
                cursorColor={Colors.primaryDarkViolet}
                ref={ref}
                readOnly={props.readOnly}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onEndEditing={handleBlur}
                inputMode={props.inputMode || 'text'}
                enterKeyHint={props.enterKeyHint}
                onSubmitEditing={props.onSubmitEditing}
                keyboardType={props.keyboardType}
                secureTextEntry={props.secureTextEntry}
                textAlignVertical={props.textAlignVertical}
                maxLength={props.maxLength}
                multiline={props.multiline}
                numberOfLines={props.numberOfLines}
                placeholder={props.placeholder}
                onChangeText={props.onChangeText}
                value={props.value}
                autoFocus={props.autoFocus}
                editable={props.editable}
              />
              {props.children}
            </View>
            { props.iconBottom
              ? (
                <TouchableOpacity
                  onPress={props.onIconPress}
                  disabled={!props.onIconPress}
                  style={[Spaces.marginRight[12],
                    props.iconStyle]}
                >
                  <Image
                    source={props.iconBottom}
                    style={[
                      ApplicationStyle.icon20,
                      { tintColor: props.iconColor ? props.iconColor : Colors.neutralFFF },
                    ]}
                  />
                </TouchableOpacity>
              )
              : null}
          </View>
        </View>
        {props.error ? (
          <Text style={[Fonts.p3, Fonts.error500, Spaces.marginLeft[8]]}>{props.error}</Text>
        ) : null}
      </View>
    );
  },
);

export default Input;
