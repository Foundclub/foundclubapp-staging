import {
  forwardRef, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Keyboard,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';

import BottomModal from '../bottomModal/BottomModal';
import Input from '../input/Input';
/**
 * @typedef {object} SelectProps
 * @property {Array<Option>} options - The options of the select.
 * @property {string | string[]} value - The select options
 * @property {Function} setValue - The function to set the selected value.
 * @property {boolean} [isMulti] - Whether multiple options can be selected.
 * @property {boolean} [isSearchable] - The flag to know if the select is searchable or not.
 * @property {boolean} [disabled] - The flag to know if the select is searchable or not.
 * @property {string} [confirmButtonLabel] - Optional footer confirm button label.
 * @property {string} [actionLabel] - Optional secondary action label shown in the modal footer.
 * @property {'Primary' | 'PrimaryLight' | 'Secondary' | 'SecondaryLight'} [actionVariant]
 *  - Optional secondary action button variant.
 * @property {() => void} [onActionPress] - Optional secondary action handler.
 * @property {(value: string) => void} [setSearchValue] - The function to set the search value
 * @property {string} [searchValue] - The function to set the search value
 * @property {boolean} [isLoading] - The flag to know if the select options are loading or not.
 * @property {string} [placeholder] - The placeholder of the select.
 * @property {string} [label] - The label of the select.
 * @property {Function} [onFocus] - The function to call on focus.
 * @property {Function} [onBlur] - The function to call on blur.
 * @property {string} [error] - The error message to display ender input.
 * @property {import('react-native').ViewStyle
 *  | Array<import('react-native').ViewStyle>} [wrapperStyle]
 * @property {import('react-native').ImageStyle
 * | Array<import('react-native').ImageStyle>} [iconStyle]
 * @property {keyof import('../../../theme/types').AllImages} [customIcon] - The custom icon.
 * @property {'start' | 'end'} [customIconPosition]
 * @property {boolean} [lightMode] - The flag to know if the select is in light mode.
 * @property {string} [modalTitle] - Optional modal title override.
 * @property {(string|number)[]} [modalSnapPoints] - Optional modal snap points override.
 * @property {string} [displayValue] - Optional custom display value for the closed state.
 * @property {React.ReactNode} [closedContent] - Optional custom closed state content.
 * @property {import('react-native').ViewStyle
 * | Array<import('react-native').ViewStyle>} [closedPressableStyle]
 *  - Optional style override for the closed pressable area.
 * @property {(option: Option, isChecked: boolean) => React.ReactNode} [renderOptionContent]
 *  - Optional custom option renderer.
 * @property {import('react-native').TextStyle
 * | Array<import('react-native').TextStyle>} [displayTextStyle]
 *  - Optional custom text style for the closed state value.
 * @property {'default' | 'card' | 'compact-card'} [displayVariant] - Optional closed state variant.
 * @property {string} [description] - Optional helper copy displayed under the label.
 * @property {import('react-native').TextStyle
 * | Array<import('react-native').TextStyle>} [optionTextStyle]
 *  - Optional text style applied to option labels.
 */

/**
 * @typedef {SelectProps} AutocompleteSelectProps
 */

/**
 * Autocomplete select component.
 * @inheritdoc
 */
const AutocompleteSelect = forwardRef(
  /**
   * Autocomplete select component function.
   * @param {Omit<import('react-native').TextInputProps, 'onBlur' | 'onFocus'>
   * & SelectProps} props
   * @param {React.ForwardedRef<import('react-native').TextInput>} ref
   * @returns {React.ReactElement} Autocomplete select component
   */
  (props, ref) => {
    // hooks
    const {
      Alignments,
      ApplicationStyle,
      Colors,
      Fonts,
      Images,
      Spaces,
    } = useTheme();
    const { t } = useTranslation();
    const hasLabel = Boolean(props.label);
    const isCardVariant = props.displayVariant === 'card';
    const isCompactCardVariant = props.displayVariant === 'compact-card';
    const isCardLikeVariant = isCardVariant || isCompactCardVariant;

    // local states
    const [areValuesVisible, setAreValuesVisible] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState(
      /** @type {Option[] | Option | undefined} */
      (props.isMulti ? [] : undefined),
    );

    // refs
    const searchInputRef = useRef(null);
    const openModalTimeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
    const wasValuesVisibleRef = useRef(false);

    useEffect(() => () => {
      if (openModalTimeoutRef.current) {
        clearTimeout(openModalTimeoutRef.current);
      }
    }, []);

    /**
     * @param {unknown} value
     * @returns {string[]}
     */
    const toComparableTokens = useCallback((value) => {
      if (value === null || value === undefined) return [];
      if (typeof value === 'object') {
        const obj = /** @type {{ value?: unknown, label?: unknown }} */ (value);
        const valueToken = obj.value === null || obj.value === undefined ? '' : String(obj.value).trim();
        const labelToken = obj.label === null || obj.label === undefined ? '' : String(obj.label).trim();
        return [valueToken, labelToken].filter(Boolean);
      }
      const token = String(value).trim();
      return token ? [token] : [];
    }, []);

    const hydrateSelectedOptionsFromProps = useCallback(() => {
      if (!props.options || props.options.length === 0) {
        if (props.isMulti) {
          if (!Array.isArray(props.value)) return [];
          return props.value
            .map((item) => {
              const itemTokens = toComparableTokens(item);
              if (itemTokens.length === 0) return null;
              return { label: itemTokens[0], value: itemTokens[0] };
            })
            .filter(Boolean);
        }

        const firstValue = Array.isArray(props.value) ? props.value[0] : props.value;
        const firstValueTokens = toComparableTokens(firstValue);
        if (firstValueTokens.length === 0) return undefined;
        return { label: firstValueTokens[0], value: firstValueTokens[0] };
      }

      const valueTokens = Array.isArray(props.value)
        ? props.value.flatMap((item) => toComparableTokens(item))
        : toComparableTokens(props.value);
      const tokenSet = new Set(valueTokens);

      if (props.isMulti) {
        if (tokenSet.size === 0) return [];
        return props.options.filter((option) => {
          const optionTokens = [...toComparableTokens(option?.value), ...toComparableTokens(option?.label)];
          return optionTokens.some((token) => tokenSet.has(token));
        });
      }

      if (tokenSet.size === 0) return undefined;
      return props.options.find((option) => {
        const optionTokens = [...toComparableTokens(option?.value), ...toComparableTokens(option?.label)];
        return optionTokens.some((token) => tokenSet.has(token));
      });
    }, [props.isMulti, props.options, props.value, toComparableTokens]);

    useEffect(() => {
      const justOpened = areValuesVisible && !wasValuesVisibleRef.current;
      if (justOpened) {
        setSelectedOptions(hydrateSelectedOptionsFromProps());
      }
      wasValuesVisibleRef.current = areValuesVisible;
    }, [areValuesVisible, hydrateSelectedOptionsFromProps]);

    // methods
    const handleFocus = () => {
      if (!props.disabled) {
        Keyboard.dismiss();
        if (openModalTimeoutRef.current) {
          clearTimeout(openModalTimeoutRef.current);
        }
        const openDelay = props.isSearchable ? 80 : 0;
        openModalTimeoutRef.current = setTimeout(() => {
          setAreValuesVisible(true);
          openModalTimeoutRef.current = null;
        }, openDelay);
        if (props?.onFocus) {
          props?.onFocus();
        }
      }
    };

    /**
     * Handle the select option.
     * @param {Option} option - The option to select.
     * @returns {void}
     */
    const handleSelectOption = (option) => {
      if (props.isMulti) {
        setSelectedOptions((current) => {
          const currentArray = Array.isArray(current) ? current : [];
          const exists = currentArray.some((opt) => opt.value === option.value);
          return exists
            ? currentArray.filter((opt) => opt.value !== option.value)
            : [...currentArray, option];
        });
      } else {
        setSelectedOptions((current) => (current === option ? undefined : option));
      }
    };

    const handleCloseModal = (persistSelection = true) => {
      if (openModalTimeoutRef.current) {
        clearTimeout(openModalTimeoutRef.current);
        openModalTimeoutRef.current = null;
      }

      if (persistSelection) {
        props.setValue(selectedOptions);
      }

      setAreValuesVisible(false);
      if (props.setSearchValue) {
        props.setSearchValue('');
      }
      if (props.onBlur) {
        props.onBlur();
      }
    };

    const handleValidation = () => {
      handleCloseModal(true);
    };

    const handleActionPress = () => {
      handleCloseModal(true);
      if (props.onActionPress) {
        props.onActionPress();
      }
    };

    /**
     * Handle the select option.
     * @param {Option} option - The option to check.
     * @returns {boolean} The flag to know if the option is checked.
     */
    const handleIsChecked = (option) => {
      if (props.isMulti) {
        return Array.isArray(selectedOptions) && selectedOptions.some(
          (opt) => opt.value === option.value,
        );
      }
      const singleOption = selectedOptions;
      return Boolean(
        singleOption && !Array.isArray(singleOption) && singleOption.value === option.value,
      );
    };

    const getDisplayValue = () => {
      if (typeof props.displayValue === 'string' && props.displayValue.trim().length > 0) {
        return props.displayValue;
      }

      if (!props.value) return '';

      if (props.isMulti && Array.isArray(props.value)) {
        const selectedLabels = props.options
          .filter((opt) => props.value.includes(opt.value))
          .map((opt) => opt.label);
        return selectedLabels.join(', ');
      }

      const valueTokens = toComparableTokens(props.value);
      const matchedOption = (props.options || []).find((option) => {
        const optionTokens = [...toComparableTokens(option?.value), ...toComparableTokens(option?.label)];
        return optionTokens.some((token) => valueTokens.includes(token));
      });

      if (matchedOption?.label) {
        return matchedOption.label;
      }

      if (typeof props.value === 'object' && props.value !== null && 'label' in props.value) {
        return props.value.label;
      }

      return props.value || undefined;
    };

    const modalFooter = (
      <View style={[Spaces.paddingBottom[16]]}>
        {props.actionLabel && props.onActionPress ? (
          <View style={[Spaces.marginBottom[12]]}>
            <Button
              onPress={handleActionPress}
              title={props.actionLabel}
              variant={props.actionVariant || 'SecondaryLight'}
            />
          </View>
        ) : null}
        <Button
          onPress={handleValidation}
          title={props.confirmButtonLabel || t('modals.actions.select')}
          variant="Primary"
        />
      </View>
    );

    const modalTitle = props.modalTitle || props.label || props.placeholder || t('modals.actions.select');
    const modalSnapPoints = props.modalSnapPoints || [props.isSearchable ? '86%' : '78%'];
    const renderOptions = useMemo(() => {
      const keyCollisions = new Map();

      return (props.options || []).map((option) => {
        const isHeader = Boolean(option?.isHeader);
        const baseToken = String(option?.value ?? option?.label ?? 'empty');
        const baseKey = `${isHeader ? 'header' : 'option'}-${baseToken}`;
        const collisionIndex = keyCollisions.get(baseKey) || 0;
        keyCollisions.set(baseKey, collisionIndex + 1);

        return {
          key: collisionIndex === 0 ? baseKey : `${baseKey}-${collisionIndex}`,
          option,
        };
      });
    }, [props.options]);

    const displayValue = getDisplayValue();
    const hasValue = props.isMulti
      ? Array.isArray(props.value) && props.value.length > 0
      : Boolean(String(displayValue || '').trim().length);
    let cardBorderColor = 'rgba(1, 179, 244, 0.24)';
    if (props.error) {
      cardBorderColor = Colors.error500;
    } else if (areValuesVisible || hasValue) {
      cardBorderColor = Colors.primary500;
    }
    let cardSurfaceColor = Colors.neutral00;
    if (!props.lightMode) {
      cardSurfaceColor = isCompactCardVariant ? Colors.primary700 : 'rgba(4, 31, 44, 0.82)';
    }
    let cardMinHeight = props.description ? 140 : 120;
    if (isCompactCardVariant) {
      cardMinHeight = props.description ? 104 : 82;
    }
    const valueTextStyle = hasValue
      ? [
        isCompactCardVariant ? Fonts.p2Bold : Fonts.p1Bold,
        Fonts.neutral00,
        { lineHeight: isCompactCardVariant ? 20 : 24 },
      ]
      : [Fonts.p2, Fonts.neutral300, { lineHeight: 20 }];

    return (
      <View style={[Alignments.relative, isCardLikeVariant ? props.wrapperStyle : null]}>
        {isCardLikeVariant ? (
          <TouchableOpacity
            accessibilityHint={props.description}
            accessibilityRole="button"
            activeOpacity={0.92}
            disabled={props.disabled}
            onPress={handleFocus}
            style={[
              ApplicationStyle.card,
              isCompactCardVariant ? Spaces.padding[16] : Spaces.padding[24],
              isCompactCardVariant ? Spaces.gap[8] : Spaces.gap[16],
              {
                backgroundColor: cardSurfaceColor,
                borderColor: cardBorderColor,
                borderRadius: isCompactCardVariant ? 18 : 20,
                borderWidth: areValuesVisible ? 1.5 : 1,
                minHeight: cardMinHeight,
                opacity: props.disabled ? 0.5 : 1,
              },
            ]}
          >
            <View style={[Spaces.gap[8]]}>
              {hasLabel ? (
                <Text style={[Fonts.p3Bold, props.error ? Fonts.error500 : Fonts.primary500]}>
                  {props.label}
                </Text>
              ) : null}
              {props.description ? (
                <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 22 }]}>
                  {props.description}
                </Text>
              ) : null}
            </View>

            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={[Alignments.fill, Spaces.gap[8]]}>
                <Text
                  numberOfLines={2}
                  style={[valueTextStyle, props.displayTextStyle]}
                >
                  {hasValue ? displayValue : props.placeholder}
                </Text>
              </View>

              <View
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.12)',
                    borderColor: 'rgba(1, 179, 244, 0.18)',
                    borderRadius: 16,
                    borderWidth: 1,
                    height: 36,
                    width: 36,
                  },
                ]}
              >
                <Image
                  source={Images.chevronDown}
                  style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
                />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[Alignments.relative, { opacity: props.disabled ? 0.5 : 1 }]}>
            <TouchableOpacity
              disabled={props.disabled}
              onPress={handleFocus}
              style={[
                Alignments.absolute,
                Alignments.fullSize,
                Spaces.padding[12],
                hasLabel ? Spaces.paddingTop[40] : Spaces.paddingTop[12],
                { zIndex: 1 },
                props.closedPressableStyle,
              ]}
            >
              {props.value && (!Array.isArray(props.value) || props.value.length > 0) ? (
                props.closedContent || (
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={[Fonts.p1, Fonts.neutral00, props.displayTextStyle]}
                  >
                    {displayValue}
                  </Text>
                )
              ) : (
                <Text style={[Fonts.p1, props.lightMode ? Fonts.neutral200 : Fonts.neutral500]}>
                  {props.placeholder}
                </Text>
              )}
            </TouchableOpacity>
            <Input
              editable={false}
              error={props.error}
              label={props.label}
              lightMode={props.lightMode}
              readOnly
              ref={ref}
              wrapperStyle={props.wrapperStyle}
            />
          </View>
        )}
        {isCardVariant && props.error && props.error !== ' ' ? (
          <Text style={[Fonts.p2, Fonts.error700, Spaces.marginTop[8]]}>
            {props.error}
          </Text>
        ) : null}
        <BottomModal
          close={handleCloseModal}
          footerComponent={modalFooter}
          headerComponent={(
            <View style={[Alignments.row, Alignments.alignCenter]}>
              <Text
                numberOfLines={1}
                style={[
                  Fonts.h3Bold,
                  Fonts.neutral00,
                  Spaces.marginRight[16],
                  { flex: 1 },
                ]}
              >
                {modalTitle}
              </Text>
            </View>
          )}
          hideCloseButton
          isVisible={areValuesVisible}
          scrollable
          snapPoints={modalSnapPoints}
        >
          <View
            style={[
              Spaces.gap[16],
            ]}
          >
            {/* Search input */}
            {props.isSearchable ? (
              <Input
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                enterKeyHint="search"
                icon="search"
                inputMode="search"
                onChangeText={props.setSearchValue}
                placeholder={t('modals.actions.search')}
                ref={searchInputRef}
              />
            ) : null}

            {/* Options - Scrollable area */}
            <View style={[Spaces.gap[12], Spaces.paddingBottom[8]]}>
              {renderOptions.map(({ key, option }) => {
                if (option.isHeader) {
                  return (
                    <Text
                      key={key}
                      style={[
                        Fonts.p3Bold,
                        Fonts.neutral500,
                        Spaces.marginTop[16],
                        Spaces.marginBottom[8],
                      ]}
                    >
                      {option.label}
                    </Text>
                  );
                }

                const isChecked = handleIsChecked(option);
                return (
                  <View
                    key={key}
                    style={[Alignments.row, Spaces.marginTop[8]]}
                  >
                    <Checkable
                      customFillColor={Colors.neutral00}
                      disableBounceAnimation
                      disabled={false}
                      fontStyle={props.optionTextStyle}
                      isChecked={isChecked}
                      setIsChecked={
                        () => (handleSelectOption(option))
                      }
                      text={option.label}
                      type={props.isMulti ? 'square' : 'circle'}
                    >
                      {props.renderOptionContent ? props.renderOptionContent(option, isChecked) : null}
                    </Checkable>
                  </View>
                );
              })}
              {props.options.length === 0 && (props.searchValue?.length || 0) > 0
                ? (
                  <Text style={[Fonts.p2, Spaces.margin[8], Fonts.neutral500]}>
                    {t('common.messages.noData')}
                  </Text>
                ) : null}
            </View>
          </View>
        </BottomModal>
      </View>
    );
  },
);

export default AutocompleteSelect;
