import {
  useEffect, useMemo, useRef, useState,
} from 'react';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { useGetPlaces } from '@/services/places/placesQueries';

/**
 * Represents the autocomplete address input.
 * @param {object} props - The props of the component.
 * @param {Option} props.address - The address.
 * @param {Function} props.setAddress - The function to set the address.
 * @param {Function} [props.onSelect] - Optional select callback.
 * @param {string} props.label - The label of the input.
 * @param {string} props.placeholder - The placeholder of the input.
 * @param {string} [props.error] - The error of the input.
 * @param {boolean} [props.disabled] - The error of the input.
 * @param {number} [props.minChars] - Minimum query length before fetching.
 * @param {string} [props.type] - Optional BAN type hint.
 * @returns {React.ReactElement} The autocomplete address input component.
 */
function AutocompleteAddressInput({
  address,
  disabled = false,
  error,
  label,
  minChars = 3,
  onSelect,
  placeholder,
  setAddress,
  type,
}) {
  const DEBOUNCE_MS = 350;
  const safeMinChars = Number.isFinite(minChars) ? Math.max(1, minChars) : 3;

  // ref
  const selectRef = useRef(null);
  // local state
  const [addressSearch, setAddressSearch] = useState('');
  const [debouncedAddressSearch, setDebouncedAddressSearch] = useState('');

  useEffect(() => {
    const nextValue = addressSearch?.trim() || '';
    const debounceTimer = setTimeout(() => {
      setDebouncedAddressSearch(nextValue);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [addressSearch]);

  // queries
  const { data: places, isLoading } = useGetPlaces({
    options: {
      enabled: debouncedAddressSearch.length >= safeMinChars,
    },
    searchParam: debouncedAddressSearch,
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
        ({ geometry, properties }) => {
          const coordinates = geometry?.coordinates || [];
          const [lng, lat] = coordinates;
          const hasValidCoordinates = Number.isFinite(lng) && Number.isFinite(lat);
          const postcode = properties?.postcode?.trim();
          const rawLabel = properties?.label || '';

          return {
            city: properties?.city || '',
            context: properties?.context || '',
            label: postcode && !rawLabel.includes(postcode)
              ? `${rawLabel} (${postcode})`
              : rawLabel,
            postcode: postcode || '',
            provider: 'ban',
            providerId: properties?.id || null,
            value: hasValidCoordinates ? `${lng}|${lat}` : '',
          };
        },
      ).filter((option) => option.label && option.value);
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
      searchValue={addressSearch}
      setSearchValue={setAddressSearch}
      setValue={setAddress || onSelect || (() => {})}
      value={address?.label}
    />
  );
}

export default AutocompleteAddressInput;
