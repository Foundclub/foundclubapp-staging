import { useMemo, useRef, useState } from 'react';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { useGetPlaces } from '@/services/places/placesQueries';

/**
 * Represents the autocomplete address input.
 * @param {object} props - The props of the component.
 * @param {Option} props.address - The address.
 * @param {Function} props.setAddress - The function to set the address.
 * @param {string} props.label - The label of the input.
 * @param {string} props.placeholder - The placeholder of the input.
 * @param {string} [props.error] - The error of the input.
 * @param {boolean} [props.disabled] - The error of the input.
 * @param { string} [props.type] - The type of the input.
 * @returns {React.ReactElement} The autocomplete address input component.
 */
function AutocompleteAddressInput({
  address,
  disabled = false,
  error,
  label,
  placeholder,
  setAddress,
  type = 'housenumber',
}) {
  // ref
  const selectRef = useRef(null);
  // local state
  const [addressSearch, setAddressSearch] = useState('');

  // queries
  const { data: places, isLoading } = useGetPlaces({
    options: {
      enabled: addressSearch?.length > 1,
    },
    searchParam: addressSearch?.trim(),
    type,
  });

  // variables
  const placesOptions = useMemo(() => {
    if (places?.length) {
      return places.map(
        /**
         * Represents the properties and geometry of the places.
         * @param {any} place - The properties and geometry of the places.
         * @returns {Option} The option of the places.
         */
        ({ geometry, properties }) => ({
          label: `${properties.label} (${properties.postcode})`,
          value: geometry.coordinates?.join('|'),
        }),
      );
    }
    return [];
  }, [places]);

  return (
    <AutocompleteSelect
      disabled={disabled}
      error={error}
      isLoading={isLoading}
      isSearchable
      label={label}
      options={placesOptions || []}
      placeholder={placeholder}
      ref={selectRef}
      setSearchValue={setAddressSearch}
      setValue={setAddress}
      value={address?.label}
    />
  );
}

export default AutocompleteAddressInput;
