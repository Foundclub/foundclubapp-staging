import parsePhoneNumberFromString, { getCountryCallingCode } from 'libphonenumber-js';
import {
  forwardRef, useCallback, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';

import { DIAL_CODES } from '@/utils/dial_codes';

// Default to France (+33) for all users
const getDeviceDialCode = () => DIAL_CODES.find(({ value }) => value === '+33');

const DIALCODE_WIDTH = Platform.OS === 'web' ? 96 : 72;

const repairCountryLabel = (label) => {
  const normalizedLabel = String(label || '');

  if (!/[\u00C3\u00C2\u00E2\u00F0]/.test(normalizedLabel)) {
    return normalizedLabel;
  }

  try {
    // Repair labels that were stored with UTF-8 bytes interpreted as latin1.
    return decodeURIComponent(escape(normalizedLabel));
  } catch (error) {
    return normalizedLabel;
  }
};

const REGIONAL_INDICATOR_REGEX = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;

const getCountryLabelParts = (dialCodeOption) => {
  const repairedLabel = repairCountryLabel(dialCodeOption?.label);
  const [firstToken = '', ...restTokens] = repairedLabel.split(/\s+/).filter(Boolean);

  return {
    countryName: restTokens.join(' ').trim(),
    firstToken,
    repairedLabel,
  };
};

const flagEmojiToCountryCode = (flagEmoji) => {
  if (!REGIONAL_INDICATOR_REGEX.test(flagEmoji || '')) {
    return '';
  }

  return Array.from(flagEmoji)
    .map((char) => String.fromCharCode(char.codePointAt(0) - 127397))
    .join('')
    .toUpperCase();
};

const getCompactDialCodeLabel = (dialCodeOption) => {
  const { firstToken } = getCountryLabelParts(dialCodeOption);
  if (Platform.OS === 'web') {
    return String(dialCodeOption?.value || '');
  }

  if (firstToken && !firstToken.startsWith('+')) {
    return `${firstToken} ${dialCodeOption?.value || ''}`.trim();
  }

  return String(dialCodeOption?.value || '');
};

const getDialOptionLabel = (dialCodeOption) => {
  const { countryName, firstToken, repairedLabel } = getCountryLabelParts(dialCodeOption);
  const countryCode = flagEmojiToCountryCode(firstToken);

  if (Platform.OS === 'web' && countryCode) {
    return `${countryName || dialCodeOption?.value || ''}`.trim();
  }

  return repairedLabel;
};

const getDialOptionCountryCode = (dialCodeOption) => {
  if (typeof dialCodeOption?.countryCode === 'string') {
    return dialCodeOption.countryCode.toLowerCase();
  }

  const { firstToken } = getCountryLabelParts(dialCodeOption);
  return flagEmojiToCountryCode(firstToken).toLowerCase();
};

const getFlagUri = (countryCode) => (countryCode
  ? `https://flagcdn.com/w40/${countryCode}.png`
  : null);

const renderDialOptionNode = (option, Alignments) => {
  const { label } = option;
  const countryCode = getDialOptionCountryCode(option);
  const flagUri = getFlagUri(countryCode);

  return (
    <View style={[Alignments.fill, Alignments.row, Alignments.alignCenter]}>
      {flagUri ? (
        <Image
          source={{ uri: flagUri }}
          style={{
            borderRadius: 2,
            height: 16,
            marginRight: 12,
            width: 24,
          }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          {
            color: '#FFFFFF',
            flex: 1,
            fontFamily: WEB_EMOJI_FONT_STACK_BOLD,
            fontSize: 14,
            lineHeight: 20,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const WEB_EMOJI_FONT_STACK_REGULAR = 'Montserrat-Regular, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const WEB_EMOJI_FONT_STACK_BOLD = 'Montserrat-Bold, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

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
    const dialDisplayTextStyle = useMemo(
      () => (Platform.OS === 'web'
        ? {
          fontFamily: WEB_EMOJI_FONT_STACK_REGULAR,
          lineHeight: 20,
        }
        : undefined),
      [],
    );
    const dialOptionTextStyle = useMemo(
      () => (Platform.OS === 'web' ? { fontFamily: WEB_EMOJI_FONT_STACK_BOLD } : undefined),
      [],
    );
    const webClosedPressableStyle = useMemo(
      () => (Platform.OS === 'web'
        ? {
          justifyContent: 'center',
          paddingBottom: 0,
          paddingLeft: 8,
          paddingRight: 4,
          paddingTop: 0,
        }
        : undefined),
      [],
    );
    const webClosedDialContent = useMemo(() => {
      if (Platform.OS !== 'web') {
        return undefined;
      }

      const flagUri = getFlagUri(getDialOptionCountryCode(dialCode));

      return (
        <View style={[Alignments.fill, Alignments.justifyCenter, Alignments.row, Alignments.alignCenter]}>
          {flagUri ? (
            <Image
              source={{ uri: flagUri }}
              style={{
                borderRadius: 2,
                height: 14,
                marginRight: 6,
                width: 22,
              }}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              {
                color: '#FFFFFF',
                fontFamily: WEB_EMOJI_FONT_STACK_REGULAR,
                fontSize: 13,
                lineHeight: 16,
              },
            ]}
          >
            {getCompactDialCodeLabel(dialCode)}
          </Text>
        </View>
      );
    }, [
      Alignments.alignCenter,
      Alignments.fill,
      Alignments.justifyCenter,
      Alignments.row,
      dialCode,
    ]);

    // @ts-ignore
    const dialOptions = useMemo(() => {
      if (searchDialCode) {
        return DIAL_CODES
          .map((option) => ({
            ...option,
            countryCode: getDialOptionCountryCode(option),
            label: getDialOptionLabel(option),
          }))
          .filter(({ label: optionLabel, value: codeValue }) => (
            optionLabel.toLowerCase().includes(searchDialCode.toLowerCase())
            || String(codeValue || '').includes(searchDialCode.trim())
          ));
      }
      return DIAL_CODES.map((option) => ({
        ...option,
        countryCode: getDialOptionCountryCode(option),
        label: getDialOptionLabel(option),
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

    const defaultCountryCode = useMemo(() => {
      const countryCode = getDialOptionCountryCode(dialCode);
      return countryCode ? countryCode.toUpperCase() : 'FR';
    }, [dialCode]);

    /**
     * Normalize a native or typed phone input into E.164 for the form state.
     * This also covers Android autofill, which can update the native field
     * without always emitting the usual character-by-character change events.
     * @param {string} rawValue
     * @returns {string}
     */
    const getInternationalValue = useCallback((rawValue) => {
      const normalizedRawValue = String(rawValue || '').trim();
      if (!normalizedRawValue) {
        return '';
      }

      const compactDigits = normalizedRawValue.replace(/[^\d+]/g, '');
      const nationalDigits = compactDigits.replace(/[^\d]/g, '');
      const localDigits = nationalDigits.startsWith('0') ? nationalDigits.slice(1) : nationalDigits;
      const prefixedDialCodeValue = dialCode?.value
        ? `${dialCode.value}${localDigits}`
        : normalizedRawValue;

      const parseCandidates = [
        normalizedRawValue,
        compactDigits,
        prefixedDialCodeValue,
      ].filter(Boolean);

      const parsedPhoneNumber = parseCandidates.reduce((resolvedValue, candidate) => {
        if (resolvedValue) {
          return resolvedValue;
        }

        try {
          const nextPhoneNumber = parsePhoneNumberFromString(candidate, defaultCountryCode);
          return nextPhoneNumber?.number || '';
        } catch (parseError) {
          // Ignore parse errors and continue through normalization fallbacks.
          return '';
        }
      }, '');

      if (parsedPhoneNumber) {
        return parsedPhoneNumber;
      }

      if (compactDigits.startsWith('+')) {
        return compactDigits;
      }

      return value || '';
    }, [defaultCountryCode, dialCode?.value, value]);

    return (
      <View style={[Alignments.row, Alignments.fullWidth, Alignments.alignEnd]}>

        <AutocompleteSelect
          closedContent={webClosedDialContent}
          closedPressableStyle={webClosedPressableStyle}
          displayTextStyle={dialDisplayTextStyle}
          displayValue={getCompactDialCodeLabel(dialCode)}
          isSearchable
          options={dialOptions}
          optionTextStyle={dialOptionTextStyle}
          placeholder={t('modals.phone.title')}
          ref={searchInput}
          renderOptionContent={Platform.OS === 'web'
            ? (option) => renderDialOptionNode(option, Alignments)
            : undefined}
          searchValue={searchDialCode}
          setSearchValue={setSearchDialCode}
          setValue={setDialCode}
          value={dialCode ? dialCode.value : ''}
          wrapperStyle={{ width: DIALCODE_WIDTH }}
        />
        <View style={[Alignments.fill]}>
          <Input
            autoComplete="tel"
            enterKeyHint="done"
            error={error}
            inputMode="tel"
            keyboardType="phone-pad"
            label={label || t('login.fields.phoneNumber.label')}
            labelStyle={{
              left: -DIALCODE_WIDTH,
            }}
            onBlur={onBlur}
            onChangeText={(val) => onChange(getInternationalValue(val))}
            onEndEditing={(event) => onChange(getInternationalValue(event?.nativeEvent?.text))}
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
