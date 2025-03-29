import { forwardRef, useEffect, useState } from 'react';
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
 * @property {import('react-native').ImageStyle
 * | Array<import('react-native').ImageStyle>} [iconStyle]
 * @property {import('react').RefObject<import('react-native').TextInput>} [reference]
 * @property {keyof import('../../../theme/types').Images} [icon]
 * @property {keyof import('../../../theme/types').Images} [iconBottom]
 * @property {React.ReactNode} [children]
 * @property {string} [error]
 * @property {Function} [onFocus]
 * @property {Function} [onBlur]
 * @property {() => void} [onBottomIconPress]
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
    // local states
    const [mainColor, setMainColor] = useState(
      /** @type {import('../../../theme/types').ColorNames} */('neutral00'),
    );
    // hooks
    const {
      Colors, Fonts, Alignments, ApplicationStyle, Spaces, Images,
    } = useTheme();

    // methods
    const handleFocus = () => {
      setMainColor('primary500');
      if (props?.onFocus) {
        props?.onFocus();
      }
    };

    const handleBlur = () => {
      setMainColor('neutral00');
      if (props?.onBlur) {
        props?.onBlur();
      }
    };

    useEffect(() => {
      if (props.error) {
        setMainColor('error700');
      } else {
        setMainColor('neutral00');
      }
    }, [props.error]);

    return (
      <View style={[Spaces.gap[8]]}>
        <View style={[Alignments.fill, Spaces.gap[12], props.wrapperStyle]}>
          <Text style={[
            Fonts.p3Bold,
            Fonts[mainColor],
            props.style,
          ]}
          >
            {props.label}
          </Text>
          <View style={[
            Alignments.fill,
            Alignments.row,
            Spaces.paddingHorizontal[16],
            Spaces.gap[16],
          ]}
          >
            {
            props.icon
              ? (
                <Image
                  source={Images[props.icon]}
                  style={[ApplicationStyle.icon24,
                    ApplicationStyle.tintColor.neutral00,
                    props.iconStyle]}
                />
              )
              : null
          }
            <TextInput
              style={[
                Fonts.p1,
                Fonts.neutral00,
                Alignments.fill,
                props.style,
              ]}
              placeholderTextColor={Colors.neutral500}
              selectionColor={Colors.primary500}
              cursorColor={Colors.primary500}
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
            {
              props.iconBottom
                ? (
                  <TouchableOpacity onPress={props.onBottomIconPress}>
                    <Image
                      source={Images[props.iconBottom]}
                      style={[ApplicationStyle.icon24,
                        ApplicationStyle.tintColor.neutral00,
                        props.iconStyle]}
                    />
                  </TouchableOpacity>
                )
                : null
            }
          </View>
          <View style={[
            Alignments.fullWidth,
            ApplicationStyle.backgroundColor[mainColor],
            ApplicationStyle.separator,
          ]}
          />
        </View>
        {
          props.error ? (
            <Text style={[
              Fonts.p2,
              Fonts.error700,
            ]}
            >
              {props.error}
            </Text>
          ) : null
        }
      </View>
    );
  },
);

export default Input;
