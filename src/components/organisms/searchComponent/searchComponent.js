import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

const normalizeSearchValue = (value) => {
  const normalized = String(value || '');
  return normalized.length > 0 && normalized.length < 2 ? '' : normalized;
};

/**
 * Search component for clubs.
 * @param {object} props - The props
 * @param {number} [props.filterNumber] - The number of filters applied
 * @param {() => void} props.openFilters - Function to open the filters
 * @param {(text: string) => void} props.handleSearchField - Function to handle search field changes
 * @param {string} [props.searchDefaultValue] - Default value for the search field
 * @param {string} [props.placeholder] - Placeholder text for the search input
 * @param {'default' | 'compact'} [props.inputDensity] - Input density
 * @param {import('react-native').TextStyle | import('react-native').TextStyle[]} [props.inputStyle]
 * @returns {import('react').ReactElement} Search component
 */
function SearchComponent({
  filterNumber = undefined,
  handleSearchField,
  inputDensity = 'compact',
  inputStyle,
  openFilters,
  placeholder,
  searchDefaultValue = '',
}) {
  const [search, setSearch] = useState(searchDefaultValue);
  const searchHandlerRef = useRef(handleSearchField);
  const isSyncingDefaultValueRef = useRef(false);
  const lastEmittedValueRef = useRef(normalizeSearchValue(searchDefaultValue));
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  useEffect(() => {
    const nextDefaultValue = String(searchDefaultValue || '');
    lastEmittedValueRef.current = normalizeSearchValue(nextDefaultValue);

    if (search === nextDefaultValue) {
      return;
    }

    isSyncingDefaultValueRef.current = true;
    setSearch(nextDefaultValue);
  }, [search, searchDefaultValue]);

  useEffect(() => {
    searchHandlerRef.current = handleSearchField;
  }, [handleSearchField]);

  useEffect(() => {
    if (isSyncingDefaultValueRef.current) {
      isSyncingDefaultValueRef.current = false;
      return undefined;
    }

    const normalizedValue = normalizeSearchValue(search);
    if (normalizedValue === lastEmittedValueRef.current) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      lastEmittedValueRef.current = normalizedValue;
      searchHandlerRef.current?.(normalizedValue);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  /**
   * Handles the change in the search input.
   * @param {string} text
   */
  const handleChange = (text) => {
    setSearch(text);
  };

  const handleSubmit = () => {
    const normalizedValue = normalizeSearchValue(search);
    lastEmittedValueRef.current = normalizedValue;
    searchHandlerRef.current?.(normalizedValue);
  };

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[12],
      ]}
    >

      <View style={[Alignments.fill]}>
        <Input
          density={inputDensity}
          icon="search"
          onBlur={handleSubmit}
          onChangeText={handleChange}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor={Colors.neutral300}
          style={inputStyle}
          value={search}
        />
      </View>
      <View style={[Alignments.relative]}>
        {filterNumber ? (
          <View style={[
            Alignments.absolute,
            Alignments.alignCenter,
            Alignments.justifyCenter,
            Spaces.paddingHorizontal[4],
            ApplicationStyle.backgroundColor.primary500,
            ApplicationStyle.borderRadius32,
            {
              right: 0, top: 0, width: 18, zIndex: 1,
            },
          ]}
          >
            <Text style={[Fonts.p3, Fonts.primary900]}>
              {filterNumber}
            </Text>
          </View>
        ) : null}
        <Button
          icon="filter"
          onPress={openFilters}
          size="sm"
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default SearchComponent;
