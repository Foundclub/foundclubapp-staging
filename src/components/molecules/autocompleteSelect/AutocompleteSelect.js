import {
  forwardRef, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard, Text, TouchableOpacity, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';

import BottomModal from '../bottomModal/BottomModal';
import Input from '../input/Input';
/**
 * @typedef {object} SelectProps
 * @property {Array<Option>} options - The options of the select.
 * @property {string} value - The select options
 * @property {Function} setValue - The function to set the selected value.
 * @property {boolean} [isSearchable] - The flag to know if the select is searchable or not.
 * @property {boolean} [disabled] - The flag to know if the select is searchable or not.
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

    // local states
    const [areValuesVisible, setAreValuesVisible] = useState(false);
    const [selectedOption, setSelectedOption] = useState(
      /** @type {Option | undefined} */(undefined),
    );

    // refs
    const searchInputRef = useRef(null);

    // methods
    const handleFocus = () => {
      if (!props.disabled) {
        Keyboard.dismiss();
        setAreValuesVisible(true);
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
      setSelectedOption((current) => (current === option ? undefined : option));
    };

    const handleCloseModal = () => {
      setAreValuesVisible(false);
      if (props.setSearchValue) {
        props.setSearchValue('');
      }
    };

    const handleValidation = () => {
      handleCloseModal();
      props.setValue(selectedOption);
    };

    /**
     * Handle the select option.
     * @param {Option} option - The option to check.
     * @returns {boolean} The flag to know if the option is checked.
     */
    const handleIsChecked = (option) => !!selectedOption
    && selectedOption?.value === option.value;

    return (
      <View style={[Alignments.relative]}>
        <View style={[Alignments.relative]}>
          <TouchableOpacity
            onPress={handleFocus}
            style={[
              Alignments.absolute,
              Alignments.fullSize,
              Spaces.padding[12],
              Spaces.paddingTop[32],
              { zIndex: 1 },
            ]}
          >
            {props.value
              ? (
                <Text style={[Fonts.p1, Fonts.neutral00]}>
                  { props.value}
                </Text>
              )
              : (
                <Text style={[Fonts.p1, Fonts.neutral500]}>
                  {props.placeholder}
                </Text>
              )}
          </TouchableOpacity>
          <Input
            editable={false}
            error={props.error}
            label={props.label}
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
              Alignments.fullSize,
              Alignments.justifySpaceBetween,
            ]}
          >
            <View style={[
              Spaces.marginTop[12],
              Spaces.marginBottom[24],
              Spaces.gap[24],
            ]}
            >
              <Text style={[
                Fonts.h3Bold,
                Fonts.neutral00,
                Spaces.marginTop[4]]}
              >
                {props.placeholder}
              </Text>
              {/* search input */}
              {props.isSearchable ? (
                <Input
                  enterKeyHint="search"
                  icon="search"
                  inputMode="search"
                  onChangeText={props.setSearchValue}
                  placeholder={t('modals.actions.search')}
                  ref={searchInputRef}
                />
              ) : null}
              {/* options */}
              <SkeletonLoader
                backgroundColor={Colors.neutral200}
                isActive={!!props.isLoading}
              >
                <ScrollView contentContainerStyle={[Spaces.gap[12]]}>
                  {props.options.map((option) => (
                    <View
                      key={`${option.value}-${option.label}`}
                      style={[Alignments.row, Spaces.marginTop[8]]}
                    >
                      <Checkable
                        disabled={false}
                        isChecked={handleIsChecked(option)}
                        setIsChecked={
                      () => (handleSelectOption(option))
                    }
                        text={option.label}
                      />
                    </View>
                  ))}
                  {props.isLoading ? [...Array(5)].map((index) => (
                    <View key={index} style={[Alignments.row, Spaces.marginTop[8]]}>
                      <Checkable
                        disabled={false}
                        isChecked
                        setIsChecked={() => {}}
                        text="loading ..."
                      />
                    </View>
                  )) : null}
                  {props.options.length === 0 && (props.searchValue?.length || 0) > 0
                    ? (
                      <Text style={[Fonts.p2, Spaces.margin[8], Fonts.neutral500]}>
                        {t('common.messages.noData')}
                      </Text>
                    ) : null}
                </ScrollView>
              </SkeletonLoader>
            </View>
            {/* validation */}
            <Button
              onPress={handleValidation}
              title={t('modals.actions.select')}
              variant="Primary"
            />
          </View>
        </BottomModal>
      </View>
    );
  },
);

export default AutocompleteSelect;
