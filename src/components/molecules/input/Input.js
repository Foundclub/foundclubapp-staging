import { forwardRef, useEffect, useState } from 'react';
import {
  Image, Platform, Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @typedef {object} InputAdditionalProps
 * @property {string} [label]
 * @property {import('react-native').ViewStyle
 * | Array<import('react-native').ViewStyle>} [wrapperStyle]
 * @property {import('react-native').ViewStyle
 * | Array<import('react-native').ViewStyle>} [labelStyle]
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
 * @property {boolean} [lightMode]
 * @property {'default' | 'compact'} [density]
 * @property {string} [placeholderTextColor]
 * @property {string} [accessibilityLabel]
 * @property {string} [accessibilityHint]
 * @property {import('react-native').AccessibilityRole} [accessibilityRole]
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
   * @param {React.ForwardedRef<TextInput>} ref
   * @returns {React.ReactElement}
   */
  (props, ref) => {
    // local states
    const [mainColor, setMainColor] = useState(
      /** @type {import('../../../theme/types').ColorNames} */('neutral00'),
    );
    // hooks
    const {
      Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
    } = useTheme();
    const hasLabel = Boolean(props.label);
    const isCompact = props.density === 'compact';

    // methods
    const handleFocus = () => {
      setMainColor('primary500');
      if (props?.onFocus) {
        props?.onFocus();
      }
    };

    const handleBlur = (
      /** @type {import('react-native').NativeSyntheticEvent<any> | undefined} */ event,
    ) => {
      setMainColor('neutral00');
      if (props?.onBlur) {
        props?.onBlur(event);
      }
    };

    /**
     * @param {import('react-native').NativeSyntheticEvent<import('react-native').TextInputEndEditingEventData>} event
     */
    const handleEndEditing = (event) => {
      handleBlur(event);
      if (props?.onEndEditing) {
        props.onEndEditing(event);
      }
    };

    useEffect(() => {
      if (props.error) {
        // Sur le fond sombre de l'app, error700 vaut 3,75:1 (echec WCAG AA) ;
        // error300 vaut 9,04:1. Applique au libelle, a l'icone et au separateur.
        setMainColor('error300');
      } else {
        setMainColor('neutral00');
      }
    }, [props.error]);

    return (
      <View style={[hasLabel ? Spaces.gap[8] : null]}>
        <View style={[hasLabel ? Spaces.gap[12] : null, props.wrapperStyle]}>
          {hasLabel ? (
            <Text style={[
              Fonts.p3Bold,
              Fonts[mainColor],
              props.labelStyle,
            ]}
            >
              {props.label}
            </Text>
          ) : null}
          <View>
            <View style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.paddingLeft[16],
              Spaces.paddingRight[4],
              Spaces.gap[16],
              Platform.OS === 'ios' && !isCompact ? Spaces.paddingBottom[12] : Spaces.paddingBottom[0],
            ]}
            >
              {
                props.icon
                  ? (
                    <Image
                      source={Images[props.icon]}
                      style={[ApplicationStyle.icon24,
                        ApplicationStyle.tintColor[mainColor],
                        props.iconStyle]}
                    />
                  )
                  : null
              }
              <TextInput
                accessibilityHint={props.accessibilityHint}
                accessibilityLabel={props.accessibilityLabel}
                accessibilityRole={props.accessibilityRole}
                autoCapitalize={props.autoCapitalize}
                autoComplete={props.autoComplete}
                autoCorrect={props.autoCorrect}
                autoFocus={props.autoFocus}
                cursorColor={Colors.primary500}
                editable={props.editable}
                enterKeyHint={props.enterKeyHint}
                inputMode={props.inputMode || 'text'}
                keyboardType={props.keyboardType}
                maxLength={props.maxLength}
                multiline={props.multiline}
                numberOfLines={props.numberOfLines}
                onBlur={handleBlur}
                onChangeText={props.onChangeText}
                onEndEditing={handleEndEditing}
                onFocus={handleFocus}
                onPressIn={props.onPressIn}
                onSubmitEditing={props.onSubmitEditing}
                placeholder={props.placeholder}
                placeholderTextColor={props.placeholderTextColor || Colors.neutral500}
                readOnly={props.readOnly}
                ref={ref}
                secureTextEntry={props.secureTextEntry}
                selectionColor={Colors.primary500}
                showSoftInputOnFocus={props.showSoftInputOnFocus}
                style={[
                  Fonts.p1,
                  props.readOnly ? Fonts.neutral500 : Fonts.neutral00,
                  Alignments.fill,
                  { minHeight: isCompact ? 24 : 30 },
                  props.style,
                ]}
                textAlignVertical={props.textAlignVertical}
                value={props.value}
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
            {props.lightMode ? null : (
              <View style={[
                Alignments.fullWidth,
                ApplicationStyle.backgroundColor[mainColor],
                ApplicationStyle.separator,
              ]}
              />
            )}
          </View>
        </View>
        {
          props.error && props.error !== ' ' ? (
            <Text style={[
              Fonts.p2,
              // error700 sur fond sombre = 3,75:1 (echec AA), error300 = 9,04:1.
              Fonts.error300,
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
