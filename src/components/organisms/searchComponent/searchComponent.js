import { useState } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

/**
 * Search component for clubs.
 * @param {object} props - The props
 * @param {number} [props.filterNumber] - The number of filters applied
 * @param {() => void} props.openFilters - Function to open the filters
 * @param {(text: string) => void} props.handleSearchField - Function to handle search field changes
 * @param {string} [props.searchDefaultValue] - Default value for the search field
 * @param {string} [props.placeholder] - Placeholder text for the search input
 * @returns {import('react').ReactElement} Search component
 */
function SearchComponent({
  filterNumber = undefined,
  handleSearchField,
  openFilters,
  placeholder,
  searchDefaultValue = '',
}) {
  const [search, setSearch] = useState(searchDefaultValue);
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  /**
   * Handles the change in the search input.
   * @param {string} text
   */
  const handleChange = (text) => {
    setSearch(text);
    if (text.length >= 3) {
      handleSearchField(text);
    }
  };

  return (
    <View style={[
      Alignments.row,
      Alignments.alignEnd,
      Spaces.gap[12]]}
    >

      <View style={[Alignments.fill]}>
        <Input
          icon="search"
          onBlur={() => handleSearchField(search)}
          onChangeText={handleChange}
          placeholder={placeholder}
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
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default SearchComponent;
