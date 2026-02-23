import {
  forwardRef, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard, Text, TouchableOpacity, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

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
      Alignments, Colors, Fonts, Spaces,
    } = useTheme();
    const { t } = useTranslation();
    const hasLabel = Boolean(props.label);

    // local states
    const [areValuesVisible, setAreValuesVisible] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState(
      /** @type {Option[] | Option | undefined} */
      (props.isMulti ? [] : undefined),
    );

    // refs
    const searchInputRef = useRef(null);
    const openModalTimeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

    useEffect(() => () => {
      if (openModalTimeoutRef.current) {
        clearTimeout(openModalTimeoutRef.current);
      }
    }, []);

    // methods
    const handleFocus = () => {
      if (!props.disabled) {
        Keyboard.dismiss();
        // Open after keyboard dismissal so the bottom sheet always appears above it.
        if (openModalTimeoutRef.current) {
          clearTimeout(openModalTimeoutRef.current);
        }
        openModalTimeoutRef.current = setTimeout(() => {
          setAreValuesVisible(true);
          openModalTimeoutRef.current = null;
        }, 120);
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

    const handleCloseModal = () => {
      if (openModalTimeoutRef.current) {
        clearTimeout(openModalTimeoutRef.current);
        openModalTimeoutRef.current = null;
      }
      setAreValuesVisible(false);
      if (props.setSearchValue) {
        props.setSearchValue('');
      }
    };

    const handleValidation = () => {
      handleCloseModal();
      props.setValue(selectedOptions);
    };

    const handleActionPress = () => {
      handleCloseModal();
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
      if (!props.value) return '';

      if (props.isMulti && Array.isArray(props.value)) {
        const selectedLabels = props.options
          .filter((opt) => props.value.includes(opt.value))
          .map((opt) => opt.label);
        return selectedLabels.join(', ');
      }

      // const option = props.options.find((opt) => opt.value === props.value);
      return props.value || undefined;
    };

    return (
      <View style={[Alignments.relative]}>
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
            ]}
          >
            {props.value && (!Array.isArray(props.value) || props.value.length > 0) ? (
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[Fonts.p1, Fonts.neutral00]}
              >
                {getDisplayValue()}
              </Text>
            ) : (
              <Text style={[Fonts.p1, Fonts.neutral500]}>
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
        <BottomModal
          close={handleCloseModal}
          isVisible={areValuesVisible}
        >
          <View
            style={[
              Spaces.gap[24],
              { flex: 1 },
              Alignments.justifySpaceBetween,
            ]}
          >
            {/* Header and Search Input */}
            <View style={[Spaces.paddingTop[24]]}>
              <Text style={[
                Fonts.h3Bold,
                Fonts.neutral00,
                Spaces.marginTop[4]]}
              >
                {props.label}
              </Text>
              {/* search input */}
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
            </View>

            {/* Options - Scrollable area */}
            <ScrollView
              contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24]]}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1, maxHeight: 350 }}
            >
              {props.options.map((option, index) => (
                option.isHeader ? (
                  <Text
                    key={`${option.value}-${index}`}
                    style={[
                      Fonts.p3Bold,
                      Fonts.neutral500,
                      Spaces.marginTop[16],
                      Spaces.marginBottom[8],
                    ]}
                  >
                    {option.label}
                  </Text>
                ) : (
                  <View
                    key={`${option.value}-${option.label}-${index}`}
                    style={[Alignments.row, Spaces.marginTop[8]]}
                  >
                    <Checkable
                      customFillColor={Colors.neutral00}
                      disabled={false}
                      isChecked={handleIsChecked(option)}
                      setIsChecked={
                        () => (handleSelectOption(option))
                      }
                      text={option.label}
                      type={props.isMulti ? 'square' : 'circle'}
                    />
                  </View>
                )
              ))}
              {props.options.length === 0 && (props.searchValue?.length || 0) > 0
                ? (
                  <Text style={[Fonts.p2, Spaces.margin[8], Fonts.neutral500]}>
                    {t('common.messages.noData')}
                  </Text>
                ) : null}
            </ScrollView>

            {/* Footer actions */}
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
                title={t('modals.actions.select')}
                variant="Primary"
              />
            </View>
          </View>
        </BottomModal>
      </View>
    );
  },
);

export default AutocompleteSelect;
