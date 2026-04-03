import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { useGetPlaces } from '@/services/places/placesQueries';

/**
 * @typedef {object} Option
 * @property {string | number | null} value
 * @property {string} label
 * @property {string} [city]
 * @property {string} [context]
 * @property {string} [postcode]
 * @property {string} [provider]
 * @property {string | null} [providerId]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {{ north: number, south: number, east: number, west: number } | null} [bbox]
 * @property {string} [type]
 */

/**
 * Represents the autocomplete address input.
 * @param {object} props - The props of the component.
 * @param {Option | undefined} [props.address] - Controlled selected address.
 * @param {(value: Option | undefined) => void} [props.setAddress] - Controlled state setter.
 * @param {(value: Option | undefined) => void} [props.onSelect] - Optional select callback.
 * @param {string} [props.label] - The label of the input.
 * @param {string} [props.placeholder] - The placeholder of the input.
 * @param {string} [props.error] - The error of the input.
 * @param {boolean} [props.disabled] - Disable state.
 * @param {boolean} [props.lightMode] - Remove the default underline input chrome.
 * @param {number} [props.minChars] - Minimum query length before fetching.
 * @param {string} [props.type] - Optional BAN type hint.
 * @param {() => void} [props.onFocus] - Optional callback when the search modal opens.
 * @param {() => void} [props.onBlur] - Optional callback when the search modal closes.
 * @param {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [props.wrapperStyle]
 * @param {object} [props.styles] - Optional compatibility style prop.
 * @returns {import('react').ReactElement}
 */
function AutocompleteAddressInput({
  address,
  disabled = false,
  error,
  label,
  lightMode = false,
  minChars = 3,
  onBlur,
  onFocus,
  onSelect,
  placeholder,
  setAddress,
  type,
  wrapperStyle,
}) {
  const DEBOUNCE_MS = 350;
  const safeMinChars = Number.isFinite(minChars) ? Math.max(1, minChars) : 3;

  const selectRef = useRef(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [debouncedAddressSearch, setDebouncedAddressSearch] = useState('');
  const [uncontrolledAddress, setUncontrolledAddress] = useState(
    /** @type {Option | undefined} */ (undefined),
  );

  useEffect(() => {
    const nextValue = addressSearch?.trim() || '';
    const debounceTimer = setTimeout(() => {
      setDebouncedAddressSearch(nextValue);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [addressSearch]);

  useEffect(() => {
    if (address !== undefined) {
      setUncontrolledAddress(address);
    }
  }, [address]);

  const { data: places, isLoading } = useGetPlaces({
    options: {
      enabled: debouncedAddressSearch.length >= safeMinChars,
    },
    searchParam: debouncedAddressSearch,
    type,
  });

  const extractBoundingBox = useCallback((place) => {
    const rawBbox = place?.bbox || place?.properties?.bbox || place?.properties?.boundingbox;
    if (Array.isArray(rawBbox) && rawBbox.length >= 4) {
      const [westRaw, southRaw, eastRaw, northRaw] = rawBbox;
      const west = Number(westRaw);
      const south = Number(southRaw);
      const east = Number(eastRaw);
      const north = Number(northRaw);
      if ([north, south, east, west].every((value) => Number.isFinite(value))) {
        return {
          east,
          north,
          south,
          west,
        };
      }
    }

    if (rawBbox && typeof rawBbox === 'object') {
      const north = Number(rawBbox.north ?? rawBbox.maxLat ?? rawBbox[3]);
      const south = Number(rawBbox.south ?? rawBbox.minLat ?? rawBbox[1]);
      const east = Number(rawBbox.east ?? rawBbox.maxLon ?? rawBbox.maxLng ?? rawBbox[2]);
      const west = Number(rawBbox.west ?? rawBbox.minLon ?? rawBbox.minLng ?? rawBbox[0]);
      if ([north, south, east, west].every((value) => Number.isFinite(value))) {
        return {
          east,
          north,
          south,
          west,
        };
      }
    }

    return null;
  }, []);

  const placesOptions = useMemo(() => {
    if (!Array.isArray(places) || places.length === 0) return [];
    return places
      .map((place) => {
        const { geometry, properties } = place || {};
        const coordinates = geometry?.coordinates || [];
        const [lng, lat] = coordinates;
        const hasValidCoordinates = Number.isFinite(lng) && Number.isFinite(lat);
        const postcode = properties?.postcode?.trim();
        const rawLabel = properties?.label || '';

        /** @type {Option} */
        const option = {
          bbox: extractBoundingBox(place),
          city: properties?.city || '',
          context: properties?.context || '',
          label: postcode && !rawLabel.includes(postcode)
            ? `${rawLabel} (${postcode})`
            : rawLabel,
          lat: hasValidCoordinates ? lat : undefined,
          lng: hasValidCoordinates ? lng : undefined,
          postcode: postcode || '',
          provider: 'ban',
          providerId: properties?.id || null,
          type: properties?.type || properties?.source || '',
          value: hasValidCoordinates ? `${lng}|${lat}` : '',
        };
        return option;
      })
      .filter((option) => option.label && option.value);
  }, [extractBoundingBox, places]);

  const selectedAddress = setAddress ? address : uncontrolledAddress;

  /**
   * @param {Option | Option[] | undefined} selectedValue
   */
  const handleSetValue = useCallback((selectedValue) => {
    const normalized = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
    if (setAddress) {
      setAddress(normalized);
    } else {
      setUncontrolledAddress(normalized);
    }
    onSelect?.(normalized);
  }, [onSelect, setAddress]);

  return (
    <AutocompleteSelect
      disabled={disabled}
      error={error}
      isLoading={isLoading}
      isSearchable
      label={label || ''}
      lightMode={lightMode}
      onBlur={onBlur}
      onFocus={onFocus}
      options={placesOptions}
      placeholder={placeholder}
      ref={selectRef}
      searchValue={addressSearch}
      setSearchValue={setAddressSearch}
      setValue={handleSetValue}
      value={selectedAddress?.label || ''}
      wrapperStyle={wrapperStyle}
    />
  );
}

export default AutocompleteAddressInput;
