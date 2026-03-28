import parsePhoneNumberFromString, { getCountryCallingCode } from 'libphonenumber-js';
import {
  forwardRef, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';

import { getDeviceLocaleCountry } from '@/utils/device/deviceInfo';
import { DIAL_CODES } from '@/utils/dial_codes';

// Default to France (+33) for all users
const getDeviceDialCode = () => DIAL_CODES.find(({ value }) => value === '+33');

const DIALCODE_WIDTH = 72;

const repairCountryLabel = (label) => {
  const normalizedLabel = String(label || '');

  if (!/[Ãð]/.test(normalizedLabel)) {
    return normalizedLabel;
  }

  try {
    // Repair labels that were stored with UTF-8 bytes interpreted as latin1.
    return decodeURIComponent(escape(normalizedLabel));
  } catch (error) {
    return normalizedLabel;
  }
};

const getCompactDialCodeLabel = (dialCodeOption) => {
  const repairedLabel = repairCountryLabel(dialCodeOption?.label);
  const firstToken = repairedLabel.split(/\s+/).find(Boolean);

  if (firstToken && !firstToken.startsWith('+')) {
    return `${firstToken} ${dialCodeOption?.value || ''}`.trim();
  }

  return String(dialCodeOption?.value || '');
};

/**
 *
 * @param props
 */
const PhoneInput = forwardRef(
  /**
   * Phone input component.
   * @param {object} props - The props of the component.
   * @param {string | undefined} props.value - The value of the input.
   * @param {Function} props.onChange - The function to call on change.
   * @param {Function} props.onBlur - The function to call on blur.
   * @param {string} [props.error] - The error of the input.
   * @param {string} [props.label] - The label of the input.
   * @param {React.ForwardedRef<import('react-native').TextInput>} ref
   * @returns {React.ReactElement} Phone input component.
   */
  ({
    error, label, onBlur, onChange, value,
  }, ref) => {
    const {
      Alignments, ApplicationStyle, Spaces,
    } = useTheme();
    const { t } = useTranslation();
    const searchInput = useRef(null);

    const [dialCode, setDialCode] = useState(getDeviceDialCode());
    const [searchDialCode, setSearchDialCode] = useState('');

    // @ts-ignore
      const dialOptions = useMemo(() => {
      if (searchDialCode) {
        return DIAL_CODES
          .map((option) => ({
            ...option,
            label: repairCountryLabel(option.label),
          }))
          .filter(({ label, value: codeValue }) => (
            label.toLowerCase().includes(searchDialCode.toLowerCase())
            || String(codeValue || '').includes(searchDialCode.trim())
          ));
      }
      return DIAL_CODES.map((option) => ({
        ...option,
        label: repairCountryLabel(option.label),
      }));
    }, [searchDialCode]);

    const formattedValue = useMemo(() => {
      try {
        const phoneNumber = parsePhoneNumberFromString(value || '');
        if (phoneNumber?.country) {
          const newDialCode = `+${getCountryCallingCode(phoneNumber.country)}`;
          const foundDialCode = DIAL_CODES.find(({ value: code }) => code === newDialCode);
          if (foundDialCode) setDialCode(foundDialCode);
          return phoneNumber.formatNational();
        }
        return phoneNumber?.formatNational();
      } catch (e) {
        return value;
      }
    }, [value]);

    /**
     * Handle the change of the dial code
     * @param {string} val
     * @returns {string | undefined}
     */
    const getInternationalValue = (val) => {
      try {
        const phoneNumber = parsePhoneNumberFromString(val || '');
        return phoneNumber?.number;
      } catch (e) {
        return value;
      }
    };

    return (
      <View style={[Alignments.row, Alignments.fullWidth, Alignments.alignEnd]}>

        <AutocompleteSelect
          displayValue={getCompactDialCodeLabel(dialCode)}
          isSearchable
          options={dialOptions}
          placeholder={t('modals.phone.title')}
          ref={searchInput}
          searchValue={searchDialCode}
          setSearchValue={setSearchDialCode}
          setValue={setDialCode}
          value={dialCode ? dialCode.value : ''}
          wrapperStyle={{ width: DIALCODE_WIDTH }}
        />
        <View style={[Alignments.fill]}>
          <Input
            enterKeyHint="done"
            error={error}
            inputMode="tel"
            keyboardType="phone-pad"
            label={label || t('login.fields.phoneNumber.label')}
            labelStyle={{
              left: -DIALCODE_WIDTH,
            }}
            onBlur={onBlur}
            onChangeText={(val) => onChange(getInternationalValue(`${dialCode?.value}${val}`))}
            placeholder={t('login.fields.phoneNumber.placeholder')}
            ref={ref}
            value={formattedValue}
          />
        </View>
        <View style={[
          Alignments.row,
          Alignments.absolute,
          {
            left: DIALCODE_WIDTH,
            top: 40,
          }]}
        >
          <View style={[
            ApplicationStyle.backgroundColor.neutral00,
            Spaces.marginBottom[12],
            { height: 23, width: 1 }]}
          />
        </View>
      </View>
    );
  },
);

export default PhoneInput;
